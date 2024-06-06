import logging
from typing import Any

from langchain_openai import OpenAIEmbeddings
from vmxai_extraction.sfn.store_embedding import EmbeddingLambdaHandlerEvent, store_embedding_handler

from lambda_functions.util import get_openai_api_key

logger = logging.getLogger()


@store_embedding_handler()
def handler(chunks: list[str], event: EmbeddingLambdaHandlerEvent, context: Any) -> list[list[float]]:
    logger.info("Embedding documents", extra={"count": len(chunks)})
    embedder = OpenAIEmbeddings(api_key=get_openai_api_key())

    return embedder.embed_documents(chunks)
