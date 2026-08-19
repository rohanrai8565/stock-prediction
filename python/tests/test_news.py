import pytest

from backend.app.config.settings import get_settings
from backend.app.services.news import NewsService
from backend.app.utils.errors import NewsProviderError


def test_mock_provider_is_deterministic():
    service = NewsService()
    if service.provider != "mock":
        pytest.skip("NEWS_PROVIDER is not mock")
    first = service.fetch("AAPL", limit=20)
    second = service.fetch("AAPL", limit=20)
    assert [a.title for a in first] == [a.title for a in second]
    assert all(a.symbol == "AAPL" and a.published_at for a in first)


def test_newsapi_without_key_raises():
    from dataclasses import replace

    settings = replace(get_settings(), news_provider="newsapi", news_api_key="")
    with pytest.raises(NewsProviderError):
        NewsService(settings).fetch("AAPL")
