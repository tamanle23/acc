"""
DetectionStrategy — Real-time Object Detection using Hugging Face Transformers (RT-DETR).

Processes image inputs, parses bounding boxes, and formats normalized detection spans.
"""
from __future__ import annotations

import base64
import io
import logging
import os
import time
from typing import Any

import torch
from PIL import Image
from transformers import pipeline

from engines.strategies.base import BasePipelineStrategy
from engines.strategies.registry import StrategyRegistry

logger = logging.getLogger(__name__)


@StrategyRegistry.register("object-detection", "zero-shot-object-detection")
class DetectionStrategy(BasePipelineStrategy):
    strategy_id: str = "rtdetr_detection"
    pipeline_type: str = "object-detection"
    output_modality: str = "bounding_boxes"

    def __init__(self) -> None:
        self.model_id: str = "PekingU/rtdetr_r50vd"
        self.device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype: torch.dtype = torch.float16 if "cuda" in self.device else torch.float32
        self._pipe: Any = None
        self.is_loaded: bool = False

    def load(
        self,
        model_id: str = "PekingU/rtdetr_r50vd",
        device: str = "cuda:0",
        *,
        precision: str = "fp16",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        self.model_id = model_id
        target_device = device if (torch.cuda.is_available() and "cuda" in device and offload_strategy != "cpu_ram_offload") else "cpu"
        self.device = target_device
        self.torch_dtype = torch.float16 if "cuda" in self.device else torch.float32

        logger.info("Loading DetectionStrategy model_id=%s on device=%s", self.model_id, self.device)
        self._pipe = pipeline(
            "object-detection",
            model=self.model_id,
            dtype=self.torch_dtype,
            device=self.device,
            model_kwargs={"use_safetensors": True},
        )
        self.is_loaded = True

        return {
            "status": "ready",
            "engine_id": kwargs.get("engine_id", "rtdetr-v2-vision"),
            "model_id": self.model_id,
            "device": self.device,
            "pipeline_type": self.pipeline_type,
            "modality": self.output_modality,
        }

    @classmethod
    def _extract_pil_image(cls, inputs: Any, parameters: dict[str, Any]) -> Image.Image:
        if isinstance(inputs, Image.Image):
            return inputs.convert("RGB")

        input_str = str(inputs or "").strip()
        if "data:image" in input_str and "base64," in input_str:
            try:
                b64_part = input_str.split("base64,", 1)[1].split()[0]
                return Image.open(io.BytesIO(base64.b64decode(b64_part))).convert("RGB")
            except Exception:
                pass

        param_uri = str(parameters.get("image_data_uri", "")).strip()
        if "data:image" in param_uri and "base64," in param_uri:
            try:
                b64_part = param_uri.split("base64,", 1)[1].split()[0]
                return Image.open(io.BytesIO(base64.b64decode(b64_part))).convert("RGB")
            except Exception:
                pass

        if os.path.exists(input_str) and os.path.isfile(input_str):
            try:
                return Image.open(input_str).convert("RGB")
            except Exception:
                pass

        return Image.new("RGB", (640, 480), color=(128, 140, 160))

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self._pipe:
            raise RuntimeError("DetectionStrategy is not loaded. Call load() first.")

        t0 = time.perf_counter()
        img = self._extract_pil_image(inputs, parameters)
        threshold = float(parameters.get("confidence_threshold", parameters.get("threshold", 0.3)))

        raw_res = self._pipe(img, threshold=threshold)

        clean_boxes = []
        if isinstance(raw_res, list):
            for box in raw_res:
                if isinstance(box, dict):
                    clean_box = {
                        "label": str(box.get("label", "")),
                        "score": round(float(box.get("score", 0.0)), 4),
                        "box": {
                            k: round(float(v), 1)
                            for k, v in box.get("box", {}).items()
                            if isinstance(v, (int, float))
                        },
                    }
                    clean_boxes.append(clean_box)

        latency_ms = (time.perf_counter() - t0) * 1000.0
        return {
            "modality": self.output_modality,
            "pipeline_type": self.pipeline_type,
            "detections": clean_boxes,
            "filtered_detections": clean_boxes,
            "count": len(clean_boxes),
            "output": clean_boxes,
            "device": self.device,
            "latency_ms": round(latency_ms, 2),
        }

    def to(self, device: str) -> "DetectionStrategy":
        if hasattr(self._pipe, "model") and hasattr(self._pipe.model, "to"):
            self._pipe.model.to(device)
            self.device = device
            if hasattr(self._pipe, "device"):
                self._pipe.device = torch.device(device)
        return self

    def unload(self) -> None:
        if self._pipe is not None:
            del self._pipe
            self._pipe = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self.is_loaded = False
        logger.info("DetectionStrategy unloaded")
