#!/usr/bin/env python
"""Train the market-only, market+technical and market+sentiment LSTM models.

Usage:
    python train_model.py
    python train_model.py --symbol RELIANCE.NS --epochs 30
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import replace

from backend.app.config.settings import ConfigError, get_settings
from backend.app.utils.errors import AppError
from backend.app.utils.logging import get_logger, setup_logging
from ml.training.pipeline import format_summary, run_training


def main() -> int:
    parser = argparse.ArgumentParser(description="Train LSTM stock prediction models")
    parser.add_argument("--symbol", help="Override STOCK_SYMBOL, e.g. AAPL or TCS.NS")
    parser.add_argument("--epochs", type=int, help="Override EPOCHS")
    parser.add_argument("--lookback", type=int, help="Override LOOKBACK")
    parser.add_argument("--no-sentiment", action="store_true", help="Train market models only")
    args = parser.parse_args()

    try:
        settings = get_settings()
    except ConfigError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 2

    setup_logging(settings.log_level)
    logger = get_logger("train_model")
    for warning in settings.warnings:
        logger.warning(warning)

    overrides = {}
    if args.epochs:
        overrides["epochs"] = args.epochs
    if args.lookback:
        overrides["lookback"] = args.lookback
    if args.no_sentiment:
        overrides["use_sentiment"] = False
    if overrides:
        settings = replace(settings, **overrides)

    try:
        results = run_training(symbol=args.symbol, settings=settings)
    except AppError as exc:
        logger.error("Training aborted: %s", exc.message)
        return 1
    except KeyboardInterrupt:
        logger.warning("Interrupted by user.")
        return 130

    print(format_summary(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
