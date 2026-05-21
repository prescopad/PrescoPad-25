"""
Medical Transcription Service
Receives audio bytes → Groq Whisper transcription → LLaMA speaker diarization
→ LLaMA medical extraction → returns structured prescription data + transcript
"""
import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from functools import partial

from bson import ObjectId
from groq import Groq

from app.config.settings import settings
from app.config.database import get_db
from app.models.common import serialize_doc

log = logging.getLogger(__name__)

WHISPER_MODEL = "whisper-large-v3-turbo"
LLAMA_MODEL   = "meta-llama/llama-4-scout-17b-16e-instruct"


def _groq_client() -> Groq:
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not configured")
    return Groq(api_key=settings.GROQ_API_KEY)


# ── Step 1: Transcribe ────────────────────────────────────────────────────────

def _transcribe_sync(audio_bytes: bytes, filename: str):
    client = _groq_client()
    return client.audio.transcriptions.create(
        file=(filename, audio_bytes),
        model=WHISPER_MODEL,
        temperature=0,
        response_format="verbose_json",
    )


# ── Step 2: Diarize speakers ──────────────────────────────────────────────────

def _diarize_sync(segments: list) -> list:
    if not segments:
        return []

    client = _groq_client()
    numbered = "\n".join(
        f"[{i}] ({seg.start:.1f}s–{seg.end:.1f}s): {seg.text.strip()}"
        for i, seg in enumerate(segments)
    )

    prompt = f"""You are analyzing a recorded medical consultation from an Indian clinic between a doctor and a patient.

Below are numbered speech segments with timestamps. Assign each segment to "Doctor" or "Patient".

Rules:
- Doctor: asks diagnostic questions, names medicines/tests, gives instructions, explains findings, uses medical terminology
- Patient: describes symptoms, pain, duration of illness, answers doctor's questions, asks about treatment/cost
- Use turn-taking logic — conversations alternate. If unsure, use surrounding context.
- In Indian clinics, both Hindi and English may be mixed (Hinglish). A doctor saying "aaram karo" (take rest) or "yeh tablet lo" (take this tablet) is still the Doctor.
- Return ONLY a JSON array, each element: {{"index": int, "speaker": "Doctor" or "Patient"}}

Segments:
{numbered}

Return ONLY a JSON array, no explanation, no markdown:"""

    completion = client.chat.completions.create(
        model=LLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_completion_tokens=2048,
    )
    raw = completion.choices[0].message.content.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()

    try:
        labels = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("Diarization JSON parse failed, raw: %s", raw[:200])
        labels = [{"index": i, "speaker": "Unknown"} for i in range(len(segments))]

    label_map = {item["index"]: item["speaker"] for item in labels}
    return [
        {
            "start": round(seg.start, 2),
            "end":   round(seg.end, 2),
            "speaker": label_map.get(i, "Unknown"),
            "text": seg.text.strip(),
        }
        for i, seg in enumerate(segments)
    ]


# ── Step 3: Extract medical info → prescription fields ───────────────────────

