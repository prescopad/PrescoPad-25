import asyncio
import logging

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

from app.config.database import connect_db, close_db
from app.config.settings import settings
from app.routes import (
    auth, wallet, clinic, connection, data,
    notification, analytics, admin,
)

KEEPALIVE_INTERVAL_SECONDS = 14 * 60  # 14 minutes — keeps Render free-tier awake


async def _keepalive_loop():
    """Ping our own /api/health every 14 minutes so Render never idles us out."""
    await asyncio.sleep(60)  # wait for server to fully start before first ping
    while True:
        try:
            base = f"http://localhost:{settings.PORT}"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{base}/api/health")
            log.info("Keep-alive ping: %s", resp.status_code)
        except Exception as exc:
            log.warning("Keep-alive ping failed: %s", exc)
        await asyncio.sleep(KEEPALIVE_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    task = asyncio.create_task(_keepalive_loop())
    yield
    task.cancel()
    await close_db()


app = FastAPI(
    title="PrescoPad API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — never combine wildcard origin with credentials. If no specific allowed
# origins are configured, default to allowing all origins without credentials.
_origins = settings.allowed_origins_list
_allow_credentials = True
if not _origins or _origins == ["*"]:
    _origins = ["*"]
    _allow_credentials = False

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
