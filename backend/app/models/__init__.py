"""ORM model package.

Models are imported lazily so that ``app.config`` can read the enums without
triggering the database module and creating a circular import. Calling
``app.database.create_tables`` explicitly imports all model modules.
"""

from __future__ import annotations

import importlib
from typing import Any

__all__ = [
    "Application",
    "ApplicationStatusHistory",
    "CandidateProfile",
    "Company",
    "Job",
    "User",
]

_MODEL_MODULES = {
    "Application": "app.models.application",
    "ApplicationStatusHistory": "app.models.application",
    "CandidateProfile": "app.models.candidate",
    "Company": "app.models.company",
    "Job": "app.models.job",
    "User": "app.models.user",
}


def __getattr__(name: str) -> Any:
    module_name = _MODEL_MODULES.get(name)
    if module_name is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module = importlib.import_module(module_name)
    value = getattr(module, name)
    globals()[name] = value
    return value
