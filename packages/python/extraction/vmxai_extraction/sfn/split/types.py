"""AWS Step Functions Split Types."""

from typing import TypedDict

from ..types import BaseEvent


class SplitLambdaHandlerEvent(BaseEvent):
    ...


class SplitLambdaHandlerOutput(TypedDict):
    """
    Output of the Split Lambda Handler.

    Attributes:
        bucket (str): The S3 bucket name, where the split data is stored.
        key_prefix (str): The S3 key prefix.
    """

    bucket: str
    key_prefix: str
