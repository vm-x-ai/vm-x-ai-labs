"""AWS Step Functions Split Types."""

from typing import TypedDict


class EmbeddingLambdaHandlerEvent(TypedDict):
    Etag: str
    Key: str
    LastModified: float
    Size: int
    StorageClass: str


class EmbeddingLambdaHandlerOutput(TypedDict):
    """
    Output of the Embedding Lambda Handler.

    Attributes:
        bucket (str): The S3 bucket name.
        object_key (str): The S3 object key.
    """

    bucket: str
    object_key: str
