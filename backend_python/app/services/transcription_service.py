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
import httpx

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
    """Transcribe in the SPOKEN language (Hindi / Marathi / English / Hinglish).

    We deliberately do NOT use Whisper's translate task — translating to English
    at the audio stage mangles Indian drug names and Hinglish dosing phrases.
    Auto-detect keeps Devanagari + native words; the LLaMA extractor then maps
    medical terms to standard English names.
    """
    client = _groq_client()
    with open(file_path, "rb") as f:
        audio_bytes = f.read()
    return _retry_sync(lambda: client.audio.transcriptions.create(
        file=(filename, audio_bytes),
        model=WHISPER_MODEL,
        temperature=0,
        response_format="verbose_json",
        # A clinical prompt nudges Whisper toward medical vocabulary and keeps it
        # transcribing rather than translating. No `language=` → auto-detect.
        prompt=(
            "Medical consultation between a doctor and patient in an Indian clinic. "
            "Hindi, Marathi, and English may be mixed. Includes medicine names, "
            "dosage, symptoms, diagnosis, and lab tests."
        ),
    ))


# ── Step 2: Diarize speakers ──────────────────────────────────────────────────

def _call_gemini(prompt: str, response_mime_type: Optional[str] = None) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("Gemini API key is not configured on this server")
    
    # Cascade model list to bypass 503 "High Demand" or 429 rate limit outages
    models = ["gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"]
    
    last_err: Optional[Exception] = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }
        
        if response_mime_type:
            payload["generationConfig"] = {
                "responseMimeType": response_mime_type
            }
            
        headers = {
            "Content-Type": "application/json"
        }
        
        def do_post():
            with httpx.Client(timeout=60.0) as client:
                response = client.post(url, headers=headers, json=payload)
                if response.status_code != 200:
                    raise ValueError(f"Gemini API returned error {response.status_code}: {response.text}")
                return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        try:
            log.info("Attempting medical extraction via Gemini model: %s", model)
            return _retry_sync(do_post)
        except Exception as e:
            log.warning("Gemini model %s failed, trying next fallback. Error: %s", model, e)
            last_err = e
            
    if last_err:
        raise last_err
    raise ValueError("All Gemini model fallback options failed")


def _diarize_sync(segments: list) -> list:
    if not segments:
        return []

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

    try:
        raw = _call_gemini(prompt, response_mime_type="application/json")
        raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
        labels = json.loads(raw)
    except Exception as e:
        log.warning("Gemini Diarization failed: %s, falling back to alternating speakers", e)
        # Alternating fallback
        labels = [
            {"index": i, "speaker": "Doctor" if i % 2 == 0 else "Patient"}
            for i in range(len(segments))
        ]

    label_map = {item["index"]: item["speaker"] for item in labels}

    def _speaker(i: int) -> str:
        spk = label_map.get(i)
        if spk in ("Doctor", "Patient"):
            return spk
        # Unknown / missing → alternate so extraction still has structure.
        return "Doctor" if i % 2 == 0 else "Patient"

    return [
        {
            "start": round(seg.start, 2),
            "end":   round(seg.end, 2),
            "speaker": _speaker(i),
            "text": seg.text.strip(),
        }
        for i, seg in enumerate(segments)
    ]


# ── Step 3: Extract medical info → prescription fields ───────────────────────

