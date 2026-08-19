"""Live prediction service: loads a saved bundle and forecasts the next close."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from ..config.settings import Settings, get_settings
from ..utils.errors import ModelNotTrainedError
from ..utils.logging import get_logger
from ml.models.lstm import list_trained_models, load_bundle
from ml.preprocessing.pipeline import clean_market_frame, drop_warmup_rows
from ml.training.pipeline import (
    MARKET_ONLY_NAME,
    MARKET_TECH_NAME,
    SENTIMENT_NAME,
    build_feature_frame,
)

logger = get_logger(__name__)
MODEL_PREFERENCE = [SENTIMENT_NAME, MARKET_TECH_NAME, MARKET_ONLY_NAME]


class PredictionService:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()

    def available_models(self) -> List[Dict[str, Any]]:
        return list_trained_models(self.settings.model_dir)

    def _resolve_model_name(self, requested: Optional[str]) -> str:
        trained = {m["name"] for m in self.available_models()}
        if requested:
            if requested not in trained:
                raise ModelNotTrainedError(
                    f"Model '{requested}' has not been trained. Run: python train_model.py"
                )
            return requested
        for name in MODEL_PREFERENCE:
            if name in trained:
                return name
        raise ModelNotTrainedError("No trained model found. Run: python train_model.py")

    def predict(self, symbol: str, model_name: Optional[str] = None) -> Dict[str, Any]:
        name = self._resolve_model_name(model_name)
        model, feature_scaler, target_scaler, metadata = load_bundle(self.settings.model_dir, name)

        frame, info = build_feature_frame(self.settings, symbol)
        features = [c for c in metadata["feature_columns"] if c in frame.columns]
        if len(features) != len(metadata["feature_columns"]):
            missing = set(metadata["feature_columns"]) - set(features)
            raise ModelNotTrainedError(
                f"Current data is missing features required by '{name}': {sorted(missing)}"
            )

        clean = drop_warmup_rows(clean_market_frame(frame), features)
        lookback = int(metadata["lookback"])
        if len(clean) < lookback:
            raise ModelNotTrainedError(
                f"Need at least {lookback} clean rows for prediction, got {len(clean)}."
            )
        window = feature_scaler.transform(clean[features].to_numpy(dtype="float64")[-lookback:])
        scaled = float(model.predict(window[None, ...].astype("float32"), verbose=0).ravel()[0])
        predicted = float(target_scaler.inverse_transform([[scaled]]).ravel()[0])

        current = float(clean["close"].iloc[-1])
        change = predicted - current
        return {
            "symbol": info["symbol"],
            "model": name,
            "model_trained_at": metadata.get("trained_at"),
            "as_of_date": clean["date"].iloc[-1].strftime("%Y-%m-%d"),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "horizon_days": int(metadata["horizon"]),
            "current_price": round(current, 4),
            "predicted_price": round(predicted, 4),
            "absolute_change": round(change, 4),
            "percent_change": round(change / current * 100, 4) if current else None,
            "direction": "UP" if change > 0 else ("DOWN" if change < 0 else "FLAT"),
            "test_metrics": metadata.get("metrics", {}),
            "disclaimer": (
                "Point estimate from a statistical model. Not investment advice; "
                "no accuracy guarantee is implied."
            ),
        }
