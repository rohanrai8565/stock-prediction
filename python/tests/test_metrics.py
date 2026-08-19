import numpy as np

from ml.evaluation.metrics import directional_accuracy, evaluate, naive_baseline, regression_metrics


def test_perfect_prediction():
    m = regression_metrics([1, 2, 3], [1, 2, 3])
    assert m["mae"] == 0 and m["rmse"] == 0 and m["r2"] == 1.0


def test_empty_returns_none_not_fake_numbers():
    m = regression_metrics([], [])
    assert m["mae"] is None and m["n"] == 0


def test_directional_accuracy():
    acc = directional_accuracy([11, 9], [12, 8], [10, 10])
    assert acc == 100.0


def test_naive_baseline_is_previous_close():
    prev = [10.0, 11.0]
    assert np.allclose(naive_baseline(prev), prev)
    metrics = evaluate([11.0, 12.0], naive_baseline(prev), prev)
    assert metrics["mae"] == 1.0
