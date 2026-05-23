"""
Medical Transcription Service
Audio file → Groq Whisper transcription → LLaMA speaker diarization
→ LLaMA medical extraction → returns structured prescription data + transcript.

The extraction prompt is deliberately conservative — when the doctor doesn't
mention a field (diagnosis, advice, follow-up, medicines, lab tests) the model
must return null / empty list. We never invent data.
"""
import asyncio
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import partial
from typing import Optional

from bson import ObjectId
from groq import Groq

from app.config.settings import settings
from app.config.database import get_db
from app.models.common import serialize_doc

log = logging.getLogger(__name__)

WHISPER_MODEL = "whisper-large-v3"
LLAMA_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Bounded executor — never spawn more than 8 blocking Groq calls simultaneously.
_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="groq")


def _groq_client() -> Groq:
    if not settings.GROQ_API_KEY:
        raise ValueError("Transcription is not configured on this server")
    return Groq(api_key=settings.GROQ_API_KEY)


def _retry_sync(fn, *, attempts: int = 3, base_delay: float = 1.0):
    last_err: Optional[Exception] = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if i == attempts - 1:
                break
            time.sleep(base_delay * (2 ** i))
    if last_err:
        raise last_err


# ── Step 1: Transcribe ────────────────────────────────────────────────────────

def _transcribe_sync(file_path: str, filename: str):
    client = _groq_client()
    with open(file_path, "rb") as f:
        audio_bytes = f.read()
    return _retry_sync(lambda: client.audio.transcriptions.create(
        file=(filename, audio_bytes),
        model=WHISPER_MODEL,
        temperature=0,
        response_format="verbose_json",
    ))


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

    completion = _retry_sync(lambda: client.chat.completions.create(
        model=LLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_completion_tokens=2048,
    ))
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
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_display = datetime.now(timezone.utc).strftime("%d %B %Y")

    conversation = "\n".join(
        f"{seg['speaker']} ({seg['start']}s): {seg['text']}"
        for seg in diarized
    )

    prompt = f"""You are a medical AI assistant in an Indian clinic. Extract structured prescription data from a doctor-patient consultation transcript.

TODAY'S DATE: {today_str} ({today_display})

=== EXTREMELY IMPORTANT RULES ===

ZERO HALLUCINATION:
- You MUST NOT invent any information that is not clearly present (explicitly or strongly implicitly) in the transcript.
- If the doctor did NOT mention a diagnosis → diagnosis = null. Do not guess.
- If the doctor did NOT mention any advice → advice = null. Do not synthesize one.
- If the doctor did NOT mention a follow-up date → follow_up_date = null.
- If no medicines were discussed → prescribed_medicines = [].
- If no lab tests were ordered → lab_tests = [].
- Empty values are correct. Empty values are the safe answer.

REASONABLE INFERENCE (only when grounded in actual conversation):
- "Take rest for a week, drink lots of fluids" → advice captures both.
- "I'll give you a paracetamol for fever" → medicine = Paracetamol.
- "come after 3 days" → follow_up_date = today + 3 days, in YYYY-MM-DD format.
- "twice a day" → frequency = "1-0-1". "TDS" → "1-1-1". "OD" → "1-0-0". "At night" → "0-0-1". "SOS" → "As needed".
- Hinglish: "do din mein aana" = come in 2 days, "khana khane ke baad" = after food.

NEVER fabricate a follow-up date when none was discussed. NEVER copy "today" as the follow-up date unless the doctor explicitly said "tomorrow" / "today".

=== OUTPUT FORMAT ===
Return ONLY valid JSON, no markdown, no explanation:

{{
  "chief_complaint": "primary reason for visit, or null if not stated",
  "diagnosis": "primary diagnosis, or null if doctor did not name one",
  "symptoms": ["all symptoms explicitly mentioned"],
  "advice": "complete doctor advice as a single string, or null if no advice was given",
  "follow_up_date": "YYYY-MM-DD computed from today ({today_str}), or null if not mentioned",
  "prescribed_medicines": [
    {{
      "medicine_name": "exact name as spoken",
      "type": "Tablet | Capsule | Syrup | Injection | Drops | Cream | Ointment | Inhaler | Powder | Gel | Patch | Suppository | Other",
      "dosage": "strength e.g. 500mg, or empty string if not mentioned",
      "frequency": "frequency in 1-0-1 form or natural language, or empty string",
      "duration": "e.g. 5 days, 1 week, or empty string",
      "timing": "Before food | After food | With food | Empty stomach | At bedtime | As needed | empty string",
      "notes": "special instructions, or empty string"
    }}
  ],
  "lab_tests": [
    {{
      "test_name": "full test name",
      "category": "Blood | Urine | Stool | Imaging | Microbiology | Cardiology | Pulmonary | Neurology | Pathology | Allergy | Other",
      "notes": "instructions e.g. fasting required, or empty string"
    }}
  ]
}}

=== CONSULTATION TRANSCRIPT (BEGIN) ===
{conversation}
=== CONSULTATION TRANSCRIPT (END) ===

Reminder: Empty values are correct when the information was not discussed. Today is {today_str}. Return JSON only."""

    completion = _retry_sync(lambda: client.chat.completions.create(
        model=LLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.05,
        max_completion_tokens=4000,
    ))
    raw = completion.choices[0].message.content.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()

    try:
        result = json.loads(raw)
        log.info(
            "Extraction — diagnosis=%s advice_set=%s follow_up=%s meds=%d tests=%d",
            bool(result.get("diagnosis")),
            bool(result.get("advice")),
            result.get("follow_up_date"),
            len(result.get("prescribed_medicines") or []),
            len(result.get("lab_tests") or []),
        )
        return result
    except json.JSONDecodeError:
        log.warning("Medical extraction JSON parse failed, raw: %s", raw[:200])
        return {}


