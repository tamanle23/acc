"""
SegmentationStrategy — High-precision foreground extraction and 8-bit Alpha Matte generation.

Wraps BRIA RMBG-2.0 and RMBG-1.4 with automatic license checking and RGBA cutout compositing.
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
from transformers import AutoModelForImageSegmentation

from engines.strategies.base import BasePipelineStrategy
from engines.strategies.registry import StrategyRegistry

logger = logging.getLogger(__name__)


@StrategyRegistry.register("image-segmentation", "segmentation")
class SegmentationStrategy(BasePipelineStrategy):
    strategy_id: str = "bria_rmbg"
    pipeline_type: str = "image-segmentation"
    output_modality: str = "bounding_boxes"

    def __init__(self) -> None:
        self.model_id: str = "briaai/RMBG-2.0"
        self.device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype: torch.dtype = torch.float16 if "cuda" in self.device else torch.float32
        self.model: Any = None
        self.is_loaded: bool = False

    def load(
        self,
        model_id: str = "briaai/RMBG-2.0",
        device: str = "cuda:0",
        *,
        precision: str = "fp16",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        target_model = model_id
        hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

        # Graceful fallback when gated RMBG-2.0 is requested without HF_TOKEN
        if "rmbg-2" in target_model.lower() and not hf_token:
            logger.warning(
                "HF_TOKEN not set — falling back to open-access RMBG-1.4 (briaai/RMBG-1.4). "
                "Set HF_TOKEN env var and accept the RMBG-2.0 license to use the gated model."
            )
            target_model = "briaai/RMBG-1.4"

        self.model_id = target_model
        target_device = device if (torch.cuda.is_available() and "cuda" in device and offload_strategy != "cpu_ram_offload") else "cpu"
        self.device = target_device
        self.torch_dtype = torch.float16 if "cuda" in self.device else torch.float32

        # Patch tied weights for newer transformers compatibility
        if hasattr(torch.nn.Module, "all_tied_weights_keys"):
            torch.nn.Module.all_tied_weights_keys = {}

        logger.info("Loading SegmentationStrategy model_id=%s on device=%s", self.model_id, self.device)
        self.model = AutoModelForImageSegmentation.from_pretrained(
            self.model_id,
            trust_remote_code=True,
            dtype=self.torch_dtype,
        ).to(self.device)
        self.model.eval()
        self.is_loaded = True

        return {
            "status": "ready",
            "engine_id": kwargs.get("engine_id", "bria-rmbg-2.0"),
            "model_id": self.model_id,
            "device": self.device,
            "pipeline_type": self.pipeline_type,
            "modality": self.output_modality,
        }

    @classmethod
    def _extract_pil_image(cls, inputs: Any, parameters: dict[str, Any], width: int, height: int) -> Image.Image:
        source_img: Image.Image | None = None
        if isinstance(inputs, Image.Image):
            source_img = inputs.convert("RGB")
        else:
            input_str = str(inputs or "").strip()
            if "data:image" in input_str and "base64," in input_str:
                try:
                    b64_part = input_str.split("base64,", 1)[1].split()[0]
                    source_img = Image.open(io.BytesIO(base64.b64decode(b64_part))).convert("RGB")
                except Exception:
                    pass
            elif os.path.exists(input_str) and os.path.isfile(input_str):
                try:
                    source_img = Image.open(input_str).convert("RGB")
                except Exception:
                    pass

        if source_img is None:
            param_uri = str(parameters.get("image_data_uri", "")).strip()
            if "data:image" in param_uri and "base64," in param_uri:
                try:
                    b64_part = param_uri.split("base64,", 1)[1].split()[0]
                    source_img = Image.open(io.BytesIO(base64.b64decode(b64_part))).convert("RGB")
                except Exception:
                    pass

        if source_img is None:
            source_img = Image.new("RGB", (width, height), color=(64, 128, 200))
        return source_img.resize((width, height), Image.Resampling.LANCZOS)

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self.model:
            raise RuntimeError("SegmentationStrategy is not loaded. Call load() first.")

        width = int(parameters.get("width", 1024))
        height = int(parameters.get("height", 1024))
        out_res = str(parameters.get("output_resolution", ""))
        if "x" in out_res:
            try:
                w_str, h_str = out_res.split("x", 1)
                width, height = int(w_str), int(h_str)
            except ValueError:
                pass
        mask_threshold = float(parameters.get("mask_threshold", 0.5))

        source_img = self._extract_pil_image(inputs, parameters, width, height)

        # Preprocess tensor for RMBG / BiRefNet
        im_np = np.array(source_img, dtype=np.float32) / 255.0
        im_tensor = torch.tensor(im_np).permute(2, 0, 1).unsqueeze(0).float().to(self.device)
        mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1).to(self.device)
        std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1).to(self.device)
        im_tensor = (im_tensor - mean) / std

        with torch.no_grad():
            res = self.model(im_tensor)

        while isinstance(res, (tuple, list)):
            res = res[0]
        if isinstance(res, dict):
            res = list(res.values())[0]
        while isinstance(res, (tuple, list)):
            res = res[0]
        if hasattr(res, "detach"):
            res = res.detach()
        if not isinstance(res, torch.Tensor):
            res = torch.tensor(res)

        mask_arr = torch.sigmoid(res).cpu().numpy()
        while mask_arr.ndim > 2:
            mask_arr = mask_arr[0]
        mask_uint8 = (mask_arr * 255.0).astype(np.uint8)
        mask_img = Image.fromarray(mask_uint8, mode="L")
        if mask_img.size != (width, height):
            mask_img = mask_img.resize((width, height), Image.Resampling.BILINEAR)

        segmented_rgba = source_img.copy().convert("RGBA")
        segmented_rgba.putalpha(mask_img)
        alpha_mask_rgb = mask_img.convert("RGB")

        orig_buf = io.BytesIO()
        source_img.save(orig_buf, format="PNG")
        orig_uri = f"data:image/png;base64,{base64.b64encode(orig_buf.getvalue()).decode('ascii')}"

        seg_buf = io.BytesIO()
        segmented_rgba.save(seg_buf, format="PNG")
        seg_uri = f"data:image/png;base64,{base64.b64encode(seg_buf.getvalue()).decode('ascii')}"

        mask_buf = io.BytesIO()
        alpha_mask_rgb.save(mask_buf, format="PNG")
        mask_uri = f"data:image/png;base64,{base64.b64encode(mask_buf.getvalue()).decode('ascii')}"

        fg_coverage = float(np.mean(mask_arr > mask_threshold) * 100.0)

        return {
            "modality": "bounding_boxes",
            "vision_submode": "alpha_matte_segmentation",
            "pipeline_type": self.pipeline_type,
            "original_image_data_uri": orig_uri,
            "segmented_image_data_uri": seg_uri,
            "alpha_mask_data_uri": mask_uri,
            "image_data_uri": seg_uri,
            "output": seg_uri,
            "foreground_coverage_pct": round(fg_coverage, 1),
            "width": width,
            "height": height,
            "device": self.device,
        }

    def to(self, device: str) -> "SegmentationStrategy":
        if hasattr(self.model, "to"):
            self.model.to(device)
            self.device = device
        return self

    def unload(self) -> None:
        if self.model is not None:
            del self.model
            self.model = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self.is_loaded = False
        logger.info("SegmentationStrategy unloaded")
