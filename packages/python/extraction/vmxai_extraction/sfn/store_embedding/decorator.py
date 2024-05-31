"""AWS Step Functions Split Lambda Handler Decorator."""

import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Callable

import boto3

from .types import EmbeddingLambdaHandlerEvent, EmbeddingLambdaHandlerOutput

s3 = boto3.resource("s3")

logger = logging.getLogger()

EXECUTION_ID_REGEX = r"execution_id=([a-f0-9-]+)"
CHUNK_ID_REGEX = r"chunk=([a-f0-9-]+)"


def store_embedding_handler(
    staging_bucket_name: str = os.getenv("STAGING_BUCKET", None),
):
    """
    Decorator for the Embedding Lambda Handler.

    Context:

    The Embedding lambda handler is responsible for reading the result \
        of the split lambda handler, embedding the documents and storing the embedding in the S3 bucket.

    Returns:
        Callable[[dict, Any], EmbeddingLambdaHandlerOutput]: lambda Handler.
    """

    def decorator(func: Callable[[EmbeddingLambdaHandlerEvent, Any], list[Any]]):
        def wrapper(event: EmbeddingLambdaHandlerEvent, context: Any) -> EmbeddingLambdaHandlerOutput:
            logger.info("Received event", extra={"event": event})

            logger.info("Downloading chunk from S3")
            chunks: list[str] = json.loads(
                s3.Object(staging_bucket_name, event["Key"]).get()["Body"].read().decode("utf-8")
            )

            embeddings = func(chunks, event, context)
            if not embeddings:
                return {"object_key": None, "bucket": None}

            staging_bucket = s3.Bucket(staging_bucket_name)

            date_partition = f"date={datetime.now().strftime('%Y-%m-%d')}"
            execution_partition = f"execution_id={extract_execution_id_key(event)}"
            chunk_partition = f"chunk={extract_chunk_id_key(event)}"
            object_key = f"{date_partition}/{execution_partition}/embedding/{chunk_partition}/embeddings.json"
            logger.info("Creating embedding objects", extra={"count": len(embeddings)})
            result = []
            for i, embedding in enumerate(embeddings):
                result.append(
                    {
                        "text": chunks[i],
                        "embedding": embedding,
                    }
                )

            logger.info("Uploading embeddings to S3", extra={"object_key": object_key})
            staging_bucket.put_object(
                Key=object_key,
                Body=json.dumps(result),
                ContentType="application/json",
            )

            return {"object_key": object_key, "bucket": staging_bucket.name}

        return wrapper

    return decorator


def extract_execution_id_key(event: EmbeddingLambdaHandlerEvent) -> str:
    match = re.search(EXECUTION_ID_REGEX, event["Key"])
    if not match:
        raise ValueError("Execution ID not found in the key")

    return match.group(1)


def extract_chunk_id_key(event: EmbeddingLambdaHandlerEvent) -> str:
    match = re.search(CHUNK_ID_REGEX, event["Key"])
    if not match:
        raise ValueError("Chunk ID not found in the key")

    return match.group(1)
