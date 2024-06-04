import logging
import re
from typing import Any

import requests
from langchain_community.document_loaders import BSHTMLLoader
from langchain_text_splitters import TokenTextSplitter
from vmxai_extraction.sfn.split import SplitLambdaHandlerEvent, split_handler

logger = logging.getLogger()


@split_handler()
def handler(event: SplitLambdaHandlerEvent, context: Any) -> list[str]:
    logger.info("Received event", extra={"event": event})

    response = requests.get("https://en.wikipedia.org/wiki/Car")
    with open("/tmp/car.html", "w", encoding="utf-8") as f:
        f.write(response.text)

    loader = BSHTMLLoader("/tmp/car.html")
    document = loader.load()[0]
    document.page_content = re.sub("\n\n+", "\n", document.page_content)

    # 2. Split the text into chunks
    text_splitter = TokenTextSplitter(
        # Controls the size of each chunk
        chunk_size=2000,
        # Controls overlap between chunks
        chunk_overlap=20,
    )

    texts = text_splitter.split_text(document.page_content)
    logger.info(f"Number of text chunks: {len(texts)}")

    return texts
