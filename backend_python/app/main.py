import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

from app.config.database import connect_db, close_db
from app.config.settings import settings
from app.routes import (
    auth, wallet, clinic, connection, data,
    notification, analytics, transcription, admin,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="PrescoPad API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — never combine wildcard origin with credentials. In production, fail
# fast if origins weren't configured.
_origins = settings.allowed_origins_list
_allow_credentials = True
if _origins == ["*"]:
    if settings.NODE_ENV == "production":
        log.error("ALLOWED_ORIGINS missing in production; refusing wildcard")
        _origins = []
    else:
        _allow_credentials = False  # browsers reject *+credentials anyway

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth.router)
app.include_router(wallet.router)
app.include_router(clinic.router)
app.include_router(connection.router)
app.include_router(data.router)
app.include_router(notification.router)
app.include_router(analytics.router)
app.include_router(transcription.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    return {"success": True, "message": "PrescoPad API is running", "version": "2.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    exc_str = str(exc).lower()
    log.exception("Unhandled exception on %s %s", request.method, request.url.path)
    if "connection pool paused" in exc_str or "autoreconnect" in exc_str or "serverselectiontimeout" in exc_str:
        return JSONResponse(
            status_code=503,
            content={"success": False, "message": "Database temporarily unavailable, please retry"},
        )
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error"},
    )
