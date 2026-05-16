"""
Medical Conversation Analyzer
-------------------------------
1. Transcribes audio using Groq Whisper (verbose_json for timestamps)
2. Diarizes speakers (Doctor vs Patient) using LLaMA via Groq
3. Extracts structured medical info (symptoms, diagnosis, medicines) as JSON
"""

import os
import json
import re
from groq import Groq

# ── Config ────────────────────────────────────────────────────────────────────
AUDIO_FILE   = "audio.m4a"          # change path as needed
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "YOUR_API_KEY_HERE")

WHISPER_MODEL = "whisper-large-v3-turbo"
LLAMA_MODEL   = "meta-llama/llama-4-scout-17b-16e-instruct"

client = Groq(api_key=GROQ_API_KEY)


# ── Step 1: Transcribe with timestamps ───────────────────────────────────────
def transcribe_audio(filepath: str) -> dict:
    """Return verbose Whisper transcription (text + segments with timestamps)."""
    print(f"[1/3] Transcribing: {filepath}")
    with open(filepath, "rb") as f:
        result = client.audio.transcriptions.create(
            file=(os.path.basename(filepath), f.read()),
            model=WHISPER_MODEL,
            temperature=0,
            response_format="verbose_json",
        )
    return result


# ── Step 2: Diarize speakers ──────────────────────────────────────────────────
def diarize_transcript(segments: list) -> list:
    """
    Use LLaMA to label each segment as Doctor or Patient.
    Returns a list of dicts: [{start, end, speaker, text}, ...]
    """
    print("[2/3] Identifying speakers (Doctor / Patient)…")

    # Build a numbered segment list for the prompt
    numbered = "\n".join(
        f"[{i}] ({seg.start:.1f}s–{seg.end:.1f}s): {seg.text.strip()}"
        for i, seg in enumerate(segments)
    )

    prompt = f"""You are analyzing a recorded medical consultation between a doctor and a patient.

Below are numbered speech segments with timestamps extracted from the audio.
Your task: for each segment, decide whether the speaker is "Doctor" or "Patient".

Rules:
- A Doctor typically asks diagnostic questions, explains diagnoses, prescribes medicines, gives medical advice.
- A Patient typically describes their symptoms, answers questions about how they feel, asks about treatment.
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
    # Strip markdown fences if present
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()

    try:
        labels = json.loads(raw)
    except json.JSONDecodeError:
        print("  ⚠ Could not parse speaker labels JSON; defaulting all to 'Unknown'")
        labels = [{"index": i, "speaker": "Unknown"} for i in range(len(segments))]

    label_map = {item["index"]: item["speaker"] for item in labels}

    diarized = []
    for i, seg in enumerate(segments):
        diarized.append({
            "start": round(seg.start, 2),
            "end":   round(seg.end, 2),
            "speaker": label_map.get(i, "Unknown"),
            "text":  seg.text.strip(),
        })
    return diarized


# ── Step 3: Extract medical information ──────────────────────────────────────
def extract_medical_info(diarized: list) -> dict:
    """
    Use LLaMA to extract symptoms, diagnosis, and prescribed medicines
    from the diarized transcript. Returns a structured dict.
    """
    print("[3/3] Extracting medical information…")

    # Format transcript for the prompt
    conversation = "\n".join(
        f"{seg['speaker']} ({seg['start']}s): {seg['text']}"
        for seg in diarized
    )

    prompt = f"""You are a medical information extraction assistant.

Below is a diarized transcript of a doctor-patient consultation.
Extract the following and return ONLY valid JSON (no markdown, no explanation):

{{
  "patient_info": {{
    "name": "string or null",
    "age": "string or null",
    "gender": "string or null"
  }},
  "chief_complaint": "primary reason for visit in one sentence",
  "symptoms": [
    {{
      "symptom": "symptom name",
      "duration": "how long (if mentioned)",
      "severity": "mild/moderate/severe (if mentioned)",
      "details": "any additional description"
    }}
  ],
  "diagnosis": [
    {{
      "condition": "diagnosis name",
      "type": "primary/secondary/differential",
      "notes": "any notes from the doctor"
    }}
  ],
  "prescribed_medicines": [
    {{
      "name": "medicine name",
      "dosage": "dosage if mentioned",
      "frequency": "how often (e.g., twice daily)",
      "duration": "for how long",
      "instructions": "special instructions (e.g., after meals)"
    }}
  ],
  "follow_up": "follow-up instructions if any",
  "additional_notes": "any other relevant clinical notes"
}}

Use null for any field not mentioned. Extract ALL symptoms and medicines mentioned.

Transcript:
{conversation}"""

    completion = client.chat.completions.create(
        model=LLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_completion_tokens=2048,
    )

    raw = completion.choices[0].message.content.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"error": "Could not parse medical info JSON", "raw_output": raw}


# ── Main pipeline ─────────────────────────────────────────────────────────────
def analyze_medical_consultation(audio_path: str) -> dict:
    # Step 1 – Transcribe
    transcription = transcribe_audio(audio_path)
    segments = transcription.segments  # list of segment objects

    if not segments:
        print("  ⚠ No segments returned. Check audio file.")
        return {}

    # Step 2 – Diarize
    diarized = diarize_transcript(segments)

    # Step 3 – Extract medical info
    medical_info = extract_medical_info(diarized)

    # Combine everything into one output
    output = {
        "full_transcript": transcription.text,
        "diarized_transcript": diarized,
        "medical_extraction": medical_info,
    }

    return output


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    audio_path = os.path.join(os.path.dirname(__file__), AUDIO_FILE)

    if not os.path.exists(audio_path):
        print(f"ERROR: Audio file not found at '{audio_path}'")
        exit(1)

    result = analyze_medical_consultation(audio_path)

    # Pretty-print to console
    print("\n" + "="*60)
    print("FULL TRANSCRIPT")
    print("="*60)
    print(result.get("full_transcript", ""))

    print("\n" + "="*60)
    print("DIARIZED TRANSCRIPT (Doctor / Patient)")
    print("="*60)
    for seg in result.get("diarized_transcript", []):
        print(f"[{seg['start']}s] {seg['speaker']:8s}: {seg['text']}")

    print("\n" + "="*60)
    print("MEDICAL EXTRACTION (JSON)")
    print("="*60)
    print(json.dumps(result.get("medical_extraction", {}), indent=2))

    # Save to file
    output_path = os.path.join(os.path.dirname(__file__), "medical_report.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Full report saved to: {output_path}")
