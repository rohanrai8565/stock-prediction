"""End-to-end training pipeline shared by train_model.py and the API."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from backend.app.config.settings import Settings, get_settings
from backend.app.services.news import NewsService
from backend.app.services.stock_data import StockDataService
from backend.app.utils.logging import get_logger, setup_logging
from ml.evaluation.metrics import evaluate, naive_baseline
from ml.features.indicators import INDICATOR_COLUMNS, add_indicators
from ml.models.lstm import (
    ModelBundle,
    build_lstm,
    model_paths,
    save_bundle,
    training_callbacks,
)
from ml.preprocessing.pipeline import prepare_dataset
from ml.sentiment.analyzer import SENTIMENT_FEATURES, SentimentAnalyzer, merge_sentiment

logger = get_logger(__name__)

BASE_FEATURES = ["open", "high", "low", "close", "volume"]
MARKET_ONLY_NAME = "lstm_market_only"
MARKET_TECH_NAME = "lstm_market_tech"
SENTIMENT_NAME = "lstm_sentiment"


@dataclass
class TrainedModelReport:
    name: str
    features: List[str]
    metrics: Dict[str, Any]
    epochs_run: int
    trained: bool = True
    note: str = ""


def _train_one(
    name: str,
    frame: pd.DataFrame,
    feature_columns: List[str],
    settings: Settings,
    uses_sentiment: bool,
    symbol: str,
) -> tuple[TrainedModelReport, Dict[str, Any]]:
    prepared = prepare_dataset(
        frame=frame,
        feature_columns=feature_columns,
        lookback=settings.lookback,
        horizon=settings.prediction_horizon,
        validation_split=settings.validation_split,
        test_split=settings.test_split,
    )
    logger.info(
        "[%s] train=%d val=%d test=%d features=%d",
        name, len(prepared.x_train), len(prepared.x_val), len(prepared.x_test), len(feature_columns),
    )

    model = build_lstm(
        input_shape=(settings.lookback, len(feature_columns)),
        units=settings.lstm_units,
        dropout=settings.dropout,
        learning_rate=settings.learning_rate,
    )
    checkpoint = model_paths(settings.model_dir, name)["model"]
    validation_data = (
        (prepared.x_val, prepared.y_val) if len(prepared.x_val) else None
    )
    history = model.fit(
        prepared.x_train,
        prepared.y_train,
        validation_data=validation_data,
        epochs=settings.epochs,
        batch_size=settings.batch_size,
        shuffle=False,  # time series: keep chronological order
        callbacks=training_callbacks(checkpoint) if validation_data else [],
        verbose=2,
    )

    y_pred_scaled = model.predict(prepared.x_test, verbose=0).ravel()
    y_pred = prepared.target_scaler.inverse_transform(y_pred_scaled.reshape(-1, 1)).ravel()
    y_true = prepared.target_scaler.inverse_transform(prepared.y_test.reshape(-1, 1)).ravel()
    metrics = evaluate(y_true, y_pred, prepared.test_prev_close)

    bundle = ModelBundle(
        name=name,
        feature_columns=feature_columns,
        lookback=settings.lookback,
        horizon=settings.prediction_horizon,
        symbol=symbol,
        dataset_start=str(frame["date"].min().date()),
        dataset_end=str(frame["date"].max().date()),
        trained_at=datetime.now(timezone.utc).isoformat(),
        hyperparameters={
            "epochs": settings.epochs,
            "batch_size": settings.batch_size,
            "lstm_units": settings.lstm_units,
            "dropout": settings.dropout,
            "learning_rate": settings.learning_rate,
            "validation_split": settings.validation_split,
            "test_split": settings.test_split,
            "loss": "huber",
            "optimizer": "adam",
        },
        metrics=metrics,
        uses_sentiment=uses_sentiment,
    )
    save_bundle(settings.model_dir, name, model, prepared.feature_scaler, prepared.target_scaler, bundle)

    predictions = {
        "dates": [d.strftime("%Y-%m-%d") for d in prepared.test_dates],
        "actual": [round(float(v), 4) for v in y_true],
        "predicted": [round(float(v), 4) for v in y_pred],
        "prev_close": [None if not np.isfinite(v) else round(float(v), 4) for v in prepared.test_prev_close],
    }
    report = TrainedModelReport(
        name=name,
        features=feature_columns,
        metrics=metrics,
        epochs_run=len(history.history.get("loss", [])),
    )
    return report, predictions


def build_feature_frame(settings: Settings, symbol: str) -> tuple[pd.DataFrame, Dict[str, Any]]:
    """Load market data, add indicators and (optionally) fuse sentiment."""
    loaded = StockDataService(settings).load(symbol=symbol)
    frame = add_indicators(loaded.frame)
    info: Dict[str, Any] = {
        "symbol": loaded.symbol,
        "provider": loaded.provider,
        "rows": loaded.rows,
        "start": str(loaded.start),
        "end": str(loaded.end),
        "sentiment_enabled": False,
        "sentiment_model": None,
        "news_articles": 0,
    }
    if settings.use_sentiment:
        try:
            articles = NewsService(settings).fetch(
                loaded.symbol, start=loaded.start, end=loaded.end, limit=1000
            )
            analyzer = SentimentAnalyzer(prefer_finbert=True)
            scored = analyzer.analyze_articles([a.to_dict() for a in articles])
            daily = analyzer.daily_frame(scored)
            frame = merge_sentiment(frame, daily)
            info.update(
                sentiment_enabled=True,
                sentiment_model=analyzer.model_name,
                news_articles=len(scored),
                news_provider=settings.news_provider,
            )
        except Exception as exc:
            logger.warning("Sentiment fusion skipped: %s", exc)
            info["sentiment_error"] = str(exc)
    return frame, info


def run_training(symbol: Optional[str] = None, settings: Optional[Settings] = None) -> Dict[str, Any]:
    settings = settings or get_settings()
    setup_logging(settings.log_level)
    symbol = (symbol or settings.stock_symbol).upper()

    frame, info = build_feature_frame(settings, symbol)
    reports: List[TrainedModelReport] = []
    prediction_series: Dict[str, Any] = {}

    configs = [
        (MARKET_ONLY_NAME, BASE_FEATURES, False),
        (MARKET_TECH_NAME, BASE_FEATURES + INDICATOR_COLUMNS, False),
    ]
    if info["sentiment_enabled"]:
        configs.append(
            (SENTIMENT_NAME, BASE_FEATURES + INDICATOR_COLUMNS + SENTIMENT_FEATURES, True)
        )

    for name, features, uses_sentiment in configs:
        available = [f for f in features if f in frame.columns]
        report, preds = _train_one(name, frame, available, settings, uses_sentiment, symbol)
        reports.append(report)
        prediction_series[name] = preds

    # Naive previous-close baseline on the same test window as the last model.
    reference = prediction_series[configs[-1][0]]
    prev = [v for v in reference["prev_close"]]
    baseline_metrics = evaluate(
        reference["actual"],
        naive_baseline([0 if v is None else v for v in prev]),
        [0 if v is None else v for v in prev],
    )

    results = {
        "symbol": symbol,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset": info,
        "baseline_naive_previous_close": baseline_metrics,
        "models": [
            {
                "name": r.name,
                "trained": r.trained,
                "epochs_run": r.epochs_run,
                "feature_count": len(r.features),
                "features": r.features,
                "metrics": r.metrics,
            }
            for r in reports
        ],
        "not_trained": (
            [] if info["sentiment_enabled"] else [
                {"name": SENTIMENT_NAME, "reason": "sentiment disabled or unavailable; not evaluated"}
            ]
        ),
        "test_predictions": prediction_series,
    }

    out_file = settings.model_dir / f"evaluation_{symbol.replace('.', '_')}.json"
    out_file.write_text(json.dumps(results, indent=2))
    latest = settings.model_dir / "evaluation_latest.json"
    latest.write_text(json.dumps(results, indent=2))
    logger.info("Saved evaluation report -> %s", out_file)
    return results


def format_summary(results: Dict[str, Any]) -> str:
    ds = results["dataset"]
    lines = [
        "",
        "=" * 78,
        f" TRAINING SUMMARY - {results['symbol']}",
        "=" * 78,
        f" Data provider     : {ds['provider']}",
        f" Rows              : {ds['rows']} ({ds['start']} -> {ds['end']})",
        f" Sentiment fusion  : {'on' if ds['sentiment_enabled'] else 'off'}"
        + (f" ({ds.get('sentiment_model')}, {ds['news_articles']} articles)" if ds["sentiment_enabled"] else ""),
        "-" * 78,
        f" {'MODEL':<26}{'MAE':>10}{'RMSE':>10}{'MAPE%':>9}{'R2':>8}{'DIR%':>8}",
        "-" * 78,
    ]

    def row(label: str, m: Dict[str, Any]) -> str:
        fmt = lambda v: "   n/a" if v is None else f"{v:.4f}"
        return (
            f" {label:<26}{fmt(m['mae']):>10}{fmt(m['rmse']):>10}"
            f"{fmt(m['mape']):>9}{fmt(m['r2']):>8}{fmt(m['directional_accuracy']):>8}"
        )

    lines.append(row("naive previous close", results["baseline_naive_previous_close"]))
    for model in results["models"]:
        lines.append(row(model["name"], model["metrics"]))
    for skipped in results["not_trained"]:
        lines.append(f" {skipped['name']:<26}  NOT TRAINED - {skipped['reason']}")
    lines += [
        "-" * 78,
        " Metrics come from the chronological hold-out test split only.",
        " No confidence percentages are produced: these are point estimates.",
        "=" * 78,
        "",
    ]
    return "\n".join(lines)
