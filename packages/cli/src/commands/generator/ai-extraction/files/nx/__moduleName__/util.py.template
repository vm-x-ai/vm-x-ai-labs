import os
from typing import Any, Generator

import boto3
from cachetools import TTLCache, cached

ssm = boto3.client("ssm")


def chunks(source: list, chunk_size: int) -> Generator[list, Any, None]:
    """
    Split a list into chunks of a given size.
    """
    for i in range(0, len(source), chunk_size):
        yield source[i : i + chunk_size]


@cached(cache=TTLCache(ttl=3600, maxsize=1024))  # Cache the API key for 1 hour
def get_openai_api_key():
    value = ssm.get_parameter(Name=os.getenv("OPENAI_API_KEY_SSM"), WithDecryption=True)
    api_key = value["Parameter"]["Value"]
    return api_key
