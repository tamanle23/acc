"""
DiffusionStrategy — Image synthesis using Diffusers (FLUX.1-schnell / SD-Turbo / SDXL).

Handles aspect-ratio dimension alignment to multiples of 8, guidance scales, seeds, and PNG data URIs.
"""
from __future__ import annotations

import base64
import io
import logging
import os
from typing import Any

import torch
from PIL import Image

from engines.strategies.base import BasePipelineStrategy
from engines.strategies.registry import StrategyRegistry

logger = logging.getLogger(__name__)


@StrategyRegistry.register("text-to-image", "image-to-image", "diffusion")
class DiffusionStrategy(BasePipelineStrategy):
    strategy_id: str = "diffusion_diffusers"
    pipeline_type: str = "text-to-image"
    output_modality: str = "generated_image"

    def __init__(self) -> None:
        self.model_id: str = "black-forest-labs/FLUX.1-schnell"
        self.device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype: torch.dtype = torch.bfloat16 if (torch.cuda.is_available() and torch.cuda.is_bf16_supported()) else (torch.float16 if torch.cuda.is_available() else torch.float32)
        self.pipe: Any = None
        self.is_loaded: bool = False

    def load(
        self,
        model_id: str = "black-forest-labs/FLUX.1-schnell",
        device: str = "cuda:0",
        *,
        precision: str = "bf16",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        from diffusers import AutoPipelineForText2Image, DiffusionPipeline  # type: ignore[import-untyped]

        target_model_id = model_id
        hf_cache_dir = os.path.expanduser(f"~/.cache/huggingface/hub/models--{model_id.replace('/', '--')}")
        if not os.path.exists(hf_cache_dir) and "sd-turbo" in target_model_id.lower():
            target_model_id = "stabilityai/sd-turbo"

        self.model_id = target_model_id
        target_device = device if (torch.cuda.is_available() and "cuda" in device and offload_strategy != "cpu_ram_offload") else "cpu"
        self.device = target_device

        if precision == "bf16" and torch.cuda.is_available() and torch.cuda.is_bf16_supported():
            self.torch_dtype = torch.bfloat16
        elif precision in ("fp16", "bf16") and torch.cuda.is_available():
            self.torch_dtype = torch.float16
        else:
            self.torch_dtype = torch.float32

        logger.info("Loading DiffusionStrategy model_id=%s on device=%s dtype=%s", self.model_id, self.device, self.torch_dtype)

        pipe_cls = AutoPipelineForText2Image or DiffusionPipeline
        pipe = pipe_cls.from_pretrained(
            self.model_id,
            torch_dtype=self.torch_dtype,
            variant="fp16" if self.torch_dtype == torch.float16 else None,
        )

        if torch.cuda.is_available() and offload_strategy != "cpu_ram_offload" and "cpu" not in self.device:
            pipe.to(self.device)
        elif torch.cuda.is_available() and hasattr(pipe, "enable_model_cpu_offload"):
            try:
                pipe.enable_model_cpu_offload()
            except Exception:
                pipe.to("cpu")
        else:
            pipe.to("cpu")

        self.pipe = pipe
        self.is_loaded = True

        return {
            "status": "ready",
            "engine_id": kwargs.get("engine_id", "flux-1-schnell"),
            "model_id": self.model_id,
            "device": self.device,
            "pipeline_type": self.pipeline_type,
            "modality": self.output_modality,
        }

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self.pipe:
            raise RuntimeError("DiffusionStrategy is not loaded. Call load() first.")

        prompt = str(inputs or parameters.get("prompt") or "")
        steps = int(parameters.get("num_inference_steps", 4))
        guidance = float(parameters.get("guidance_scale", 3.5))
        width = int(parameters.get("width", 512))
        height = int(parameters.get("height", 512))

        aspect_ratio = str(parameters.get("aspect_ratio", ""))
        if "x" in aspect_ratio:
            try:
                w_str, h_str = aspect_ratio.split("x", 1)
                width, height = int(w_str), int(h_str)
            except ValueError:
                pass

        # Clamp dimensions to multiple of 8
        width = max(64, (width // 8) * 8)
        height = max(64, (height // 8) * 8)

        generator = None
        seed = parameters.get("seed")
        if seed is not None:
            generator = torch.Generator(device=self.device if "cuda" in self.device else "cpu").manual_seed(int(seed))

        call_kwargs: dict[str, Any] = {
            "prompt": prompt,
            "num_inference_steps": steps,
            "guidance_scale": guidance,
            "width": width,
            "height": height,
        }
        if generator is not None:
            call_kwargs["generator"] = generator

        with torch.no_grad():
            res = self.pipe(**call_kwargs)

        img: Image.Image = res.images[0]
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        image_uri = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"

        return {
            "modality": self.output_modality,
            "pipeline_type": self.pipeline_type,
            "image_data_uri": image_uri,
            "output": image_uri,
            "width": width,
            "height": height,
            "steps": steps,
            "guidance_scale": guidance,
            "seed": seed,
            "device": self.device,
        }

    def to(self, device: str) -> "DiffusionStrategy":
        if hasattr(self.pipe, "to"):
            self.pipe.to(device)
            self.device = device
        return self

    def unload(self) -> None:
        if self.pipe is not None:
            del self.pipe
            self.pipe = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self.is_loaded = False
        logger.info("DiffusionStrategy unloaded")
