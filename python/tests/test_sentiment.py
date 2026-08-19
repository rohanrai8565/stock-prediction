import pandas as pd

from ml.sentiment.analyzer import (
    LexiconSentimentModel, SentimentAnalyzer, merge_sentiment, preprocess_headline,
)


def test_preprocess_strips_urls_and_punctuation():
    assert "http" not in preprocess_headline("AAPL beats! https://x.com/a")


def test_lexicon_labels():
    model = LexiconSentimentModel()
    assert model.score("AAPL beats estimates, profit surges").label == "positive"
    assert model.score("AAPL misses estimates amid lawsuit").label == "negative"
    assert model.score("AAPL annual meeting scheduled").label == "neutral"


def test_daily_aggregation():
    analyzer = SentimentAnalyzer(model=LexiconSentimentModel())
    scored = analyzer.analyze_articles(
        [
            {"title": "X beats estimates", "published_at": "2024-01-02T10:00:00Z"},
            {"title": "X misses estimates", "published_at": "2024-01-02T15:00:00Z"},
            {"title": "X profit growth strong", "published_at": "2024-01-03T09:00:00Z"},
        ]
    )
    daily = analyzer.daily_frame(scored)
    assert len(daily) == 2
    assert daily.loc[daily["date"] == pd.Timestamp("2024-01-02"), "news_count"].iloc[0] == 2


def test_merge_sentiment_has_no_lookahead():
    market = pd.DataFrame({"date": pd.to_datetime(["2024-01-02", "2024-01-03", "2024-01-04"]),
                           "close": [10.0, 11.0, 12.0]})
    sent = pd.DataFrame(
        {
            "date": pd.to_datetime(["2024-01-03"]),
            "sentiment_mean": [0.8], "sentiment_pos_ratio": [1.0],
            "sentiment_neg_ratio": [0.0], "news_count": [2],
        }
    )
    merged = merge_sentiment(market, sent)
    # 2024-01-02 predates the news -> must stay neutral (no future leakage).
    assert merged.loc[0, "sentiment_mean"] == 0.0
    assert merged.loc[1, "sentiment_mean"] == 0.8
    assert merged.loc[2, "sentiment_mean"] == 0.8
