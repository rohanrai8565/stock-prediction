"""Robust historical stock data loading.

Key design decisions (these fix the reported yfinance failures):

* Every provider call is retried with exponential backoff + jitter. A single
  failed HTTP round trip NEVER produces a "delisted" verdict.
* yfinance's "possibly delisted; no timezone found" message is a *transport*
  symptom far more often than a real delisting. We therefore only raise
  InvalidSymbolError after (a) all retries failed AND (b) an independent
  symbol-existence probe also came back negative.
* The yfinance timezone cache lives under a writable temp dir, because a
  read-only/locked cache is a common root cause of the timezone error.
* MultiIndex columns (yfinance >= 0.2.51 with a single ticker) are flattened.
* Optional keyless fallback provider (Stooq) so training is not blocked by a
  Yahoo outage.
"""
from __future__ import annotations

import io
import random
import re
import tempfile
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Callable, List, Optional

import pandas as pd
import requests

from ..config.settings import Settings, get_settings
from ..utils.errors import (
    DataProviderError,
    EmptyDataError,
    InsufficientDataError,
    InvalidSymbolError,
)
from ..utils.logging import get_logger

logger = get_logger(__name__)

REQUIRED_COLUMNS = ["open", "high", "low", "close", "volume"]
SYMBOL_RE = re.compile(r"^[A-Z0-9]{1,10}([.\-][A-Z]{1,4})?$")
MAX_ATTEMPTS = 4
BASE_BACKOFF = 1.5
REQUEST_TIMEOUT = 20

# Suggestions only - the loader accepts ANY valid Yahoo Finance symbol.
SUGGESTED_SYMBOLS: List[dict] = [
    {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "exchange": "NASDAQ"},
    {"symbol": "TSLA", "name": "Tesla, Inc.", "exchange": "NASDAQ"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "exchange": "NSE"},
    {"symbol": "INFY.NS", "name": "Infosys Limited", "exchange": "NSE"},
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "exchange": "NSE"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "exchange": "NSE"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "exchange": "NSE"},
]


@dataclass(frozen=True)
class LoadResult:
    frame: pd.DataFrame
    symbol: str
    provider: str
    rows: int
    start: date
    end: date


def normalize_symbol(symbol: str) -> str:
    cleaned = (symbol or "").strip().upper()
    if not cleaned:
        raise InvalidSymbolError("Symbol must not be empty.")
    if not SYMBOL_RE.match(cleaned):
        raise InvalidSymbolError(
            f"'{symbol}' is not a valid ticker format. Example: AAPL or RELIANCE.NS"
        )
    return cleaned


def validate_dates(start: date, end: date) -> None:
    if start >= end:
        raise InvalidSymbolError(f"START_DATE ({start}) must be before END_DATE ({end}).")
    if start > date.today():
        raise InvalidSymbolError("START_DATE cannot be in the future.")


def _configure_yf_cache() -> None:
    """Point yfinance's tz cache at a writable dir (fixes 'no timezone found')."""
    try:
        import yfinance as yf

        cache_dir = Path(tempfile.gettempdir()) / "py-yfinance-cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        yf.set_tz_cache_location(str(cache_dir))
    except Exception as exc:  # pragma: no cover - depends on yfinance version
        logger.debug("Could not set yfinance tz cache location: %s", exc)


def _retry(fn: Callable[[], pd.DataFrame], label: str) -> pd.DataFrame:
    """Call fn with exponential backoff. Returns possibly-empty frame."""
    last_error: Optional[Exception] = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            frame = fn()
            if frame is not None and not frame.empty:
                return frame
            logger.warning("%s attempt %d/%d returned no rows.", label, attempt, MAX_ATTEMPTS)
        except Exception as exc:  # network, JSON decode, rate limit, tz cache...
            last_error = exc
            logger.warning("%s attempt %d/%d failed: %s", label, attempt, MAX_ATTEMPTS, exc)
        if attempt < MAX_ATTEMPTS:
            delay = BASE_BACKOFF ** attempt + random.uniform(0, 0.75)
            time.sleep(delay)
    if last_error is not None:
        raise DataProviderError(f"{label} failed after {MAX_ATTEMPTS} attempts: {last_error}")
    return pd.DataFrame()


