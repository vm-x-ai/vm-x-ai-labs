"""AWS Step Functions Split Lambda Handler Decorator."""

import json
import os
from datetime import datetime
from typing import Any, Callable

import boto3

from ...utils import chunks
from .types import SplitLambdaHandlerEvent, SplitLambdaHandlerOutput

s3 = boto3.resource("s3")


def split_handler(
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "10")),
    staging_bucket_name: str = os.getenv("STAGING_BUCKET", None),
):
    """
    Decorator for the Split Lambda Handler.

    Context:

    The Split lambda handler is responsible for reading the input data and splitting it chunks of data.

    Returns:
        Callable[[dict, Any], SplitLambdaHandlerOutput]: The Split Lambda Handler.
    """

    def decorator(func: Callable[[SplitLambdaHandlerEvent, Any], list[Any]]):
        def wrapper(event: SplitLambdaHandlerEvent, context: Any) -> SplitLambdaHandlerOutput:
            result = func(event, context)

            object_key = f"date={datetime.now().strftime('%Y-%m-%d')}/execution_id={event['execution_id']}/split/"
            staging_bucket = s3.Bucket(staging_bucket_name)

            for idx, chunk in enumerate(chunks(result, chunk_size)):
                staging_bucket.put_object(
                    Key=f"{object_key}chunk={idx}/items.json",
                    Body=json.dumps(chunk),
                )

            return {"key_prefix": object_key, "bucket": staging_bucket.name}

        return wrapper

    return decorator
