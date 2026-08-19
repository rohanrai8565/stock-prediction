"""Regression + directional evaluation, with an honest naive baseline."""
from __future__ import annotations

from typing import Dict, Optional, Sequence

import numpy as np


def _safe(value: float) -> Optional[float]:
    return None if value is None or not np.isfinite(value) else round(float(value), 6)


def regression_metrics(y_true: Sequence[float], y_pred: Sequence[float]) -> Dict[str, Optional[float]]:
    y_true = np.asarray(y_true, dtype="float64")
    y_pred = np.asarray(y_pred, dtype="float64")
    if y_true.size == 0 or y_true.size != y_pred.size:
        return {"mae": None, "mse": None, "rmse": None, "mape": None, "r2": None, "n": 0}
    error = y_pred - y_true
    mse = float(np.mean(error ** 2))
    denom = np.where(np.abs(y_true) < 1e-12, np.nan, y_true)
    mape = float(np.nanmean(np.abs(error / denom)) * 100)
    ss_res = float(np.sum(error ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else float("nan")
    return {
        "mae": _safe(np.mean(np.abs(error))),
        "mse": _safe(mse),
        "rmse": _safe(np.sqrt(mse)),
        "mape": _safe(mape),
        "r2": _safe(r2),
        "n": int(y_true.size),
    }


def directional_accuracy(
    y_true: Sequence[float], y_pred: Sequence[float], prev_close: Sequence[float]
) -> Optional[float]:
    y_true = np.asarray(y_true, dtype="float64")
    y_pred = np.asarray(y_pred, dtype="float64")
    prev = np.asarray(prev_close, dtype="float64")
    mask = np.isfinite(prev) & np.isfinite(y_true) & np.isfinite(y_pred)
    if mask.sum() == 0:
        return None
    actual_up = y_true[mask] > prev[mask]
    pred_up = y_pred[mask] > prev[mask]
    return _safe(np.mean(actual_up == pred_up) * 100)


def evaluate(
    y_true: Sequence[float], y_pred: Sequence[float], prev_close: Sequence[float]
) -> Dict[str, Optional[float]]:
    metrics = regression_metrics(y_true, y_pred)
    metrics["directional_accuracy"] = directional_accuracy(y_true, y_pred, prev_close)
    return metrics


def naive_baseline(prev_close: Sequence[float]) -> np.ndarray:
    """Previous-close baseline: the honest bar every model must beat."""
    return np.asarray(prev_close, dtype="float64")