def _extract_medical_info_sync(diarized: list) -> dict:
    if not diarized:
        return {}

    client = _groq_client()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")  # e.g. 2026-05-17
    today_display = datetime.now(timezone.utc).strftime("%d %B %Y")  # e.g. 17 May 2026

    conversation = "\n".join(
        f"{seg['speaker']} ({seg['start']}s): {seg['text']}"
        for seg in diarized
    )

    prompt = f"""You are an expert medical AI assistant embedded in an Indian clinic management system.
Your job is to deeply analyze a doctor-patient consultation transcript and extract structured prescription data.

TODAY'S DATE: {today_str} ({today_display})

=== CRITICAL RULES — READ CAREFULLY ===

1. INFER, DON'T JUST MATCH KEYWORDS
   - Doctors and patients speak naturally and informally. They will NOT say "I prescribe" or "my advice is".
   - Use the full context of the conversation to infer what was said.
   - Example: Doctor says "Take rest for a week, drink lots of fluids, avoid cold food" → advice = "Take rest for a week, drink plenty of fluids, avoid cold food"
   - Example: Doctor says "I'll give you a paracetamol for the fever" → extract Paracetamol as a medicine
   - Example: Patient says "my stomach hurts since 2 days" → symptom = abdominal pain / stomach ache

2. DATE CALCULATION — ALWAYS CALCULATE FROM TODAY ({today_str})
   - "come after 3 days" → add 3 days to today → output that exact YYYY-MM-DD date
   - "come next week" → add 7 days to today
   - "come after 2 weeks" → add 14 days to today
   - "come next Monday" → calculate the actual date of next Monday from today
   - "come after a month" → add 30 days to today
   - "see me on the 20th" → use the 20th of current month (or next month if already past)
   - NEVER output "after 3 days" as the date. ALWAYS convert to YYYY-MM-DD format.
   - If no follow-up is mentioned at all → null

3. MEDICINE EXTRACTION — BE THOROUGH
   - Extract medicines even when mentioned casually: "let me write you an antibiotic", "I'll prescribe a vitamin supplement"
   - Infer medicine type from name if not stated (e.g. Amoxicillin → Capsule, Cough syrup → Syrup, eye drops → Drops)
   - Frequency patterns:
     * "once a day" / "OD" → "1-0-0"
     * "twice a day" / "BD" → "1-0-1"
     * "three times a day" / "TDS" → "1-1-1"
     * "morning and night" → "1-0-1"
     * "every 8 hours" → "1-1-1"
     * "at night" / "at bedtime" → "0-0-1"
     * "SOS" / "as needed" → "As needed"
   - Duration: "5 din" = "5 days", "ek hafta" = "1 week", "do hafte" = "2 weeks"
   - Timing: infer from context — "after meals" → "After food", "on empty stomach" → "Empty stomach", "before sleeping" → "At bedtime"

4. DIAGNOSIS — INFER FROM SYMPTOMS AND DOCTOR STATEMENTS
   - If doctor explicitly names a diagnosis → use it
   - If not explicitly named, infer from the symptoms and treatment discussed
   - Example: Patient says "fever, body ache, cold" and doctor prescribes paracetamol + antibiotic → diagnosis = "Viral fever with upper respiratory tract infection"
   - Example: Doctor says "looks like you have a stomach infection" → diagnosis = "Gastroenteritis"

5. ADVICE — CAPTURE ALL LIFESTYLE AND CARE INSTRUCTIONS
   - Everything the doctor tells the patient to do or avoid: rest, diet, fluids, activity restrictions
   - Example: "avoid spicy food, drink warm water, rest at home for 2 days" → full advice string
   - Include warnings: "if fever doesn't come down in 2 days, come back immediately"

6. LAB TESTS — ANY TEST THE DOCTOR ORDERS OR SUGGESTS
   - "get a CBC done" → Complete Blood Count (Blood)
   - "do a urine test" → Urine Routine (Urine)
   - "get an X-ray of the chest" → Chest X-Ray (Imaging)
   - "let's do a blood sugar" → Blood Glucose (Blood)
   - "get an ultrasound of the abdomen" → Abdominal Ultrasound (Imaging)

7. HINGLISH / MIXED LANGUAGE
   - This is an Indian clinic. Doctors and patients may mix Hindi and English freely.
   - "bukhar" = fever, "khana khane ke baad" = after food, "subah shaam" = morning and evening
   - "do din mein aana" = come in 2 days, "aaram karo" = take rest, "paani piyo" = drink water

=== OUTPUT FORMAT ===
Return ONLY valid JSON, no markdown, no explanation, no extra text:

{{
  "chief_complaint": "primary reason for visit inferred from conversation, or null",
  "diagnosis": "primary diagnosis — inferred if not explicitly stated, or null",
  "symptoms": ["all symptoms mentioned or implied"],
  "advice": "complete doctor advice as a single readable string covering all instructions given, or null",
  "follow_up_date": "YYYY-MM-DD calculated from today ({today_str}) based on what doctor said, or null",
  "prescribed_medicines": [
    {{
      "medicine_name": "medicine name",
      "type": "Tablet or Capsule or Syrup or Injection or Drops or Cream or Ointment or Inhaler or Powder or Gel or Patch or Suppository or Other",
      "dosage": "dosage strength e.g. 500mg, or empty string if not mentioned",
      "frequency": "frequency in 1-0-1 format or plain text e.g. twice daily, or empty string",
      "duration": "e.g. 5 days, 1 week, or empty string",
      "timing": "Before food or After food or With food or Empty stomach or At bedtime or As needed, or empty string",
      "notes": "any special instructions, or empty string"
    }}
  ],
  "lab_tests": [
    {{
      "test_name": "full test name",
      "category": "Blood or Urine or Stool or Imaging or Microbiology or Cardiology or Pulmonary or Neurology or Pathology or Allergy or Other",
      "notes": "any instructions e.g. fasting required, or empty string"
    }}
  ]
}}

=== CONSULTATION TRANSCRIPT ===
{conversation}

Remember: TODAY = {today_str}. Calculate all relative dates from this. Think step by step before outputting."""

    completion = client.chat.completions.create(
        model=LLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.15,
        max_completion_tokens=4000,
    )
    raw = completion.choices[0].message.content.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()

    try:
        result = json.loads(raw)
        log.info("Extraction result — diagnosis: %s | advice: %s | follow_up: %s | medicines: %d | lab_tests: %d",
                 result.get("diagnosis") or result.get("chief_complaint"),
                 result.get("advice"),
                 result.get("follow_up_date"),
                 len(result.get("prescribed_medicines") or []),
                 len(result.get("lab_tests") or []))
        return result
    except json.JSONDecodeError:
        log.warning("Medical extraction JSON parse failed, raw: %s", raw[:200])
        return {"error": "Could not parse extraction", "raw": raw}


