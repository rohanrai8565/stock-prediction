from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config.settings import get_settings
from ..services.news import NewsService
from ..services.stock_data import StockDataService
from ..utils.errors import AppError
from ..utils.logging import get_logger
from ml.features.indicators import INDICATOR_COLUMNS, add_indicators
from ml.sentiment.analyzer import SentimentAnalyzer

logger = get_logger(__name__)
router = APIRouter(prefix="/api/stocks", tags=["stocks"])
_analyzer: Optional[SentimentAnalyzer] = None


def get_analyzer() -> SentimentAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = SentimentAnalyzer(prefer_finbert=True)
    return _analyzer


def _handle(exc: AppError) -> HTTPException:
    logger.warning("API error: %s", exc.message)
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/search")
def search(q: str = Query("", max_length=40), limit: int = Query(10, ge=1, le=25)):
    return {"query": q, "results": StockDataService().search(q, limit)}


@router.get("/{symbol}/history")
def history(
    symbol: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
    min_rows: int = Query(1, ge=1),
):
    try:
        result = StockDataService().load(symbol=symbol, start=start, end=end, min_rows=min_rows)
    except AppError as exc:
        raise _handle(exc) from exc
    frame = result.frame
    return {
        "symbol": result.symbol,
        "provider": result.provider,
        "rows": result.rows,
        "start": result.start,
        "end": result.end,
        "candles": [
            {
                "date": row.date.strftime("%Y-%m-%d"),
                "open": float(row.open),
                "high": float(row.high),
                "low": float(row.low),
                "close": float(row.close),
                "adj_close": float(row.adj_close),
                "volume": float(row.volume),
            }
            for row in frame.itertuples()
        ],
    }


@router.get("/{symbol}/technical-indicators")
def indicators(symbol: str, start: Optional[date] = None, end: Optional[date] = None):
    try:
        result = StockDataService().load(symbol=symbol, start=start, end=end, min_rows=1)
    except AppError as exc:
        raise _handle(exc) from exc
    frame = add_indicators(result.frame)
    rows = []
    for row in frame.to_dict(orient="records"):
        rows.append(
            {
                "date": row["date"].strftime("%Y-%m-%d"),
                "values": {
                    key: (None if row[key] != row[key] else round(float(row[key]), 6))
                    for key in INDICATOR_COLUMNS
                },
            }
        )
    return {"symbol": result.symbol, "indicators": INDICATOR_COLUMNS, "rows": rows}


@router.get("/{symbol}/news")
def news(symbol: str, limit: int = Query(50, ge=1, le=200)):
    settings = get_settings()
    try:
        articles = NewsService(settings).fetch(symbol.upper(), limit=limit)
    except AppError as exc:
        raise _handle(exc) from exc
    scored = get_analyzer().analyze_articles([a.to_dict() for a in articles])
    return {
        "symbol": symbol.upper(),
        "provider": settings.news_provider,
        "count": len(scored),
        "articles": scored,
    }


@router.get("/{symbol}/sentiment")
def sentiment(symbol: str, limit: int = Query(200, ge=1, le=500)):
    settings = get_settings()
    try:
        articles = NewsService(settings).fetch(symbol.upper(), limit=limit)
    except AppError as exc:
        raise _handle(exc) from exc
    analyzer = get_analyzer()
    scored = analyzer.analyze_articles([a.to_dict() for a in articles])
    daily = analyzer.daily_frame(scored)
    labels = [a["sentiment_label"] for a in scored]
    scores = [a["sentiment_score"] for a in scored]
    return {
        "symbol": symbol.upper(),
        "provider": settings.news_provider,
        "model": analyzer.model_name,
        "positive": labels.count("positive"),
        "neutral": labels.count("neutral"),
        "negative": labels.count("negative"),
        "average_score": round(sum(scores) / len(scores), 4) if scores else 0.0,
        "daily": [
            {
                "date": row["date"].strftime("%Y-%m-%d"),
                "sentiment_mean": round(float(row["sentiment_mean"]), 4),
                "sentiment_pos_ratio": round(float(row["sentiment_pos_ratio"]), 4),
                "sentiment_neg_ratio": round(float(row["sentiment_neg_ratio"]), 4),
                "news_count": int(row["news_count"]),
            }
            for row in daily.to_dict(orient="records")
        ],
    }
