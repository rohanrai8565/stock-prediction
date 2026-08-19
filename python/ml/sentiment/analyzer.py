"""Financial sentiment analysis with FinBERT and a deterministic lexicon fallback.

The daily aggregation is deliberately causal: an article published at time T is
attributed to the first trading date >= T's date, so a prediction for day D only
ever sees news published before D's close.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Optional

import pandas as pd

from backend.app.utils.logging import get_logger

logger = get_logger(__name__)

POSITIVE = {
    "beat", "beats", "surge", "surges", "gain", "gains", "growth", "profit", "profits",
    "upgrade", "upgrades", "outperform", "record", "strong", "rally", "rallies", "raises",
    "buyback", "expansion", "bullish", "optimistic", "exceeds", "jump", "jumps", "wins",
}
NEGATIVE = {
    "miss", "misses", "fall", "falls", "drop", "drops", "loss", "losses", "downgrade",
    "downgrades", "weak", "slump", "probe", "lawsuit", "fraud", "cuts", "cut", "layoff",
    "layoffs", "bearish", "warning", "warns", "decline", "declines", "slip", "slips", "risk",
}
TOKEN_RE = re.compile(r"[a-z']+")


@dataclass
class SentimentResult:
    label: str  # positive | neutral | negative
    score: float  # -1..1


def preprocess_headline(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"http\S+", " ", text)
    text = re.sub(r"[^a-z0-9%.\s'-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


class LexiconSentimentModel:
    name = "lexicon-v1"

    def score(self, text: str) -> SentimentResult:
        tokens = TOKEN_RE.findall(preprocess_headline(text))
        if not tokens:
            return SentimentResult("neutral", 0.0)
        pos = sum(1 for t in tokens if t in POSITIVE)
        neg = sum(1 for t in tokens if t in NEGATIVE)
        if pos == neg:
            return SentimentResult("neutral", 0.0)
        raw = (pos - neg) / max(pos + neg, 1)
        score = max(-1.0, min(1.0, raw))
        return SentimentResult("positive" if score > 0 else "negative", round(score, 4))


class FinBertSentimentModel:
    name = "finbert (ProsusAI/finbert)"

    def __init__(self) -> None:
        from transformers import pipeline  # imported lazily; optional dependency

        self._pipe = pipeline(
            "sentiment-analysis", model="ProsusAI/finbert", truncation=True, max_length=128
        )

    def score(self, text: str) -> SentimentResult:
        cleaned = preprocess_headline(text)
        if not cleaned:
            return SentimentResult("neutral", 0.0)
        result = self._pipe(cleaned)[0]
        label = str(result["label"]).lower()
        confidence = float(result["score"])
        if label.startswith("pos"):
            return SentimentResult("positive", round(confidence, 4))
        if label.startswith("neg"):
            return SentimentResult("negative", round(-confidence, 4))
        return SentimentResult("neutral", 0.0)


def build_model(prefer_finbert: bool = True):
    if prefer_finbert:
        try:
            model = FinBertSentimentModel()
            logger.info("Sentiment model: %s", model.name)
            return model
        except Exception as exc:
            logger.warning("FinBERT unavailable (%s); using lexicon fallback.", exc)
    model = LexiconSentimentModel()
    logger.info("Sentiment model: %s", model.name)
    return model


class SentimentAnalyzer:
    def __init__(self, prefer_finbert: bool = True, model=None):
        self.model = model or build_model(prefer_finbert)

    @property
    def model_name(self) -> str:
        return getattr(self.model, "name", "unknown")

    def analyze_articles(self, articles: Iterable[dict]) -> List[dict]:
        scored = []
        for article in articles:
            result = self.model.score(article.get("title", ""))
            enriched = dict(article)
            enriched["sentiment_label"] = result.label
            enriched["sentiment_score"] = result.score
            scored.append(enriched)
        return scored

    def daily_frame(self, scored_articles: List[dict]) -> pd.DataFrame:
        """Aggregate to one row per calendar (UTC) date."""
        columns = [
            "date", "sentiment_mean", "sentiment_pos_ratio", "sentiment_neg_ratio", "news_count"
        ]
        if not scored_articles:
            return pd.DataFrame(columns=columns)
        frame = pd.DataFrame(scored_articles)
        frame["date"] = (
            pd.to_datetime(frame["published_at"], utc=True, errors="coerce")
            .dt.tz_localize(None)
            .dt.normalize()
        )
        frame = frame.dropna(subset=["date"])
        if frame.empty:
            return pd.DataFrame(columns=columns)
        grouped = frame.groupby("date").agg(
            sentiment_mean=("sentiment_score", "mean"),
            news_count=("sentiment_score", "size"),
            sentiment_pos_ratio=("sentiment_label", lambda s: float((s == "positive").mean())),
            sentiment_neg_ratio=("sentiment_label", lambda s: float((s == "negative").mean())),
        )
        return grouped.reset_index()[columns]


SENTIMENT_FEATURES = [
    "sentiment_mean", "sentiment_pos_ratio", "sentiment_neg_ratio", "news_count",
    "sentiment_mean_3d",
]


def merge_sentiment(market: pd.DataFrame, daily_sentiment: pd.DataFrame) -> pd.DataFrame:
    """Left-join daily sentiment onto trading days without look-ahead.

    merge_asof(direction='backward') attaches, for trading day D, the most recent
    sentiment date <= D. Days with no news get 0 (neutral) rather than a future value.
    """
    out = market.sort_values("date").reset_index(drop=True).copy()
    out["date"] = pd.to_datetime(out["date"]).dt.normalize()
    if daily_sentiment is None or daily_sentiment.empty:
        for col in ("sentiment_mean", "sentiment_pos_ratio", "sentiment_neg_ratio", "news_count"):
            out[col] = 0.0
    else:
        sent = daily_sentiment.sort_values("date").reset_index(drop=True).copy()
        sent["date"] = pd.to_datetime(sent["date"]).dt.normalize()
        out = pd.merge_asof(out, sent, on="date", direction="backward")
        for col in ("sentiment_mean", "sentiment_pos_ratio", "sentiment_neg_ratio", "news_count"):
            out[col] = out[col].fillna(0.0)
    out["sentiment_mean_3d"] = out["sentiment_mean"].rolling(3, min_periods=1).mean()
    return out
