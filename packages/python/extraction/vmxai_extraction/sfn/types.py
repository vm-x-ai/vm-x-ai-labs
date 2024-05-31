"""AWS Step Functions Base Types."""

from typing import TypedDict


class BaseEvent(TypedDict):
    execution_id: str
