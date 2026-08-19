"""Pydantic request/response schemas for the public API."""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    data_provider: str
    news_provider: str
    sentiment_enabled: bool
    persistence_enabled: bool
    trained_models: List[str]
    warnings: List[str] = []


class SymbolSuggestion(BaseModel):
    symbol: str
    name: str
    exchange: str = ""


class Candle(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    adj_close: float
    volume: float


class HistoryResponse(BaseModel):
    symbol: str
    provider: str
    rows: int
    start: date
    end: date
    candles: List[Candle]


class IndicatorRow(BaseModel):
    date: str
    values: Dict[str, Optional[float]]


class IndicatorsResponse(BaseModel):
    symbol: str
    indicators: List[str]
    rows: List[IndicatorRow]


class ArticleModel(BaseModel):
    symbol: str
    title: str
    source: str
    published_at: str
    url: Optional[str] = None
    description: Optional[str] = None
    sentiment_label: Optional[str] = None
    sentiment_score: Optional[float] = None


class NewsResponse(BaseModel):
    symbol: str
    provider: str
    count: int
    articles: List[ArticleModel]


class DailySentiment(BaseModel):
    date: str
    sentiment_mean: float
    sentiment_pos_ratio: float
    sentiment_neg_ratio: float
    news_count: int


class SentimentResponse(BaseModel):
    symbol: str
    provider: str
    model: str
    positive: int
    neutral: int
    negative: int
    average_score: float
    daily: List[DailySentiment]


class PredictRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=16, examples=["AAPL"])
    model_name: Optional[str] = Field(default=None, description="Defaults to the best trained model")


class PredictResponse(BaseModel):
    symbol: str
    model: str
    model_trained_at: Optional[str] = None
    as_of_date: str
    generated_at: str
    horizon_days: int
    current_price: float
    predicted_price: float
    absolute_change: float
    percent_change: Optional[float]
    direction: str
    test_metrics: Dict[str, Any] = {}
    disclaimer: str


class PerformanceResponse(BaseModel):
    symbol: Optional[str] = None
    generated_at: Optional[str] = None
    baseline_naive_previous_close: Dict[str, Any] = {}
    models: List[Dict[str, Any]] = []
    not_trained: List[Dict[str, Any]] = []
    test_predictions: Dict[str, Any] = {}
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
