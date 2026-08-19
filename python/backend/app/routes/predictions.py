from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query

from ..config.settings import get_settings
from ..models import db
from ..schemas.api import PredictRequest
from ..services.prediction import PredictionService
from ..utils.errors import AppError
from ..utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api", tags=["predictions"])


@router.post("/predict")
def predict(payload: PredictRequest):
    try:
        result = PredictionService().predict(payload.symbol, payload.model_name)
    except AppError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except Exception as exc:  # never leak stack traces
        logger.exception("Unexpected prediction failure")
        raise HTTPException(status_code=500, detail="Prediction failed unexpectedly.") from exc
    try:
        db.save_prediction(result)
    except Exception as exc:
        logger.warning("Could not persist prediction: %s", exc)
    return result


@router.get("/predictions/{symbol}")
def prediction_history(symbol: str, limit: int = Query(50, ge=1, le=200)):
    records = db.recent_predictions(symbol, limit)
    return {
        "symbol": symbol.upper(),
        "persistence_enabled": db.is_enabled(),
        "count": len(records),
        "predictions": records,
    }


@router.get("/model/performance")
def performance(symbol: str | None = None):
    settings = get_settings()
    filename = (
        f"evaluation_{symbol.upper().replace('.', '_')}.json" if symbol else "evaluation_latest.json"
    )
    path = settings.model_dir / filename
    if not path.exists():
        return {
            "message": "No evaluation report found - no model has been trained yet. Run: python train_model.py",
            "models": [],
            "not_trained": [{"name": "all", "reason": "not trained"}],
        }
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        logger.exception("Corrupt evaluation report")
        raise HTTPException(status_code=500, detail="Evaluation report is unreadable.") from exc
