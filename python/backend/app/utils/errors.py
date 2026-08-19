"""Domain exceptions shared by services, ML code and the API layer."""
from __future__ import annotations


class AppError(Exception):
    """Base class; carries a user-safe message."""

    status_code = 500

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidSymbolError(AppError):
    """Symbol is syntactically invalid or unknown to the provider."""

    status_code = 404


class DataProviderError(AppError):
    """Provider reachable but the request failed (network, rate limit, 5xx)."""

    status_code = 502


class EmptyDataError(AppError):
    """Provider responded but returned no rows for the requested range."""

    status_code = 404


class InsufficientDataError(AppError):
    """Rows returned, but not enough for the configured lookback window."""

    status_code = 422


class NewsProviderError(AppError):
    status_code = 502


class ModelNotTrainedError(AppError):
    status_code = 409
