import logging
import os
import tempfile

from fastapi import APIRouter, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse

from app.config.settings import settings
from app.middleware.auth import get_current_user, require_doctor, TokenData
import app.services.transcription_service as transcription_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcription", tags=["transcription"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


_ALLOWED_AUDIO_TYPES = {
    "audio/m4a", "audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg",
    "audio/webm", "audio/x-m4a", "audio/aac", "video/mp4",
}

# Stream the upload to disk in fixed-size chunks so a malicious client cannot
# OOM the worker by sending a multi-GB body. The limit is enforced incrementally.
_CHUNK = 1024 * 1024  # 1 MB


@router.post("/analyze")
async def analyze_audio(
    request: Request,
    audio: UploadFile = File(...),
    patient_id: str = Form(...),
    prescription_id: str | None = Form(default=None),
    queue_item_id: str | None = Form(default=None),
):
    """
    Accepts an audio file upload, transcribes it, diarizes speakers,
    extracts medical info, and returns auto-fill data for the prescription.
    """
    user: TokenData = await require_doctor(request)

    if not user.clinic_id:
        return _err("No clinic associated", 400)

    ct = audio.content_type or ""
    if ct and ct not in _ALLOWED_AUDIO_TYPES:
        return _err(f"Unsupported audio format: {ct}", 400)

    # Stream to a temp file so we never hold the whole body in memory.
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=os.path.splitext(audio.filename or "recording.m4a")[1] or ".m4a",
            delete=False,
        ) as tmp:
            tmp_path = tmp.name
            total = 0
            while True:
                chunk = await audio.read(_CHUNK)
                if not chunk:
                    break
                total += len(chunk)
                if total > settings.MAX_AUDIO_UPLOAD_BYTES:
                    return _err(
                        f"Audio file too large (max {settings.MAX_AUDIO_UPLOAD_BYTES // (1024 * 1024)} MB)",
                        413,
                    )
                tmp.write(chunk)

        if total == 0:
            return _err("Empty audio file", 400)

        log.info("Transcription analyze: %d bytes from doctor=%s patient=%s", total, user.user_id, patient_id)

        result = await transcription_service.process_audio_file(
            file_path=tmp_path,
            filename=audio.filename or "recording.m4a",
            doctor_id=user.user_id,
            patient_id=patient_id,
            clinic_id=user.clinic_id,
            prescription_id=prescription_id,
            queue_item_id=queue_item_id,
        )
        return _ok({"result": result}, 200)

    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        log.exception("Transcription pipeline failed")
        return _err(f"Transcription failed: {e}", 500)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


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
