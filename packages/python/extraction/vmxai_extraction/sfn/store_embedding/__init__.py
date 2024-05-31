"""Embedding Module."""

from .decorator import store_embedding_handler
from .types import EmbeddingLambdaHandlerEvent, EmbeddingLambdaHandlerOutput

__all__ = ["store_embedding_handler", "EmbeddingLambdaHandlerEvent", "EmbeddingLambdaHandlerOutput"]
