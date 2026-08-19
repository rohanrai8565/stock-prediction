"""Environment-driven configuration with validation.

Loads .env, coerces types, and fails with actionable messages instead of
cryptic KeyErrors. Never contains hard-coded credentials.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import List

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")

VALID_DATA_PROVIDERS = {"yfinance", "stooq"}
VALID_NEWS_PROVIDERS = {"mock", "newsapi"}


class ConfigError(RuntimeError):
    """Raised when environment configuration is invalid."""


def _str(key: str, default: str = "") -> str:
    return (os.getenv(key) or default).strip()


def _int(key: str, default: int) -> int:
    raw = _str(key)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ConfigError(f"{key} must be an integer, got {raw!r}") from exc


def _float(key: str, default: float) -> float:
    raw = _str(key)
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ConfigError(f"{key} must be a number, got {raw!r}") from exc


def _bool(key: str, default: bool) -> bool:
    raw = _str(key).lower()
    if not raw:
        return default
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise ConfigError(f"{key} must be a boolean-like value, got {raw!r}")


def _date(key: str, default: str) -> date:
    raw = _str(key, default)
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ConfigError(f"{key} must be YYYY-MM-DD, got {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    data_provider: str
    stock_api_key: str
    news_provider: str
    news_api_key: str
    stock_symbol: str
    start_date: date
    end_date: date
    lookback: int
    prediction_horizon: int
    epochs: int
    batch_size: int
    lstm_units: int
    dropout: float
    learning_rate: float
    validation_split: float
    test_split: float
    use_sentiment: bool
    model_dir: Path
    database_url: str
    log_level: str
    warnings: List[str] = field(default_factory=list)

    @property
    def persistence_enabled(self) -> bool:
        return bool(self.database_url)


def _load() -> Settings:
    warnings: List[str] = []

    data_provider = _str("DATA_PROVIDER", "yfinance").lower()
    if data_provider not in VALID_DATA_PROVIDERS:
        raise ConfigError(
            f"DATA_PROVIDER={data_provider!r} is not supported. "
            f"Choose one of: {sorted(VALID_DATA_PROVIDERS)}"
        )

    stock_api_key = _str("STOCK_API_KEY")
    # yfinance is keyless: never require STOCK_API_KEY for it.
    if data_provider != "yfinance" and not stock_api_key:
        warnings.append(
            f"DATA_PROVIDER={data_provider} may require STOCK_API_KEY, which is empty."
        )

    news_provider = _str("NEWS_PROVIDER", "mock").lower()
    if news_provider not in VALID_NEWS_PROVIDERS:
        raise ConfigError(
            f"NEWS_PROVIDER={news_provider!r} is not supported. "
            f"Choose one of: {sorted(VALID_NEWS_PROVIDERS)}"
        )
    news_api_key = _str("NEWS_API_KEY")
    if news_provider == "newsapi" and not news_api_key:
        raise ConfigError(
            "NEWS_PROVIDER=newsapi requires NEWS_API_KEY. Set it in .env "
            "or switch to NEWS_PROVIDER=mock for development."
        )

    start_date = _date("START_DATE", "2022-01-01")
    end_date = _date("END_DATE", date.today().isoformat())
    if start_date >= end_date:
        raise ConfigError(f"START_DATE ({start_date}) must be before END_DATE ({end_date}).")

    lookback = _int("LOOKBACK", 60)
    if lookback < 5:
        raise ConfigError("LOOKBACK must be >= 5.")
    horizon = _int("PREDICTION_HORIZON", 1)
    if horizon < 1:
        raise ConfigError("PREDICTION_HORIZON must be >= 1.")

    validation_split = _float("VALIDATION_SPLIT", 0.1)
    test_split = _float("TEST_SPLIT", 0.15)
    for name, value in (("VALIDATION_SPLIT", validation_split), ("TEST_SPLIT", test_split)):
        if not 0.0 < value < 0.5:
            raise ConfigError(f"{name} must be between 0 and 0.5, got {value}")

    dropout = _float("DROPOUT", 0.2)
    if not 0.0 <= dropout < 1.0:
        raise ConfigError("DROPOUT must be in [0, 1).")

    model_dir = PROJECT_ROOT / _str("MODEL_DIR", "models")
    model_dir.mkdir(parents=True, exist_ok=True)

    return Settings(
        data_provider=data_provider,
        stock_api_key=stock_api_key,
        news_provider=news_provider,
        news_api_key=news_api_key,
        stock_symbol=_str("STOCK_SYMBOL", "AAPL").upper(),
        start_date=start_date,
        end_date=end_date,
        lookback=lookback,
        prediction_horizon=horizon,
        epochs=_int("EPOCHS", 50),
        batch_size=_int("BATCH_SIZE", 32),
        lstm_units=_int("LSTM_UNITS", 64),
        dropout=dropout,
        learning_rate=_float("LEARNING_RATE", 0.001),
        validation_split=validation_split,
        test_split=test_split,
        use_sentiment=_bool("USE_SENTIMENT", True),
        model_dir=model_dir,
        database_url=_str("DATABASE_URL"),
        log_level=_str("LOG_LEVEL", "INFO").upper(),
        warnings=warnings,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return _load()
