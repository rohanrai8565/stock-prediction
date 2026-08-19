import numpy as np
import pandas as pd
import pytest

from backend.app.services import stock_data
from backend.app.utils.errors import DataProviderError, InsufficientDataError, InvalidSymbolError


def make_raw(rows=200):
    idx = pd.bdate_range("2023-01-02", periods=rows)
    base = np.linspace(100, 150, rows)
    return pd.DataFrame(
        {
            "Open": base,
            "High": base + 1,
            "Low": base - 1,
            "Close": base + 0.5,
            "Adj Close": base + 0.4,
            "Volume": np.full(rows, 1_000_000.0),
        },
        index=pd.Index(idx, name="Date"),
    )


def test_normalize_symbol_accepts_any_valid_ticker():
    assert stock_data.normalize_symbol(" aapl ") == "AAPL"
    assert stock_data.normalize_symbol("reliance.ns") == "RELIANCE.NS"
    assert stock_data.normalize_symbol("brk-b") == "BRK-B"


@pytest.mark.parametrize("bad", ["", "   ", "!!!", "TOOOOOOOOOOOOLONG"])
def test_invalid_symbol_rejected(bad):
    with pytest.raises(InvalidSymbolError):
        stock_data.normalize_symbol(bad)


def test_standardize_normalizes_columns():
    frame = stock_data._standardize(make_raw(), "AAPL")
    assert list(frame.columns) == ["date", "open", "high", "low", "close", "volume", "adj_close"]
    assert frame["date"].is_monotonic_increasing
    assert len(frame) == 200


def test_standardize_handles_multiindex_columns():
    raw = make_raw()
    raw.columns = pd.MultiIndex.from_product([raw.columns, ["AAPL"]])
    frame = stock_data._standardize(raw, "AAPL")
    assert "close" in frame.columns and len(frame) == 200


def test_load_success(monkeypatch):
    monkeypatch.setattr(stock_data, "_load_yfinance", lambda *a, **k: make_raw())
    result = stock_data.StockDataService().load("AAPL", min_rows=50)
    assert result.rows == 200 and result.provider == "yfinance"


def test_empty_response_falls_back_then_reports_provider_error(monkeypatch):
    monkeypatch.setattr(stock_data, "_load_yfinance", lambda *a, **k: pd.DataFrame())
    monkeypatch.setattr(stock_data, "_load_stooq", lambda *a, **k: pd.DataFrame())
    monkeypatch.setattr(stock_data, "symbol_probably_exists", lambda s: True)
    with pytest.raises(DataProviderError) as exc:
        stock_data.StockDataService().load("AAPL")
    # A temporary failure must NOT be reported as a delisting.
    assert "delisted" not in str(exc.value).lower()
    assert "temporary" in str(exc.value).lower()


def test_unknown_symbol_reported_as_invalid(monkeypatch):
    monkeypatch.setattr(stock_data, "_load_yfinance", lambda *a, **k: pd.DataFrame())
    monkeypatch.setattr(stock_data, "_load_stooq", lambda *a, **k: pd.DataFrame())
    monkeypatch.setattr(stock_data, "symbol_probably_exists", lambda s: False)
    with pytest.raises(InvalidSymbolError):
        stock_data.StockDataService().load("ZZZZ9")


def test_fallback_provider_used_when_primary_fails(monkeypatch):
    monkeypatch.setattr(
        stock_data, "_load_yfinance", lambda *a, **k: (_ for _ in ()).throw(DataProviderError("boom"))
    )
    monkeypatch.setattr(stock_data, "_load_stooq", lambda *a, **k: make_raw())
    result = stock_data.StockDataService().load("AAPL", min_rows=50)
    assert result.provider == "stooq"


def test_insufficient_rows(monkeypatch):
    monkeypatch.setattr(stock_data, "_load_yfinance", lambda *a, **k: make_raw(30))
    with pytest.raises(InsufficientDataError):
        stock_data.StockDataService().load("AAPL", min_rows=120)


def test_retry_retries_and_succeeds():
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("no timezone found")
        return make_raw(10)

    frame = stock_data._retry(flaky, "flaky")
    assert calls["n"] == 3 and len(frame) == 10