def _flatten_columns(frame: pd.DataFrame, symbol: str) -> pd.DataFrame:
    if isinstance(frame.columns, pd.MultiIndex):
        levels = frame.columns.get_level_values(-1)
        if symbol in set(levels):
            frame = frame.xs(symbol, axis=1, level=-1)
        else:
            frame.columns = frame.columns.get_level_values(0)
    return frame


def _standardize(frame: pd.DataFrame, symbol: str) -> pd.DataFrame:
    frame = _flatten_columns(frame.copy(), symbol)
    frame = frame.rename(columns=lambda c: str(c).strip().lower().replace(" ", "_"))
    if "adj_close" not in frame.columns and "adjclose" in frame.columns:
        frame = frame.rename(columns={"adjclose": "adj_close"})
    frame = frame.reset_index()
    date_col = next(
        (c for c in frame.columns if str(c).lower() in {"date", "datetime", "index"}), None
    )
    if date_col is None:
        raise DataProviderError("Provider response contained no date column.")
    frame = frame.rename(columns={date_col: "date"})
    frame["date"] = pd.to_datetime(frame["date"], utc=True, errors="coerce").dt.tz_localize(None)
    frame = frame.dropna(subset=["date"])

    missing = [c for c in REQUIRED_COLUMNS if c not in frame.columns]
    if missing:
        raise DataProviderError(f"Provider response missing columns: {missing}")
    if "adj_close" not in frame.columns:
        frame["adj_close"] = frame["close"]

    keep = ["date", *REQUIRED_COLUMNS, "adj_close"]
    frame = frame[keep]
    for col in REQUIRED_COLUMNS + ["adj_close"]:
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    frame = frame.dropna(subset=["close"])
    frame = frame.drop_duplicates(subset=["date"]).sort_values("date").reset_index(drop=True)
    return frame


def symbol_probably_exists(symbol: str) -> bool:
    """Independent existence probe via Yahoo's search endpoint.

    Used ONLY to decide whether a total download failure means 'invalid symbol'
    or 'provider trouble'. Any error here returns True (benefit of the doubt).
    """
    try:
        response = requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": symbol, "quotesCount": 10, "newsCount": 0},
            headers={"User-Agent": "Mozilla/5.0 (compatible; stock-ai/1.0)"},
            timeout=REQUEST_TIMEOUT,
        )
        if response.status_code != 200:
            return True
        quotes = response.json().get("quotes") or []
        return any((q.get("symbol") or "").upper() == symbol.upper() for q in quotes)
    except Exception as exc:
        logger.debug("Symbol probe inconclusive for %s: %s", symbol, exc)
        return True


def _load_yfinance(symbol: str, start: date, end: date) -> pd.DataFrame:
    import yfinance as yf

    _configure_yf_cache()
    end_exclusive = end + timedelta(days=1)

    def download() -> pd.DataFrame:
        return yf.download(
            tickers=symbol,
            start=start.isoformat(),
            end=end_exclusive.isoformat(),
            interval="1d",
            auto_adjust=False,
            actions=False,
            progress=False,
            threads=False,
            timeout=REQUEST_TIMEOUT,
        )

    def history() -> pd.DataFrame:
        return yf.Ticker(symbol).history(
            start=start.isoformat(),
            end=end_exclusive.isoformat(),
            interval="1d",
            auto_adjust=False,
            timeout=REQUEST_TIMEOUT,
        )

    try:
        frame = _retry(download, f"yfinance.download({symbol})")
    except DataProviderError as exc:
        logger.warning("Falling back to Ticker.history for %s: %s", symbol, exc)
        frame = pd.DataFrame()
    if frame is None or frame.empty:
        frame = _retry(history, f"yfinance.Ticker({symbol}).history")
    return frame


