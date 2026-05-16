from fastapi import APIRouter, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse
from app.middleware.auth import get_current_user, require_doctor, TokenData
import app.services.transcription_service as transcription_service

router = APIRouter(prefix="/api/transcription", tags=["transcription"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


@router.post("/analyze")
async def analyze_audio(
    request: Request,
    audio: UploadFile = File(...),
    patient_id: str = Form(...),
):
    """
    Accepts an audio file upload, transcribes it, diarizes speakers,
    extracts medical info, and returns auto-fill data for the prescription.
    """
    user: TokenData = await require_doctor(request)

    if not user.clinic_id:
        return _err("No clinic associated", 400)

    allowed_types = {"audio/m4a", "audio/mpeg", "audio/wav", "audio/mp4",
                     "audio/ogg", "audio/webm", "audio/x-m4a", "audio/aac",
                     "video/mp4"}
    ct = audio.content_type or ""
    if ct and ct not in allowed_types:
        return _err(f"Unsupported audio format: {ct}", 400)

    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) == 0:
            return _err("Empty audio file", 400)

        result = await transcription_service.process_audio(
            audio_bytes=audio_bytes,
            filename=audio.filename or "recording.m4a",
            doctor_id=user.user_id,
            patient_id=patient_id,
            clinic_id=user.clinic_id,
        )
        return _ok({"result": result}, 200)

    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(f"Transcription failed: {str(e)}", 500)


@router.get("/patient/{patient_id}")
async def get_patient_transcripts(patient_id: str, request: Request):
    """Get all transcripts for a specific patient."""
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        transcripts = await transcription_service.get_patient_transcripts(
            user.clinic_id, patient_id
        )
        return _ok({"transcripts": transcripts})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/{transcript_id}")
async def get_transcript(transcript_id: str, request: Request):
    """Get a single transcript by ID."""
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        transcript = await transcription_service.get_transcript(
            transcript_id, user.clinic_id
        )
        return _ok({"transcript": transcript})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)
