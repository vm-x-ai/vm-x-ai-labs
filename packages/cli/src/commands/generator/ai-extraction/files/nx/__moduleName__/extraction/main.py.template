import logging
from typing import Any, TypedDict

from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from lambda_functions.util import get_openai_api_key

logger = logging.getLogger()


class Event(TypedDict):
    item: dict
    execution_id: str
    model: str
    schema: dict
    instructions: str


def handler(event: Event, context: Any):
    logger.info("Received event", extra={"event": event})

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                event["instructions"],
            ),
            ("human", "{text}"),
        ]
    )

    logger.info("Initializing the LLM provider")
    llm = ChatOpenAI(
        model=event["model"],
        temperature=0,
        api_key=get_openai_api_key(),
    )

    logger.info("Initializing the extraction pipeline")
    extractor = prompt | llm.with_structured_output(
        schema={
            "name": "extraction",
            "description": "Data extraction from context",
            "parameters": event["schema"],
        },
        method="function_calling",
        include_raw=False,
    )

    document = Document.parse_obj(event["item"])

    logger.info("Extracting developments from the text")
    extractions = extractor.invoke({"text": document.page_content})

    logger.info("Extracted", extra={"extractions": extractions})
