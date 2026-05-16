"""
Medical Transcription Service
Receives audio bytes → Groq Whisper transcription → LLaMA speaker diarization
→ LLaMA medical extraction → returns structured prescription data + transcript
"""
import os
import json
import re
from datetime import datetime, timezone
from bson import ObjectId
from groq import Groq
from app.config.settings import settings
from app.config.database import get_db
from app.models.common import serialize_doc

WHISPER_MODEL = "whisper-large-v3-turbo"
LLAMA_MODEL   = "meta-llama/llama-4-scout-17b-16e-instruct"


def _groq_client() -> Groq:
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not configured")
    return Groq(api_key=settings.GROQ_API_KEY)


# ── Step 1: Transcribe ────────────────────────────────────────────────────────

def _transcribe(audio_bytes: bytes, filename: str) -> object:
    client = _groq_client()
    result = client.audio.transcriptions.create(
        file=(filename, audio_bytes),
        model=WHISPER_MODEL,
        temperature=0,
        response_format="verbose_json",
    )
    return result


# ── Step 2: Diarize speakers ──────────────────────────────────────────────────

def _diarize(segments: list, client: Groq) -> list:
    if not segments:
        return []

    numbered = "\n".join(
        f"[{i}] ({seg.start:.1f}s–{seg.end:.1f}s): {seg.text.strip()}"
        for i, seg in enumerate(segments)
    )

    prompt = f"""You are analyzing a recorded medical consultation between a doctor and a patient.

Below are numbered speech segments with timestamps extracted from the audio.
Your task: for each segment, decide whether the speaker is "Doctor" or "Patient".

Rules:
- A Doctor typically asks diagnostic questions, explains diagnoses, prescribes medicines, gives medical advice.
- A Patient typically describes symptoms, answers questions, asks about treatment.
- Use conversational context and turn-taking to infer speaker identity.
- Return ONLY valid JSON — an array where each element has: "index" (int), "speaker" (string: "Doctor" or "Patient").

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

def _extract_medical_info(diarized: list, client: Groq) -> dict:
    conversation = "\n".join(
        f"{seg['speaker']} ({seg['start']}s): {seg['text']}"
        for seg in diarized
    )

    prompt = f"""You are a medical information extraction assistant for an Indian clinic.

Below is a diarized transcript of a doctor-patient consultation.
Extract the following and return ONLY valid JSON (no markdown, no explanation):

{{
  "chief_complaint": "primary reason for visit in one sentence or null",
  "diagnosis": "primary diagnosis as a string, or null",
  "symptoms": ["list of symptom strings mentioned"],
  "advice": "doctor's advice to patient as a string, or null",
  "follow_up_date": "follow-up date if mentioned as YYYY-MM-DD or null",
  "prescribed_medicines": [
    {{
      "medicine_name": "exact medicine name",
      "type": "Tablet or Capsule or Syrup or Injection or Drops or Cream or Ointment or Inhaler or Powder or Gel or Patch or Suppository or Other",
      "dosage": "dosage if mentioned (e.g. 500mg) or empty string",
      "frequency": "frequency pattern (e.g. 1-0-1, 1-1-1, twice daily) or empty string",
      "duration": "duration (e.g. 5 days, 1 week) or empty string",
      "timing": "Before food or After food or With food or Empty stomach or At bedtime or As needed — or empty string",
      "notes": "any special instructions or empty string"
    }}
  ],
  "lab_tests": [
    {{
      "test_name": "test name",
      "category": "Blood or Urine or Stool or Imaging or Microbiology or Cardiology or Pulmonary or Neurology or Pathology or Allergy or Other",
      "notes": "any special instructions or empty string"
    }}
  ]
}}

Use null for any optional field not mentioned. Extract ALL medicines and tests mentioned.

Transcript:
{conversation}"""

    completion = client.chat.completions.create(
        model=LLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_completion_tokens=3000,
    )
    raw = completion.choices[0].message.content.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"error": "Could not parse extraction", "raw": raw}


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def process_audio(
    audio_bytes: bytes,
    filename: str,
    doctor_id: str,
    patient_id: str,
    clinic_id: str,
) -> dict:
    client = _groq_client()

    # 1. Transcribe
    transcription = _transcribe(audio_bytes, filename)
    segments = getattr(transcription, "segments", [])
    full_text = getattr(transcription, "text", "")

    # 2. Diarize
    diarized = _diarize(segments, client)

    # 3. Extract medical info
    extraction = _extract_medical_info(diarized, client) if diarized else {}

    # 4. Persist transcript to MongoDB
    db = get_db()
    doc = {
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "clinic_id": clinic_id,
        "full_transcript": full_text,
        "diarized_transcript": diarized,
        "medical_extraction": extraction,
        "audio_duration_seconds": (
            round(diarized[-1]["end"], 1) if diarized else 0
        ),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.transcripts.insert_one(doc)
    transcript_id = str(result.inserted_id)

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
                for m in extraction.get("prescribed_medicines", [])
            ],
            "lab_tests": [
                {
                    "test_name": t.get("test_name", ""),
                    "category": t.get("category", "Other"),
                    "notes": t.get("notes", ""),
                }
                for t in extraction.get("lab_tests", [])
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
