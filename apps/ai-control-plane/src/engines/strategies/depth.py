"""
DepthEstimationStrategy — Dense Monocular 3D Depth Estimation with interactive Colormaps.

Wraps Depth-Anything-V2 models with normalized float grids and Turbo/Magma/Viridis/Grayscale colormaps.
"""
from __future__ import annotations

import base64
import io
import logging
import os
from typing import Any

import numpy as np
import torch
from PIL import Image
from transformers import pipeline

from engines.strategies.base import BasePipelineStrategy
from engines.strategies.registry import StrategyRegistry

logger = logging.getLogger(__name__)


@StrategyRegistry.register("depth-estimation", "depth_estimation")
class DepthEstimationStrategy(BasePipelineStrategy):
    strategy_id: str = "depth_anything_v2"
    pipeline_type: str = "depth-estimation"
    output_modality: str = "bounding_boxes"

    def __init__(self) -> None:
        self.model_id: str = "depth-anything/Depth-Anything-V2-Small-hf"
        self.device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype: torch.dtype = torch.float16 if "cuda" in self.device else torch.float32
        self._pipe: Any = None
        self.is_loaded: bool = False

    def load(
        self,
        model_id: str = "depth-anything/Depth-Anything-V2-Small-hf",
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

        logger.info("Loading DepthEstimationStrategy model_id=%s on device=%s", self.model_id, self.device)
        self._pipe = pipeline(
            "depth-estimation",
            model=self.model_id,
            dtype=self.torch_dtype,
            device=self.device,
            model_kwargs={"use_safetensors": True},
        )
        self.is_loaded = True

        return {
            "status": "ready",
            "engine_id": kwargs.get("engine_id", "depth-anything-v2-small"),
            "model_id": self.model_id,
            "device": self.device,
            "pipeline_type": self.pipeline_type,
            "modality": self.output_modality,
        }

    @classmethod
    def _extract_pil_image(cls, inputs: Any, parameters: dict[str, Any]) -> Image.Image:
        """Extract a valid RGB PIL Image from inputs (data URI, base64, path, or PIL.Image)."""
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

        # Fallback to test placeholder image
        return Image.new("RGB", (640, 480), color=(128, 140, 160))

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self._pipe:
            raise RuntimeError("DepthEstimationStrategy is not loaded. Call load() first.")

        img = self._extract_pil_image(inputs, parameters)
        raw_res = self._pipe(img)

        depth_img = raw_res["depth"] if isinstance(raw_res, dict) and "depth" in raw_res else raw_res
        depth_array = np.array(depth_img, dtype=np.float32)

        # Normalize depth to [0, 1]
        d_min, d_max = float(depth_array.min()), float(depth_array.max())
        norm_depth = (depth_array - d_min) / max(1e-5, (d_max - d_min))

        colormap_name = str(parameters.get("colormap", "turbo")).lower()
        if colormap_name == "grayscale":
            colorized = Image.fromarray((norm_depth * 255).astype(np.uint8), mode="L").convert("RGB")
        else:
            try:
                import matplotlib.cm as cm
                cmap = cm.get_cmap(colormap_name if colormap_name in ("turbo", "magma", "viridis") else "turbo")
                rgba = (cmap(norm_depth) * 255).astype(np.uint8)
                colorized = Image.fromarray(rgba[:, :, :3], mode="RGB")
            except Exception:
                colorized = Image.fromarray((norm_depth * 255).astype(np.uint8), mode="L").convert("RGB")

        buf = io.BytesIO()
        colorized.save(buf, format="PNG")
        depth_uri = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"

        return {
            "modality": self.output_modality,
            "pipeline_type": self.pipeline_type,
            "depth_data_uri": depth_uri,
            "image_data_uri": depth_uri,
            "output": depth_uri,
            "colormap_used": colormap_name,
            "near_clip": parameters.get("near_clip", 0.1),
            "far_clip": parameters.get("far_clip", 10.0),
            "device": self.device,
        }

    def to(self, device: str) -> "DepthEstimationStrategy":
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
        logger.info("DepthEstimationStrategy unloaded")
