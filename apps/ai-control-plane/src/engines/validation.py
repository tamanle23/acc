"""Declarative pre-flight validation and clamping engine for polymorphic inference requests."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from core.exceptions import InvalidInferenceRequestError

if TYPE_CHECKING:
    from core.protocols import UniversalInferenceRequest
    from engines.catalog_registry import ModelCapabilityManifest

logger = logging.getLogger(__name__)


def validate_and_clamp_request(
    manifest: ModelCapabilityManifest,
    request: UniversalInferenceRequest,
) -> UniversalInferenceRequest:
    """Pre-flight validate slot presence and clamp parameters to schema boundaries."""
    slots = request.slots
    input_text = request.as_text().strip()

    # 1. Structural Slot Presence Validation
    for slot in manifest.resolved_input_slots:
        if slot.required:
            val = slots.get(slot.slot_id)
            if slot.role == "prompt":
                val = val or input_text
                if not val:
                    raise InvalidInferenceRequestError(
                        f"Missing required input slot '{slot.slot_id}' ({slot.label}) for '{manifest.engine_id}'."
                    )
            elif slot.role == "source_media":
                has_bytes = bool(request.binary_bytes or request.binary_files.get(slot.slot_id))
                has_val = bool(val or (isinstance(request.inputs, str) and ("data:" in request.inputs or "http" in request.inputs or len(request.inputs) > 0)))
                if not has_bytes and not has_val:
                    raise InvalidInferenceRequestError(
                        f"Missing required source media slot '{slot.slot_id}' ({slot.label}) for '{manifest.engine_id}'."
                    )

    # 2. Hyperparameter Clamping & Fallback
    params = dict(request.parameters)
    for field in manifest.parameters_schema:
        val = params.get(field.key)
        if val is None:
            continue

        if field.type == "slider":
            try:
                num_val = float(val)
                if field.min is not None and num_val < field.min:
                    logger.warning(
                        "Parameter '%s' value %s below minimum %s for '%s'; clamping to %s.",
                        field.key,
                        val,
                        field.min,
                        manifest.engine_id,
                        field.min,
                    )
                    num_val = float(field.min)
                if field.max is not None and num_val > field.max:
                    logger.warning(
                        "Parameter '%s' value %s exceeds maximum %s for '%s'; clamping to %s.",
                        field.key,
                        val,
                        field.max,
                        manifest.engine_id,
                        field.max,
                    )
                    num_val = float(field.max)
                params[field.key] = (
                    int(round(num_val))
                    if isinstance(field.default, int) and (field.step is None or field.step >= 1)
                    else num_val
                )
            except (ValueError, TypeError):
                logger.warning(
                    "Invalid numerical value '%s' for parameter '%s' on '%s'; falling back to default %s.",
                    val,
                    field.key,
                    manifest.engine_id,
                    field.default,
                )
                params[field.key] = field.default

        elif field.type == "select" and field.options:
            allowed = {opt["value"] for opt in field.options}
            str_val = str(val)
            is_tts_voice = field.key == "voice" and manifest.family == "tts"
            has_clone = is_tts_voice and (params.get("ref_audio_path") or slots.get("ref_audio"))
            if str_val not in allowed and not has_clone:
                logger.warning(
                    "Unrecognized option '%s' for parameter '%s' on '%s'; falling back to default '%s'.",
                    str_val,
                    field.key,
                    manifest.engine_id,
                    field.default,
                )
                params[field.key] = field.default
                if field.key in slots:
                    slots[field.key] = field.default

    request.parameters = params
    request.slots = slots
    return request
