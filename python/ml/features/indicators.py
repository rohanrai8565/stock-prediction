"""Technical indicators. All are causal: value at row t uses only rows <= t."""
from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd

INDICATOR_COLUMNS: List[str] = [
    "sma_10", "sma_20", "sma_50", "ema_12", "ema_26",
    "rsi_14", "macd", "macd_signal", "macd_hist",
    "bb_upper", "bb_lower", "bb_width",
    "daily_return", "volatility_20", "momentum_10", "volume_change",
]


def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=window).mean()


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False, min_periods=span).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    return (100 - (100 / (1 + rs))).astype(float).fillna(50.0)


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    macd_line = ema(series, fast) - ema(series, slow)
    signal_line = macd_line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return macd_line, signal_line, macd_line - signal_line


def bollinger(series: pd.Series, window: int = 20, num_std: float = 2.0):
    mid = sma(series, window)
    std = series.rolling(window=window, min_periods=window).std()
    upper = mid + num_std * std
    lower = mid - num_std * std
    width = (upper - lower) / mid.replace(0.0, np.nan)
    return upper, lower, width


def add_indicators(frame: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of frame with indicator columns appended."""
    if "close" not in frame.columns:
        raise ValueError("frame must contain a 'close' column")
    out = frame.sort_values("date").reset_index(drop=True).copy()
    close = out["close"].astype(float)

    out["sma_10"] = sma(close, 10)
    out["sma_20"] = sma(close, 20)
    out["sma_50"] = sma(close, 50)
    out["ema_12"] = ema(close, 12)
    out["ema_26"] = ema(close, 26)
    out["rsi_14"] = rsi(close, 14)
    macd_line, signal_line, hist = macd(close)
    out["macd"], out["macd_signal"], out["macd_hist"] = macd_line, signal_line, hist
    upper, lower, width = bollinger(close)
    out["bb_upper"], out["bb_lower"], out["bb_width"] = upper, lower, width
    out["daily_return"] = close.pct_change()
    out["volatility_20"] = out["daily_return"].rolling(20, min_periods=20).std()
    out["momentum_10"] = close - close.shift(10)
    out["volume_change"] = out["volume"].astype(float).pct_change().replace([float("inf"), float("-inf")], 0.0)
    return out
