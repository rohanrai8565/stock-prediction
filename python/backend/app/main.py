"""FastAPI application entry point.

Run:  uvicorn backend.app.main:app --reload --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config.settings import ConfigError, get_settings
from .models import db
from .routes import health, predictions, stocks
from .utils.errors import AppError
from .utils.logging import get_logger, setup_logging

try:
    settings = get_settings()
except ConfigError as exc:  # fail fast with a readable message
    raise SystemExit(f"Configuration error: {exc}") from exc

setup_logging(settings.log_level)
logger = get_logger("api")

app = FastAPI(
    title="AI Stock Prediction API",
    description="LSTM price forecasting fused with financial news sentiment.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(stocks.router)
app.include_router(predictions.router)


@app.on_event("startup")
def on_startup() -> None:
    for warning in settings.warnings:
        logger.warning(warning)
    try:
        db.init_db()
    except Exception as exc:
        logger.error("Database initialisation failed (continuing without persistence): %s", exc)


@app.exception_handler(AppError)
def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.exception_handler(Exception)
def unhandled_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


@app.get("/")
def root():
    return {"service": "AI Stock Prediction API", "docs": "/docs", "health": "/api/health"}
