"""
StrategyRegistry — Central task-to-strategy dispatcher with graceful dependency hints.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Type

from engines.strategies.base import PipelineStrategy

logger = logging.getLogger(__name__)


class StrategyRegistry:
    """Registry mapping tasks and pipeline types to their dedicated PipelineStrategy classes."""

    _registry: dict[str, Type[PipelineStrategy]] = {}

    @classmethod
    def _normalize(cls, key: str) -> str:
        return key.lower().strip().replace("_", "-")

    @classmethod
    def register(cls, *tasks: str) -> Callable[[Type[PipelineStrategy]], Type[PipelineStrategy]]:
        """Decorator to register a strategy class under one or more task aliases."""
        def decorator(strategy_cls: Type[PipelineStrategy]) -> Type[PipelineStrategy]:
            for task in tasks:
                norm_key = cls._normalize(task)
                cls._registry[norm_key] = strategy_cls
            return strategy_cls
        return decorator

    @classmethod
    def get(cls, task_or_pipeline_type: str) -> Type[PipelineStrategy]:
        """Fetch the registered strategy class for a given task or pipeline type."""
        norm_key = cls._normalize(task_or_pipeline_type)
        if norm_key not in cls._registry:
            available = sorted(list(set(cls._registry.keys())))
            raise KeyError(
                f"No strategy registered for task '{task_or_pipeline_type}' (normalized '{norm_key}'). "
                f"Available tasks: {available}"
            )
        return cls._registry[norm_key]

    @classmethod
    def create(cls, task_or_pipeline_type: str, *args: Any, **kwargs: Any) -> PipelineStrategy:
        """Instantiate the registered strategy for a given task or pipeline type."""
        strategy_cls = cls.get(task_or_pipeline_type)
        return strategy_cls(*args, **kwargs)

    @classmethod
    def list_supported_tasks(cls) -> list[str]:
        """Return list of all supported tasks and aliases."""
        return sorted(list(cls._registry.keys()))
