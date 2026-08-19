"""LSTM architecture + persistence (Keras 3 .keras format) with metadata."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np

from backend.app.utils.errors import ModelNotTrainedError
from backend.app.utils.logging import get_logger

logger = get_logger(__name__)


def build_lstm(
    input_shape: Tuple[int, int],
    units: int = 64,
    dropout: float = 0.2,
    learning_rate: float = 1e-3,
):
    from tensorflow import keras
    from tensorflow.keras import layers

    model = keras.Sequential(
        [
            layers.Input(shape=input_shape),
            layers.LSTM(units, return_sequences=True),
            layers.Dropout(dropout),
            layers.LSTM(max(units // 2, 8)),
            layers.Dropout(dropout),
            layers.Dense(max(units // 4, 8), activation="relu"),
            layers.Dense(1),
        ],
        name="lstm_price_forecaster",
    )
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="huber",
        metrics=["mae"],
    )
    return model


def training_callbacks(checkpoint_path: Path, patience: int = 10):
    from tensorflow import keras

    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    return [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=patience, restore_best_weights=True, verbose=1
        ),
        keras.callbacks.ModelCheckpoint(
            filepath=str(checkpoint_path), monitor="val_loss", save_best_only=True, verbose=0
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=max(patience // 2, 2), min_lr=1e-5, verbose=1
        ),
    ]


@dataclass
class ModelBundle:
    """Everything needed to reproduce a prediction from raw market data."""

    name: str
    feature_columns: List[str]
    lookback: int
    horizon: int
    symbol: str
    dataset_start: str
    dataset_end: str
    trained_at: str
    hyperparameters: Dict[str, Any]
    metrics: Dict[str, Any] = field(default_factory=dict)
    uses_sentiment: bool = False
    version: str = "1"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "symbol": self.symbol,
            "feature_columns": self.feature_columns,
            "lookback": self.lookback,
            "horizon": self.horizon,
            "dataset_period": {"start": self.dataset_start, "end": self.dataset_end},
            "trained_at": self.trained_at,
            "hyperparameters": self.hyperparameters,
            "metrics": self.metrics,
            "uses_sentiment": self.uses_sentiment,
        }


def model_paths(model_dir: Path, name: str) -> Dict[str, Path]:
    return {
        "model": model_dir / f"{name}.keras",
        "feature_scaler": model_dir / f"{name}_feature_scaler.joblib",
        "target_scaler": model_dir / f"{name}_target_scaler.joblib",
        "metadata": model_dir / f"{name}_metadata.json",
    }


def save_bundle(model_dir: Path, name: str, model, feature_scaler, target_scaler, bundle: ModelBundle) -> None:
    paths = model_paths(model_dir, name)
    model_dir.mkdir(parents=True, exist_ok=True)
    model.save(paths["model"])
    joblib.dump(feature_scaler, paths["feature_scaler"])
    joblib.dump(target_scaler, paths["target_scaler"])
    paths["metadata"].write_text(json.dumps(bundle.to_dict(), indent=2))
    logger.info("Saved %s -> %s", name, paths["model"])


def load_bundle(model_dir: Path, name: str):
    from tensorflow import keras

    paths = model_paths(model_dir, name)
    missing = [str(p) for p in paths.values() if not p.exists()]
    if missing:
        raise ModelNotTrainedError(
            f"Model '{name}' has not been trained yet (missing: {missing}). Run: python train_model.py"
        )
    model = keras.models.load_model(paths["model"], compile=False)
    feature_scaler = joblib.load(paths["feature_scaler"])
    target_scaler = joblib.load(paths["target_scaler"])
    metadata = json.loads(paths["metadata"].read_text())
    return model, feature_scaler, target_scaler, metadata


def list_trained_models(model_dir: Path) -> List[Dict[str, Any]]:
    results = []
    for meta_file in sorted(model_dir.glob("*_metadata.json")):
        try:
            results.append(json.loads(meta_file.read_text()))
        except Exception as exc:
            logger.warning("Unreadable metadata %s: %s", meta_file, exc)
    return results


def predict_scaled_window(model, window: np.ndarray, target_scaler) -> float:
    batch = np.asarray(window, dtype="float32")[None, ...]
    scaled = float(model.predict(batch, verbose=0).ravel()[0])
    return float(target_scaler.inverse_transform([[scaled]]).ravel()[0])
