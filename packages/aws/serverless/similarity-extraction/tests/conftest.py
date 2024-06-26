"""Unit tests configuration module."""
from pytest import ExitCode

pytest_plugins = []

def pytest_sessionfinish(session, exitstatus):
    if exitstatus == ExitCode.NO_TESTS_COLLECTED:
        session.exitstatus = ExitCode.OK
