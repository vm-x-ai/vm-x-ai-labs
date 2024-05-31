"""Split Module."""

from .decorator import split_handler
from .types import SplitLambdaHandlerEvent, SplitLambdaHandlerOutput

__all__ = ["split_handler", "SplitLambdaHandlerEvent", "SplitLambdaHandlerOutput"]
