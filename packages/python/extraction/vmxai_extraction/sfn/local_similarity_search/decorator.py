"""AWS Step Functions Split Lambda Handler Decorator."""

import json
import logging
import os
from datetime import datetime
from typing import Any, Callable

import boto3
from langchain_core.documents import Document

from .types import (
    EmbeddingItem,
    LocalSimilaritySearchLambdaHandlerEvent,
    LocalSimilaritySearchLambdaHandlerOutput,
    Manifest,
    SucceededMapResult,
    SucceededResult,
)

s3 = boto3.resource("s3")

logger = logging.getLogger()


def local_similarity_search_handler(
    staging_bucket_name: str = os.getenv("STAGING_BUCKET", None),
):
    """
    Decorator for the Local Similarity Search Lambda Handler.

    Context:

    The Local Similarity Search lambda handler is responsible for reading the result \
        of the embedding lambda handler, indexing them and perform similarity search.

    Returns:
        Callable[[dict, Any], LocalSimilaritySearchLambdaHandlerOutput]: lambda Handler.
    """

    def decorator(func: Callable[[LocalSimilaritySearchLambdaHandlerEvent, Any], list[Any]]):
        def wrapper(
            event: LocalSimilaritySearchLambdaHandlerEvent, context: Any
        ) -> LocalSimilaritySearchLambdaHandlerOutput:
            logger.info("Received event", extra={"event": event})

            logger.info("Downloading manifest", extra={"key": event["manifest_key"]})
            manifest: Manifest = json.loads(
                s3.Object(event["bucket"], event["manifest_key"]).get()["Body"].read().decode("utf-8")
            )

            embeddings: list[tuple[str, list[float]]] = []

            for file in manifest["ResultFiles"]["SUCCEEDED"]:
                logger.info("Downloading result", extra={"key": file["Key"]})
                results: list[SucceededMapResult] = json.loads(
                    s3.Object(manifest["DestinationBucket"], file["Key"]).get()["Body"].read().decode("utf-8")
                )

                for result in results:
                    logger.info("Processing result", extra={"result": result})
                    item_output: SucceededResult = json.loads(result["Output"])

                    if item_output["object_key"] is None:
                        continue

                    logger.info("Loading embeddings", extra={"key": item_output["object_key"]})
                    embeddings_file_item: list[EmbeddingItem] = json.loads(
                        s3.Object(item_output["bucket"], item_output["object_key"]).get()["Body"].read().decode("utf-8")
                    )
                    for item in embeddings_file_item:
                        embeddings.append((item["text"], item["embedding"]))

            results: list[Document] = func(embeddings, event, context)
            staging_bucket = s3.Bucket(staging_bucket_name)

            date_partition = f"date={datetime.now().strftime('%Y-%m-%d')}"
            execution_partition = f"execution_id={event['execution_id']}"
            object_key = f"{date_partition}/{execution_partition}/search/results.json"
            logger.info(
                "Uploading results to S3",
                extra={"results": len(results), "object_key": object_key},
            )
            staging_bucket.put_object(
                Key=object_key,
                Body=json.dumps([result.dict() for result in results]),
            )

            return {"bucket": staging_bucket.name, "object_key": object_key}

        return wrapper

    return decorator
