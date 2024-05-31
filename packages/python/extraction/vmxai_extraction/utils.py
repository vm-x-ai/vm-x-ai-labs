from typing import Any, Generator


def chunks(source: list, chunk_size: int) -> Generator[list, Any, None]:
    """
    Split a list into chunks of a given size.
    """
    for i in range(0, len(source), chunk_size):
        yield source[i : i + chunk_size]
