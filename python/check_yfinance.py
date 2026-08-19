#!/usr/bin/env python
"""Phase 1 smoke test: prove the data pipeline works end to end.

Usage:
    python check_yfinance.py
    python check_yfinance.py AAPL MSFT TCS.NS RELIANCE.NS
"""
from __future__ import annotations

import sys

from backend.app.services.stock_data import StockDataService, SUGGESTED_SYMBOLS
from backend.app.utils.errors import AppError
from backend.app.utils.logging import setup_logging
from ml.features.indicators import add_indicators


def main() -> int:
    setup_logging("INFO")
    symbols = sys.argv[1:] or [s["symbol"] for s in SUGGESTED_SYMBOLS]
    service = StockDataService()
    failures = 0
    print(f"{'SYMBOL':<14}{'ROWS':>7}{'PROVIDER':>12}  RANGE / ERROR")
    print("-" * 78)
    for symbol in symbols:
        try:
            result = service.load(symbol, min_rows=30)
            enriched = add_indicators(result.frame)
            rsi = enriched["rsi_14"].iloc[-1]
            print(
                f"{result.symbol:<14}{result.rows:>7}{result.provider:>12}  "
                f"{result.start} -> {result.end} | last close {result.frame['close'].iloc[-1]:.2f} "
                f"| RSI14 {rsi:.1f}"
            )
        except AppError as exc:
            failures += 1
            print(f"{symbol:<14}{'-':>7}{'-':>12}  {type(exc).__name__}: {exc.message}")
    print("-" * 78)
    print(f"{len(symbols) - failures}/{len(symbols)} symbols loaded successfully.")
    return 1 if failures == len(symbols) else 0


if __name__ == "__main__":
    raise SystemExit(main())
