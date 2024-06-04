"""AWS Serverless Implementation of Langchain Long File Structured Extraction"""

import logging

from pythonjsonlogger import jsonlogger

logger = logging.getLogger()

logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)

# Remove all handlers associated with the root logger object
for handler in logger.handlers:
    logger.removeHandler(handler)

logger.addHandler(logHandler)
logger.setLevel(logging.INFO)
