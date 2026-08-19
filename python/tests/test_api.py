import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app.services import stock_data


def raw(rows=200):
    idx = pd.bdate_range("2023-01-02", periods=rows)
    base = np.linspace(100, 150, rows)
    return pd.DataFrame(
        {"Open": base, "High": base + 1, "Low": base - 1, "Close": base + 0.5,
         "Adj Close": base + 0.4, "Volume": np.full(rows, 1e6)},
        index=pd.Index(idx, name="Date"),
    )


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(stock_data, "_load_yfinance", lambda *a, **k: raw())
    from backend.app.main import app

    return TestClient(app)


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_search(client):
    response = client.get("/api/stocks/search", params={"q": "AAPL"})
    assert response.status_code == 200
    assert response.json()["results"]


def test_history(client):
    response = client.get("/api/stocks/AAPL/history")
    body = response.json()
    assert response.status_code == 200
    assert body["rows"] == 200 and len(body["candles"]) == 200


def test_indicators(client):
    body = client.get("/api/stocks/AAPL/technical-indicators").json()
    assert "rsi_14" in body["indicators"]
    assert "values" in body["rows"][-1]


def test_news_and_sentiment(client):
    news = client.get("/api/stocks/AAPL/news", params={"limit": 10}).json()
    assert news["count"] <= 10
    sentiment = client.get("/api/stocks/AAPL/sentiment").json()
    assert set(["positive", "neutral", "negative"]) <= set(sentiment)


def test_invalid_symbol_returns_404(client):
    response = client.get("/api/stocks/!!!/history")
    assert response.status_code == 404


def test_predict_without_trained_model_is_409_not_500(client):
    response = client.post("/api/predict", json={"symbol": "AAPL", "model_name": "does_not_exist"})
    assert response.status_code in (409, 404)
    assert "detail" in response.json()


def test_performance_reports_untrained_clearly(client):
    body = client.get("/api/model/performance").json()
    assert "models" in body
