from typing import TypedDict


class LocalSimilaritySearchLambdaHandlerEvent(TypedDict):
    bucket: str
    manifest_key: str
    query: str
    max_results: int
    execution_id: str


class LocalSimilaritySearchLambdaHandlerOutput(TypedDict):
    bucket: str
    object_key: str


class ManifestResultFile(TypedDict):
    Key: str
    Size: int


class ManifestResult(TypedDict):
    FAILED: list[ManifestResultFile]
    PENDING: list[ManifestResultFile]
    SUCCEEDED: list[ManifestResultFile]


class Manifest(TypedDict):
    DestinationBucket: str
    MapRunArn: str
    ResultFiles: ManifestResult


class SucceededMapResult(TypedDict):
    ExecutionArn: str
    Input: str
    Output: str
    ...


class SucceededResult(TypedDict):
    bucket: str
    object_key: str


class EmbeddingItem(TypedDict):
    text: str
    embedding: list[float]