# ── Step 4: Auto-register new medicines / lab tests into clinic database ──────

async def _auto_register_items(clinic_id: str, medicines: list, lab_tests: list):
    """
    For each AI-extracted medicine/lab test, upsert into the clinic's custom database:
    - If the name doesn't exist yet → insert with usage_count=1
    - If it already exists → increment usage_count
    Failures are silently swallowed so they never affect the transcription response.
    """
    db = get_db()

    for m in medicines:
        name = (m.get("medicine_name") or "").strip()
        if not name:
            continue
        try:
            existing = await db.custom_medicines.find_one(
                {"clinic_id": clinic_id, "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
            )
            if existing:
                await db.custom_medicines.update_one(
                    {"_id": existing["_id"]},
                    {"$inc": {"usage_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                )
            else:
                await db.custom_medicines.insert_one({
                    "clinic_id": clinic_id,
                    "name": name,
                    "type": m.get("type", "Tablet"),
                    "strength": m.get("dosage", ""),
                    "usage_count": 1,
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                })
                log.info("Auto-registered new medicine: %s", name)
        except Exception:
            log.warning("Failed to auto-register medicine: %s", name)

    for t in lab_tests:
        name = (t.get("test_name") or "").strip()
        if not name:
            continue
        try:
            existing = await db.custom_lab_tests.find_one(
                {"clinic_id": clinic_id, "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
            )
            if existing:
                await db.custom_lab_tests.update_one(
                    {"_id": existing["_id"]},
                    {"$inc": {"usage_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                )
            else:
                await db.custom_lab_tests.insert_one({
                    "clinic_id": clinic_id,
                    "name": name,
                    "category": t.get("category", "Other"),
                    "usage_count": 1,
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                })
                log.info("Auto-registered new lab test: %s", name)
        except Exception:
            log.warning("Failed to auto-register lab test: %s", name)


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def process_audio(
    audio_bytes: bytes,
    filename: str,
    doctor_id: str,
    patient_id: str,
    clinic_id: str,
) -> dict:
    loop = asyncio.get_event_loop()

    # Run all blocking Groq SDK calls in a thread pool so they don't block the event loop
    try:
        log.info("Transcribing audio: %s bytes, file=%s", len(audio_bytes), filename)
        transcription = await loop.run_in_executor(
            None, partial(_transcribe_sync, audio_bytes, filename)
        )
    except Exception as e:
        log.exception("Whisper transcription failed")
        raise ValueError(f"Transcription failed: {e}") from e

    segments = getattr(transcription, "segments", []) or []
    full_text = getattr(transcription, "text", "") or ""
    log.info("Transcription done: %d segments, %d chars", len(segments), len(full_text))

    # If no segments but we have text, create a single segment from full text
    if not segments and full_text:
        class _Seg:
            start = 0.0
            end = 0.0
            text = full_text
        segments = [_Seg()]

    try:
        diarized = await loop.run_in_executor(None, partial(_diarize_sync, segments))
    except Exception as e:
        log.warning("Diarization failed, continuing without it: %s", e)
        diarized = [{"start": 0.0, "end": 0.0, "speaker": "Unknown", "text": full_text}] if full_text else []

    try:
        extraction = await loop.run_in_executor(None, partial(_extract_medical_info_sync, diarized))
    except Exception as e:
        log.warning("Medical extraction failed, continuing without it: %s", e)
        extraction = {}

    # Duration from last segment end, or 0
    audio_duration = round(diarized[-1]["end"], 1) if diarized and diarized[-1].get("end") else 0

    # Auto-register any new medicines / lab tests into the clinic's database
    prescribed_medicines = extraction.get("prescribed_medicines") or []
    lab_tests_raw = extraction.get("lab_tests") or []
    await _auto_register_items(clinic_id, prescribed_medicines, lab_tests_raw)

    # Persist transcript to MongoDB
    db = get_db()
    doc = {
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "clinic_id": clinic_id,
        "full_transcript": full_text,
        "diarized_transcript": diarized,
        "medical_extraction": extraction,
        "audio_duration_seconds": audio_duration,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.transcripts.insert_one(doc)
    transcript_id = str(result.inserted_id)
    log.info("Transcript saved: %s", transcript_id)

    return {
        "transcript_id": transcript_id,
        "full_transcript": full_text,
        "diarized_transcript": diarized,
        "prescription_autofill": {
            "diagnosis": extraction.get("diagnosis") or extraction.get("chief_complaint") or "",
            "advice": extraction.get("advice") or "",
            "follow_up_date": extraction.get("follow_up_date") or "",
            "medicines": [
                {
                    "medicine_name": m.get("medicine_name", ""),
                    "type": m.get("type", "Tablet"),
                    "dosage": m.get("dosage", ""),
                    "frequency": m.get("frequency", ""),
                    "duration": m.get("duration", ""),
                    "timing": m.get("timing", ""),
                    "notes": m.get("notes", ""),
                }
                for m in prescribed_medicines
                if m.get("medicine_name")
            ],
            "lab_tests": [
                {
                    "test_name": t.get("test_name", ""),
                    "category": t.get("category", "Other"),
                    "notes": t.get("notes", ""),
                }
                for t in lab_tests_raw
                if t.get("test_name")
            ],
        },
    }


async def get_patient_transcripts(clinic_id: str, patient_id: str) -> list:
    db = get_db()
    cursor = db.transcripts.find(
        {"clinic_id": clinic_id, "patient_id": patient_id}
    ).sort("created_at", -1)
    return [serialize_doc(t) async for t in cursor]


async def get_transcript(transcript_id: str, clinic_id: str) -> dict:
    db = get_db()
    doc = await db.transcripts.find_one(
        {"_id": ObjectId(transcript_id), "clinic_id": clinic_id}
    )
    if not doc:
        raise ValueError("Transcript not found")
    return serialize_doc(doc)