# ── Step 4: Auto-register new medicines / lab tests into clinic database ──────

async def _auto_register_items(clinic_id: str, medicines: list, lab_tests: list):
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

async def process_audio_file(
    file_path: str,
    filename: str,
    doctor_id: str,
    patient_id: str,
    clinic_id: str,
    prescription_id: Optional[str] = None,
    queue_item_id: Optional[str] = None,
) -> dict:
    loop = asyncio.get_event_loop()

    try:
        transcription = await loop.run_in_executor(
            _executor, partial(_transcribe_sync, file_path, filename)
        )
    except Exception as e:
        log.exception("Whisper transcription failed")
        raise ValueError(f"Transcription failed: {e}") from e

    segments = getattr(transcription, "segments", []) or []
    full_text = getattr(transcription, "text", "") or ""
    log.info("Transcription done: %d segments, %d chars", len(segments), len(full_text))

    if not segments and full_text:
        class _Seg:
            start = 0.0
            end = 0.0
            text = full_text
        segments = [_Seg()]

    try:
        diarized = await loop.run_in_executor(_executor, partial(_diarize_sync, segments))
    except Exception as e:
        log.warning("Diarization failed, continuing without it: %s", e)
        diarized = [{"start": 0.0, "end": 0.0, "speaker": "Unknown", "text": full_text}] if full_text else []

    try:
        extraction = await loop.run_in_executor(_executor, partial(_extract_medical_info_sync, diarized))
    except Exception as e:
        log.warning("Medical extraction failed, continuing without it: %s", e)
        extraction = {}

    audio_duration = round(diarized[-1]["end"], 1) if diarized and diarized[-1].get("end") else 0

    prescribed_medicines = extraction.get("prescribed_medicines") or []
    lab_tests_raw = extraction.get("lab_tests") or []
    await _auto_register_items(clinic_id, prescribed_medicines, lab_tests_raw)

    # Persist transcript with optional prescription / queue linkage so the
    # audit trail can tie a consultation to its prescription.
    db = get_db()
    doc = {
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "clinic_id": clinic_id,
        "prescription_id": prescription_id,
        "queue_item_id": queue_item_id,
        "full_transcript": full_text,
        "diarized_transcript": diarized,
        "medical_extraction": extraction,
        "audio_duration_seconds": audio_duration,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.transcripts.insert_one(doc)
    transcript_id = str(result.inserted_id)
    log.info("Transcript saved: %s", transcript_id)

    # Best-effort backlink on the prescription side.
    if prescription_id:
        try:
            await db.prescriptions.update_one(
                {"_id": prescription_id, "clinic_id": clinic_id},
                {"$set": {"transcript_id": transcript_id, "updated_at": datetime.now(timezone.utc)}},
            )
        except Exception:
            log.warning("Failed to backlink transcript %s → prescription %s", transcript_id, prescription_id)

    # Note: empty strings/null in autofill are intentional — UI keeps fields empty.
    return {
        "transcript_id": transcript_id,
        "full_transcript": full_text,
        "diarized_transcript": diarized,
        "prescription_autofill": {
            "diagnosis": extraction.get("diagnosis") or "",
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
