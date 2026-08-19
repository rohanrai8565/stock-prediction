from __future__ import annotations

from fastapi import APIRouter

from ..config.settings import get_settings
from ..models import db
from ..services.prediction import PredictionService

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
def health():
    settings = get_settings()
    return {
        "status": "ok",
        "data_provider": settings.data_provider,
        "news_provider": settings.news_provider,
        "sentiment_enabled": settings.use_sentiment,
        "persistence_enabled": db.is_enabled(),
        "trained_models": [m["name"] for m in PredictionService(settings).available_models()],
        "warnings": settings.warnings,
    }
