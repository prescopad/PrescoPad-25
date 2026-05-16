from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.config.database import connect_db, close_db
from app.config.settings import settings
from app.routes import auth, wallet, clinic, connection, data, notification, analytics


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
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


@app.get("/api/health")
async def health():
    return {"success": True, "message": "PrescoPad API is running", "version": "2.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error"},
    )
