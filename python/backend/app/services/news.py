"""Configurable news provider: 'mock' for development, 'newsapi' for real data."""
from __future__ import annotations

import hashlib
import random
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

import requests

from ..config.settings import Settings, get_settings
from ..utils.errors import NewsProviderError
from ..utils.logging import get_logger

logger = get_logger(__name__)
REQUEST_TIMEOUT = 20

# Templates are clearly synthetic placeholders used only when NEWS_PROVIDER=mock.
MOCK_TEMPLATES = [
    ("{sym} quarterly revenue beats analyst expectations", "positive"),
    ("{sym} raises full-year guidance on strong demand", "positive"),
    ("Analysts upgrade {sym} citing margin expansion", "positive"),
    ("{sym} announces share buyback programme", "positive"),
    ("{sym} shares slip after weak segment results", "negative"),
    ("Regulatory probe weighs on {sym} outlook", "negative"),
    ("{sym} cuts guidance amid rising input costs", "negative"),
    ("Brokerage downgrades {sym} on valuation concerns", "negative"),
    ("{sym} holds annual shareholder meeting", "neutral"),
    ("{sym} to report earnings next week", "neutral"),
    ("{sym} appoints new chief operating officer", "neutral"),
]
MOCK_SOURCES = ["Market Wire (mock)", "Finance Daily (mock)", "Analyst Desk (mock)"]


@dataclass
class Article:
    symbol: str
    title: str
    source: str
    published_at: str  # ISO-8601 UTC
    url: Optional[str] = None
    description: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class NewsService:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()

    @property
    def provider(self) -> str:
        return self.settings.news_provider

    def fetch(
        self,
        symbol: str,
        start: Optional[date] = None,
        end: Optional[date] = None,
        limit: int = 100,
    ) -> List[Article]:
        symbol = symbol.upper()
        end = end or date.today()
        start = start or (end - timedelta(days=30))
        if self.provider == "mock":
            return self._mock(symbol, start, end, limit)
        if self.provider == "newsapi":
            return self._newsapi(symbol, start, end, limit)
        raise NewsProviderError(f"Unsupported NEWS_PROVIDER={self.provider!r}")

    # --- providers -------------------------------------------------------
    def _mock(self, symbol: str, start: date, end: date, limit: int) -> List[Article]:
        """Deterministic synthetic headlines (seeded by symbol) for development."""
        seed = int(hashlib.sha256(symbol.encode()).hexdigest()[:8], 16)
        rng = random.Random(seed)
        articles: List[Article] = []
        day = start
        while day <= end and len(articles) < limit:
            for _ in range(rng.randint(0, 3)):
                template, _label = MOCK_TEMPLATES[rng.randrange(len(MOCK_TEMPLATES))]
                published = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc) + timedelta(
                    hours=rng.randint(1, 20)
                )
                articles.append(
                    Article(
                        symbol=symbol,
                        title=template.format(sym=symbol),
                        source=MOCK_SOURCES[rng.randrange(len(MOCK_SOURCES))],
                        published_at=published.isoformat(),
                        url=None,
                        description="Synthetic development headline (NEWS_PROVIDER=mock).",
                    )
                )
            day += timedelta(days=1)
        return articles[:limit]

    def _newsapi(self, symbol: str, start: date, end: date, limit: int) -> List[Article]:
        key = self.settings.news_api_key
        if not key:
            raise NewsProviderError("NEWS_API_KEY is not configured.")
        try:
            response = requests.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": symbol.split(".")[0],
                    "from": start.isoformat(),
                    "to": end.isoformat(),
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": min(limit, 100),
                },
                headers={"X-Api-Key": key},
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise NewsProviderError(f"News provider unreachable: {exc}") from exc
        if response.status_code == 401:
            raise NewsProviderError("News provider rejected NEWS_API_KEY (401).")
        if response.status_code == 429:
            raise NewsProviderError("News provider rate limit reached (429). Try again later.")
        if response.status_code >= 400:
            raise NewsProviderError(f"News provider error {response.status_code}.")
        payload = response.json()
        return [
            Article(
                symbol=symbol,
                title=item.get("title") or "",
                source=(item.get("source") or {}).get("name") or "unknown",
                published_at=item.get("publishedAt") or "",
                url=item.get("url"),
                description=item.get("description"),
            )
            for item in payload.get("articles", [])
            if item.get("title")
        ][:limit]
