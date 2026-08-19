"""Optional PostgreSQL persistence via SQLAlchemy.

Disabled cleanly when DATABASE_URL is empty; the API stays fully functional.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Optional

from sqlalchemy import (
    JSON, Column, DateTime, Float, Integer, String, Text, UniqueConstraint, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from ..config.settings import get_settings
from ..utils.logging import get_logger

logger = get_logger(__name__)


class Base(DeclarativeBase):
    pass


class Stock(Base):
    __tablename__ = "stocks"
    id = Column(Integer, primary_key=True)
    symbol = Column(String(24), unique=True, nullable=False, index=True)
    name = Column(String(160))
    exchange = Column(String(64))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class NewsArticle(Base):
    __tablename__ = "news_articles"
    __table_args__ = (UniqueConstraint("symbol", "title", "published_at", name="uq_article"),)
    id = Column(Integer, primary_key=True)
    symbol = Column(String(24), index=True, nullable=False)
    title = Column(Text, nullable=False)
    source = Column(String(160))
    url = Column(Text)
    published_at = Column(DateTime(timezone=True), index=True)
    sentiment_label = Column(String(16))
    sentiment_score = Column(Float)
    model_name = Column(String(80))


class PredictionRecord(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True)
    symbol = Column(String(24), index=True, nullable=False)
    model_name = Column(String(80), nullable=False)
    as_of_date = Column(String(10), nullable=False)
    current_price = Column(Float, nullable=False)
    predicted_price = Column(Float, nullable=False)
    percent_change = Column(Float)
    direction = Column(String(8))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class ModelRun(Base):
    __tablename__ = "model_runs"
    id = Column(Integer, primary_key=True)
    symbol = Column(String(24), index=True, nullable=False)
    model_name = Column(String(80), nullable=False)
    trained_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    hyperparameters = Column(JSON)
    metrics = Column(JSON)
    dataset_period = Column(JSON)


_engine = None
_SessionFactory: Optional[sessionmaker] = None


def is_enabled() -> bool:
    return bool(get_settings().database_url)


def get_engine():
    global _engine, _SessionFactory
    if not is_enabled():
        return None
    if _engine is None:
        _engine = create_engine(get_settings().database_url, pool_pre_ping=True, future=True)
        _SessionFactory = sessionmaker(bind=_engine, expire_on_commit=False, future=True)
    return _engine


def init_db() -> bool:
    engine = get_engine()
    if engine is None:
        logger.info("DATABASE_URL not set - persistence disabled.")
        return False
    Base.metadata.create_all(engine)
    logger.info("Database schema ready.")
    return True


@contextmanager
def session_scope() -> Iterator[Optional[Session]]:
    if get_engine() is None or _SessionFactory is None:
        yield None
        return
    session = _SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def save_prediction(payload: Dict[str, Any]) -> None:
    with session_scope() as session:
        if session is None:
            return
        session.add(
            PredictionRecord(
                symbol=payload["symbol"],
                model_name=payload["model"],
                as_of_date=payload["as_of_date"],
                current_price=payload["current_price"],
                predicted_price=payload["predicted_price"],
                percent_change=payload.get("percent_change"),
                direction=payload.get("direction"),
            )
        )


def recent_predictions(symbol: str, limit: int = 50) -> List[Dict[str, Any]]:
    with session_scope() as session:
        if session is None:
            return []
        rows = (
            session.query(PredictionRecord)
            .filter(PredictionRecord.symbol == symbol.upper())
            .order_by(PredictionRecord.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "symbol": r.symbol,
                "model": r.model_name,
                "as_of_date": r.as_of_date,
                "current_price": r.current_price,
                "predicted_price": r.predicted_price,
                "percent_change": r.percent_change,
                "direction": r.direction,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