def _extract_medical_info_sync(diarized: list, full_text: str = "") -> dict:
    # Extraction works off the diarized turns when available, but ALWAYS also
    # includes the full raw transcript so it never degrades to empty when
    # diarization is weak (e.g. one-blob audio or noisy Hindi/Marathi speech).
    if not diarized and not full_text:
        return {}

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_display = datetime.now(timezone.utc).strftime("%d %B %Y")

    conversation = "\n".join(
        f"{seg['speaker']} ({seg['start']}s): {seg['text']}"
        for seg in diarized
    ) if diarized else ""

    raw_block = full_text.strip()

    prompt = f"""You are a multilingual medical AI assistant in an Indian clinic. Extract structured prescription data from a doctor-patient consultation transcript.

The transcript may be in HINDI, MARATHI, ENGLISH, or a mix (Hinglish/Manglish), and may be written in Devanagari script or Roman letters. You understand all of these fluently.

TODAY'S DATE: {today_str} ({today_display})

=== LANGUAGE HANDLING ===
- READ the conversation in whatever language it is in (Hindi/Marathi/English/mixed).
- OUTPUT all values in clean ENGLISH using standard medical terminology:
  * Translate symptoms to English: "बुखार"/"ताप"/"bukhar" → "fever", "खांसी"/"खोकला" → "cough", "पेट दर्द"/"पोटदुखी" → "abdominal pain", "सिरदर्द"/"डोकेदुखी" → "headache", "उलटी"/"उल्टी" → "vomiting", "दस्त"/"जुलाब" → "loose motions / diarrhea".
  * Use the STANDARD English/generic name for medicines even if spoken in an accent or shortened: "paracetamol", "amoxicillin", "azithromycin", "pantoprazole", "cetirizine", "ORS", etc.
  * Diagnosis in English medical terms.

=== MULTILINGUAL DOSING & TIMING CUES ===
Hindi/Marathi → meaning:
- "din mein ek baar" / "dिवसातून एकदा" / "OD" → frequency "1-0-0"
- "din mein do baar" / "दिवसातून दोनदा" / "BD" → "1-0-1"
- "din mein teen baar" / "TDS" → "1-1-1"
- "subah-shaam" / "सकाळ-संध्याकाळ" → "1-0-1"
- "raat ko" / "रात्री" / "at night" → "0-0-1"
- "zaroorat padne par" / "गरज पडल्यास" / "SOS" → "As needed"
- "khana khane ke baad" / "जेवणानंतर" / "after food" → timing "After food"
- "khali pet" / "उपाशी पोटी" / "empty stomach" → "Empty stomach"
- Duration: "paanch din" / "पाच दिवस" → "5 days"; "ek hafta" / "एक आठवडा" → "1 week"; "do hafte" → "2 weeks".

=== FOLLOW-UP DATE (relative → absolute) ===
- "teen din baad aana" / "तीन दिवसांनी या" / "come after 3 days" → today + 3 days → YYYY-MM-DD
- "agle hafte" / "पुढच्या आठवड्यात" / "next week" → today + 7 days
- "do hafte baad" → today + 14 days
- If no follow-up was mentioned → null. NEVER copy today's date unless the doctor explicitly said "today"/"tomorrow".

=== ZERO HALLUCINATION ===
- Do NOT invent anything not present in the transcript.
- No diagnosis stated → diagnosis = null. No advice → advice = null. No follow-up → null.
- No medicines discussed → prescribed_medicines = []. No lab tests → lab_tests = [].
- Empty values are the correct, safe answer.

=== OUTPUT FORMAT ===
Return ONLY valid JSON, no markdown, no explanation:

{{
  "chief_complaint": "primary reason for visit in English, or null",
  "diagnosis": "primary diagnosis in English medical terms, or null",
  "symptoms": ["all symptoms in English"],
  "advice": "complete doctor advice in English as a single string, or null",
  "follow_up_date": "YYYY-MM-DD computed from today ({today_str}), or null",
  "prescribed_medicines": [
    {{
      "medicine_name": "standard English/generic medicine name",
      "type": "Tablet | Capsule | Syrup | Injection | Drops | Cream | Ointment | Inhaler | Powder | Gel | Patch | Suppository | Other",
      "dosage": "strength e.g. 500mg, or empty string",
      "frequency": "1-0-1 form or natural language, or empty string",
      "duration": "e.g. 5 days, 1 week, or empty string",
      "timing": "Before food | After food | With food | Empty stomach | At bedtime | As needed | empty string",
      "notes": "special instructions in English, or empty string"
    }}
  ],
  "lab_tests": [
    {{
      "test_name": "full test name in English",
      "category": "Blood | Urine | Stool | Imaging | Microbiology | Cardiology | Pulmonary | Neurology | Pathology | Allergy | Other",
      "notes": "instructions in English e.g. fasting required, or empty string"
    }}
  ]
}}

=== SPEAKER-LABELLED TURNS (may be approximate) ===
{conversation or "(diarization unavailable — rely on the full transcript below)"}

=== FULL RAW TRANSCRIPT (authoritative source) ===
{raw_block or "(empty)"}

Reminder: read any language, OUTPUT English. Empty values are correct when not discussed. Today is {today_str}. Return JSON only."""

    try:
        raw = _call_gemini(prompt, response_mime_type="application/json")
        raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
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
    except Exception as e:
        log.warning("Medical extraction via Gemini failed: %s, raw: %s", e, raw if 'raw' in locals() else '')
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
        extraction = await loop.run_in_executor(
            _executor, partial(_extract_medical_info_sync, diarized, full_text)
        )
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
            "symptoms": extraction.get("symptoms") or [],
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
