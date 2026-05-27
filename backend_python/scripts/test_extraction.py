"""Manual test: run a typed doctor-patient transcript through the REAL
extraction + autofill mapping (skips Whisper since we have no audio file),
and (by default) persist each result to the `transcripts` collection exactly
like a real consultation does.

Usage:
    python -m scripts.test_extraction                 # all cases, saved to DB
    python -m scripts.test_extraction --case 2        # one case, saved to DB
    python -m scripts.test_extraction --no-save       # run only, don't write DB
    python -m scripts.test_extraction --cleanup       # delete all test transcripts

This calls the live Groq LLaMA extraction, so it needs GROQ_API_KEY set.
Saved records are tagged with clinic_id="TEST_CLINIC" and is_test=True so they
are easy to find and remove.
"""
import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Windows consoles default to cp1252 and choke on Devanagari / arrows.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import certifi  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from app.config.settings import settings  # noqa: E402
from app.services.transcription_service import _extract_medical_info_sync  # noqa: E402

# Identifiers that mark a record as test-only so it can be filtered / cleaned up.
TEST_CLINIC_ID = "TEST_CLINIC"
TEST_DOCTOR_ID = "TEST_DOCTOR"
TEST_PATIENT_ID = "TEST_PATIENT"


def _get_db():
    client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )
    return client, client[settings.MONGODB_DB_NAME]


async def _save_transcript(case_id, case, diarized, full_text, extraction, autofill):
    client, db = _get_db()
    try:
        doc = {
            "doctor_id": TEST_DOCTOR_ID,
            "patient_id": f"{TEST_PATIENT_ID}_{case_id}",
            "clinic_id": TEST_CLINIC_ID,
            "prescription_id": None,
            "queue_item_id": None,
            "full_transcript": full_text,
            "diarized_transcript": diarized,
            "medical_extraction": extraction,
            "prescription_autofill": autofill,
            "audio_duration_seconds": len(case["turns"]),
            "is_test": True,
            "test_case_label": case["label"],
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.transcripts.insert_one(doc)
        print(f"  >> Saved to DB: transcripts/_id={result.inserted_id}")
        return str(result.inserted_id)
    finally:
        client.close()


async def _cleanup():
    client, db = _get_db()
    try:
        res = await db.transcripts.delete_many({"clinic_id": TEST_CLINIC_ID, "is_test": True})
        print(f"Deleted {res.deleted_count} test transcript(s).")
    finally:
        client.close()


# Each case is a list of (speaker, text) turns simulating Whisper diarized output.
CASES = {
    1: {
        "label": "Hinglish — fever + cough, Paracetamol + Azithromycin + CBC",
        "turns": [
            ("Doctor", "Aaiye baithiye. Kya taklif hai aapko?"),
            ("Patient", "Doctor sahab, do din se bukhar hai aur khaansi bhi ho rahi hai."),
            ("Doctor", "Bukhar kitna hai? Body pain bhi hai kya?"),
            ("Patient", "Haan, badan dard ho raha hai aur sar bhi dukh raha hai. Bukhar 101 ke aaspaas rehta hai."),
            ("Doctor", "Theek hai. Ye viral fever lag raha hai with throat infection. Main aapko paracetamol de raha hoon, "
                       "500 mg, din mein teen baar, khana khane ke baad, paanch din ke liye."),
            ("Doctor", "Aur ek antibiotic bhi likh raha hoon — Azithromycin 500, din mein ek baar, teen din."),
            ("Doctor", "Ek blood test karwa lijiye, CBC, taaki infection ka pata chale."),
            ("Doctor", "Aaram kariye, garam paani piyo, thanda mat khao. Agar teen din mein bukhar na utre to wapas aana."),
            ("Patient", "Theek hai doctor sahab, dhanyavaad."),
            ("Doctor", "Teen din baad follow-up ke liye aaiyega."),
        ],
    },
    2: {
        "label": "Marathi — acidity, Pantoprazole only, no lab test, no follow-up",
        "turns": [
            ("Doctor", "Bola, kaay traas hotoy?"),
            ("Patient", "Doctor, gelya aathvadyapasun chhatit jaljal hote, jevnanantar jasta vadhte."),
            ("Doctor", "He acidity sarkhe vatte. Tikhat ani tळlele padarth khane band kara."),
            ("Doctor", "Mi Pantoprazole 40 mg deto, roj sakali ek, upashi poti, don aathvade ghya."),
            ("Patient", "Theek aahe doctor."),
            ("Doctor", "Garaj nasel tar punha yenyachi garaj nahi."),
        ],
    },
    3: {
        "label": "English — nothing prescribed (should leave fields empty)",
        "turns": [
            ("Doctor", "How are you feeling today?"),
            ("Patient", "Much better doctor, the rash is almost gone."),
            ("Doctor", "Good. Looks like it has healed well. No medicine needed, just keep the area clean."),
            ("Patient", "Thank you."),
        ],
    },
}


def run(case_id: int, save: bool = True):
    case = CASES[case_id]
    print(f"\n=== CASE {case_id}: {case['label']} ===\n")

    diarized = [
        {"start": float(i), "end": float(i) + 1.0, "speaker": spk, "text": txt}
        for i, (spk, txt) in enumerate(case["turns"])
    ]
    full_text = " ".join(txt for _, txt in case["turns"])

    print("--- TRANSCRIPT ---")
    for spk, txt in case["turns"]:
        print(f"  {spk}: {txt}")

    print("\n--- RUNNING REAL GROQ EXTRACTION ---")
    extraction = _extract_medical_info_sync(diarized, full_text)

    # Mirror the exact autofill mapping from process_audio_file().
    meds = extraction.get("prescribed_medicines") or []
    tests = extraction.get("lab_tests") or []
    autofill = {
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
            for m in meds if m.get("medicine_name")
        ],
        "lab_tests": [
            {
                "test_name": t.get("test_name", ""),
                "category": t.get("category", "Other"),
                "notes": t.get("notes", ""),
            }
            for t in tests if t.get("test_name")
        ],
    }

    print("\n--- PRESCRIPTION FIELDS THAT WOULD BE FILLED ---")
    print(json.dumps(autofill, indent=2, ensure_ascii=False))

    print("\n--- FIELD-FILL SUMMARY ---")
    print(f"  Diagnosis     : {'FILLED → ' + autofill['diagnosis'] if autofill['diagnosis'] else 'EMPTY'}")
    print(f"  Advice        : {'FILLED' if autofill['advice'] else 'EMPTY'}")
    print(f"  Follow-up date: {autofill['follow_up_date'] or 'EMPTY'}")
    print(f"  Medicines     : {len(autofill['medicines'])}")
    for m in autofill["medicines"]:
        print(f"      - {m['medicine_name']} {m['dosage']} | {m['frequency']} | {m['duration']} | {m['timing']}")
    print(f"  Lab tests     : {len(autofill['lab_tests'])}")
    for t in autofill["lab_tests"]:
        print(f"      - {t['test_name']} ({t['category']})")

    if save:
        print("\n--- SAVING TO DATABASE ---")
        asyncio.run(_save_transcript(case_id, case, diarized, full_text, extraction, autofill))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--case", type=int, default=0, help="1, 2, 3, or 0 for all")
    p.add_argument("--no-save", action="store_true", help="Do not write results to the DB")
    p.add_argument("--cleanup", action="store_true", help="Delete all test transcripts and exit")
    args = p.parse_args()

    if args.cleanup:
        asyncio.run(_cleanup())
        sys.exit(0)

    save = not args.no_save
    if args.case == 0:
        for cid in CASES:
            run(cid, save=save)
    else:
        run(args.case, save=save)
