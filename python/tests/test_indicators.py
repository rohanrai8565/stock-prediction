import numpy as np
import pandas as pd

from ml.features.indicators import INDICATOR_COLUMNS, add_indicators, rsi, sma


def frame(rows=120):
    close = 100.0 + np.arange(rows) * 0.5  # fixed step: frame(100) is a prefix of frame(120)
    return pd.DataFrame(
        {
            "date": pd.bdate_range("2023-01-02", periods=rows),
            "open": close,
            "high": close + 1,
            "low": close - 1,
            "close": close,
            "adj_close": close,
            "volume": np.full(rows, 1e6),
        }
    )


def test_all_indicators_present():
    out = add_indicators(frame())
    for col in INDICATOR_COLUMNS:
        assert col in out.columns


def test_sma_is_causal():
    series = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
    result = sma(series, 3)
    assert pd.isna(result.iloc[1])
    assert result.iloc[2] == 2.0  # mean(1,2,3) - no future values used


def test_rsi_bounds_and_uptrend():
    out = add_indicators(frame())
    values = out["rsi_14"].dropna()
    assert values.between(0, 100).all()
    assert values.iloc[-1] > 60  # monotonic uptrend -> high RSI


def test_indicators_do_not_change_earlier_rows_when_data_is_appended():
    base = frame(100)
    extended = frame(120)
    a = add_indicators(base)["sma_20"].iloc[50]
    b = add_indicators(extended)["sma_20"].iloc[50]
    assert np.isclose(a, b)  # no look-ahead
