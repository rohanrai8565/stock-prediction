import numpy as np
import pandas as pd
import pytest

from backend.app.utils.errors import InsufficientDataError
from ml.features.indicators import add_indicators
from ml.preprocessing.pipeline import (
    chronological_split, clean_market_frame, make_sequences, prepare_dataset,
)


def frame(rows=400):
    rng = np.random.default_rng(7)
    close = 100 + np.cumsum(rng.normal(0, 1, rows))
    return pd.DataFrame(
        {
            "date": pd.bdate_range("2021-01-04", periods=rows),
            "open": close, "high": close + 1, "low": close - 1,
            "close": close, "adj_close": close, "volume": rng.uniform(1e5, 1e6, rows),
        }
    )


def test_clean_removes_duplicates_and_sorts():
    raw = pd.concat([frame(20), frame(20).iloc[:5]]).sample(frac=1, random_state=1)
    clean = clean_market_frame(raw)
    assert clean["date"].is_monotonic_increasing
    assert clean["date"].duplicated().sum() == 0


def test_chronological_split_is_ordered():
    split = chronological_split(1000, 0.1, 0.15)
    assert split.train_end == 750 and split.val_end == 850 and split.total == 1000


def test_make_sequences_shapes_and_alignment():
    features = np.arange(100, dtype="float64").reshape(50, 2)
    target = np.arange(50, dtype="float64")
    x, y, idx = make_sequences(features, target, lookback=10, horizon=1)
    assert x.shape == (40, 10, 2)
    assert y[0] == target[idx[0]] == 10.0


def test_make_sequences_requires_enough_rows():
    with pytest.raises(InsufficientDataError):
        make_sequences(np.zeros((5, 2)), np.zeros(5), lookback=10, horizon=1)


def test_scaler_is_fitted_on_training_data_only():
    data = add_indicators(frame(500))
    features = ["open", "high", "low", "close", "volume", "sma_20", "rsi_14"]
    prepared = prepare_dataset(data, features, lookback=30, horizon=1,
                               validation_split=0.1, test_split=0.15)
    train_rows = len(prepared.x_train)
    assert train_rows > 0 and len(prepared.x_test) > 0
    # Train scaled values live in [0,1]; test values may exceed it precisely
    # because the scaler never saw them.
    assert prepared.x_train.min() >= -1e-9 and prepared.x_train.max() <= 1 + 1e-9
    assert prepared.last_window.shape == (30, len(features))