def _load_stooq(symbol: str, start: date, end: date) -> pd.DataFrame:
    """Keyless CSV fallback provider (US tickers -> '<sym>.us')."""
    stooq_symbol = symbol.lower()
    if "." not in stooq_symbol:
        stooq_symbol = f"{stooq_symbol}.us"

    def fetch() -> pd.DataFrame:
        response = requests.get(
            "https://stooq.com/q/d/l/",
            params={
                "s": stooq_symbol,
                "d1": start.strftime("%Y%m%d"),
                "d2": end.strftime("%Y%m%d"),
                "i": "d",
            },
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        text = response.text.strip()
        if not text or text.lower().startswith("no data"):
            return pd.DataFrame()
        return pd.read_csv(io.StringIO(text))

    return _retry(fetch, f"stooq({stooq_symbol})")


class StockDataService:
    """Provider-agnostic loader."""

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()

    def search(self, query: str = "", limit: int = 10) -> List[dict]:
        query = (query or "").strip()
        if not query:
            return SUGGESTED_SYMBOLS[:limit]
        try:
            response = requests.get(
                "https://query2.finance.yahoo.com/v1/finance/search",
                params={"q": query, "quotesCount": limit, "newsCount": 0},
                headers={"User-Agent": "Mozilla/5.0 (compatible; stock-ai/1.0)"},
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            quotes = response.json().get("quotes") or []
            results = [
                {
                    "symbol": q.get("symbol"),
                    "name": q.get("shortname") or q.get("longname") or q.get("symbol"),
                    "exchange": q.get("exchDisp") or q.get("exchange") or "",
                }
                for q in quotes
                if q.get("symbol")
            ]
            if results:
                return results[:limit]
        except Exception as exc:
            logger.warning("Symbol search failed (%s); using local suggestions.", exc)
        needle = query.upper()
        return [s for s in SUGGESTED_SYMBOLS if needle in s["symbol"] or needle in s["name"].upper()][:limit]

    def load(
        self,
        symbol: Optional[str] = None,
        start: Optional[date] = None,
        end: Optional[date] = None,
        min_rows: int = 120,
    ) -> LoadResult:
        symbol = normalize_symbol(symbol or self.settings.stock_symbol)
        start = start or self.settings.start_date
        end = end or self.settings.end_date
        if isinstance(start, datetime):
            start = start.date()
        if isinstance(end, datetime):
            end = end.date()
        validate_dates(start, end)

        providers: List[tuple[str, Callable[[], pd.DataFrame]]] = []
        if self.settings.data_provider == "yfinance":
            providers = [
                ("yfinance", lambda: _load_yfinance(symbol, start, end)),
                ("stooq", lambda: _load_stooq(symbol, start, end)),
            ]
        else:
            providers = [
                ("stooq", lambda: _load_stooq(symbol, start, end)),
                ("yfinance", lambda: _load_yfinance(symbol, start, end)),
            ]

        errors: List[str] = []
        for name, loader in providers:
            logger.info("Loading %s from %s (%s -> %s)", symbol, name, start, end)
            try:
                raw = loader()
            except DataProviderError as exc:
                errors.append(f"{name}: {exc}")
                continue
            if raw is None or raw.empty:
                errors.append(f"{name}: empty response")
                continue
            frame = _standardize(raw, symbol)
            if frame.empty:
                errors.append(f"{name}: no usable rows after cleaning")
                continue
            if len(frame) < min_rows:
                raise InsufficientDataError(
                    f"{symbol} returned only {len(frame)} usable rows from {name}; "
                    f"at least {min_rows} are needed. Widen START_DATE/END_DATE."
                )
            logger.info("Loaded %d rows for %s from %s", len(frame), symbol, name)
            return LoadResult(
                frame=frame,
                symbol=symbol,
                provider=name,
                rows=len(frame),
                start=frame["date"].min().date(),
                end=frame["date"].max().date(),
            )

        detail = " | ".join(errors) or "no provider attempted"
        if not symbol_probably_exists(symbol):
            raise InvalidSymbolError(
                f"'{symbol}' does not look like a listed Yahoo Finance symbol. Details: {detail}"
            )
        raise DataProviderError(
            f"Could not load data for {symbol} right now (the symbol itself looks valid, "
            f"so this is most likely a temporary provider/network issue). Details: {detail}"
        )


def load_history(
    symbol: Optional[str] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    min_rows: int = 120,
) -> LoadResult:
    return StockDataService().load(symbol=symbol, start=start, end=end, min_rows=min_rows)
