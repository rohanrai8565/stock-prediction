"""Preprocessing: cleaning, chronological splitting, leak-free scaling, sequences."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

from backend.app.utils.errors import InsufficientDataError
from backend.app.utils.logging import get_logger

logger = get_logger(__name__)


def clean_market_frame(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["date"] = pd.to_datetime(out["date"], errors="coerce")
    out = out.dropna(subset=["date"])
    out = out.drop_duplicates(subset=["date"]).sort_values("date").reset_index(drop=True)
    numeric_cols = [c for c in out.columns if c != "date"]
    for col in numeric_cols:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    # Forward fill only (never backward: that would import future information).
    out[numeric_cols] = out[numeric_cols].ffill()
    out = out.dropna(subset=["close"]).reset_index(drop=True)
    return out


def drop_warmup_rows(frame: pd.DataFrame, feature_columns: List[str]) -> pd.DataFrame:
    """Remove leading rows where indicators are not yet defined."""
    out = frame.dropna(subset=feature_columns).reset_index(drop=True)
    logger.info("Dropped %d warm-up rows", len(frame) - len(out))
    return out


@dataclass
class SplitIndex:
    train_end: int
    val_end: int
    total: int


def chronological_split(n_rows: int, validation_split: float, test_split: float) -> SplitIndex:
    """Chronological split. NEVER shuffle time series before splitting."""
    test_size = int(round(n_rows * test_split))
    val_size = int(round(n_rows * validation_split))
    train_end = n_rows - test_size - val_size
    if train_end <= 0:
        raise InsufficientDataError(
            f"Not enough rows ({n_rows}) for the configured splits."
        )
    return SplitIndex(train_end=train_end, val_end=train_end + val_size, total=n_rows)


def make_sequences(
    features: np.ndarray, target: np.ndarray, lookback: int, horizon: int = 1
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """X[t-lookback:t] -> y[t + horizon - 1]. Returns (X, y, target_row_index)."""
    x_list, y_list, idx_list = [], [], []
    last = len(features) - horizon
    for end in range(lookback, last + 1):
        x_list.append(features[end - lookback : end])
        target_row = end + horizon - 1
        y_list.append(target[target_row])
        idx_list.append(target_row)
    if not x_list:
        raise InsufficientDataError(
            f"Cannot build sequences: need > {lookback + horizon} rows, got {len(features)}."
        )
    return np.asarray(x_list, dtype="float32"), np.asarray(y_list, dtype="float32"), np.asarray(idx_list)


@dataclass
class PreparedData:
    x_train: np.ndarray
    y_train: np.ndarray
    x_val: np.ndarray
    y_val: np.ndarray
    x_test: np.ndarray
    y_test: np.ndarray
    test_dates: pd.Series
    test_prev_close: np.ndarray
    feature_scaler: MinMaxScaler
    target_scaler: MinMaxScaler
    feature_columns: List[str]
    n_rows: int
    last_window: np.ndarray  # most recent lookback window, scaled -> live prediction


def prepare_dataset(
    frame: pd.DataFrame,
    feature_columns: List[str],
    lookback: int,
    horizon: int,
    validation_split: float,
    test_split: float,
    target_column: str = "close",
) -> PreparedData:
    data = drop_warmup_rows(clean_market_frame(frame), feature_columns)
    n = len(data)
    split = chronological_split(n, validation_split, test_split)

    features = data[feature_columns].to_numpy(dtype="float64")
    target = data[[target_column]].to_numpy(dtype="float64")

    # Scalers fitted on TRAINING ROWS ONLY -> no leakage from val/test.
    feature_scaler = MinMaxScaler().fit(features[: split.train_end])
    target_scaler = MinMaxScaler().fit(target[: split.train_end])
    features_scaled = feature_scaler.transform(features)
    target_scaled = target_scaler.transform(target).ravel()

    x_all, y_all, target_idx = make_sequences(features_scaled, target_scaled, lookback, horizon)

    train_mask = target_idx < split.train_end
    val_mask = (target_idx >= split.train_end) & (target_idx < split.val_end)
    test_mask = target_idx >= split.val_end

    prev_close = data[target_column].shift(horizon).to_numpy(dtype="float64")
    last_window = features_scaled[-lookback:]

    return PreparedData(
        x_train=x_all[train_mask],
        y_train=y_all[train_mask],
        x_val=x_all[val_mask],
        y_val=y_all[val_mask],
        x_test=x_all[test_mask],
        y_test=y_all[test_mask],
        test_dates=data["date"].iloc[target_idx[test_mask]].reset_index(drop=True),
        test_prev_close=prev_close[target_idx[test_mask]],
        feature_scaler=feature_scaler,
        target_scaler=target_scaler,
        feature_columns=list(feature_columns),
        n_rows=n,
        last_window=last_window.astype("float32"),
    )
