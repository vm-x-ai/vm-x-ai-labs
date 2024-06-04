import logging
from typing import Any

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from vmxai_extraction.sfn.local_similarity_search import (
    LocalSimilaritySearchLambdaHandlerEvent,
    local_similarity_search_handler,
)

from lambda_functions.util import get_openai_api_key

logger = logging.getLogger()


@local_similarity_search_handler()
def handler(
    embeddings: list[tuple[str, list[float]]], event: LocalSimilaritySearchLambdaHandlerEvent, context: Any
) -> list[Document]:
    logger.info("Creating vector store", extra={"documents": len(embeddings)})
    embedder = OpenAIEmbeddings(api_key=get_openai_api_key())
    vectorstore = FAISS.from_embeddings(
        text_embeddings=[(text, embedding) for text, embedding in embeddings],
        embedding=embedder,
    )

    retriever = vectorstore.as_retriever(search_kwargs={"k": event["max_results"]})
    return retriever.invoke(event["query"])
