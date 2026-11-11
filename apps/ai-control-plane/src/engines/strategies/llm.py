"""
LlmGenerationStrategy — Text & Chat generation using Hugging Face CausalLM and VLM.

Supports DeepSeek-R1, Qwen2.5-Coder, Qwen2.5-VL with native PyTorch SDPA attention
and TextIteratorStreamer token streaming.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any, AsyncIterator, Iterator

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer

from engines.strategies.base import BasePipelineStrategy
from engines.strategies.registry import StrategyRegistry

logger = logging.getLogger(__name__)


@StrategyRegistry.register("text-generation", "chat-completion", "llm", "image-text-to-text")
class LlmGenerationStrategy(BasePipelineStrategy):
    strategy_id: str = "transformers_causallm"
    pipeline_type: str = "text-generation"
    output_modality: str = "token_stream"

    def __init__(self) -> None:
        self.model_id: str = "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B"
        self.device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype: torch.dtype = torch.bfloat16 if (torch.cuda.is_available() and torch.cuda.is_bf16_supported()) else (torch.float16 if torch.cuda.is_available() else torch.float32)
        self.tokenizer: Any = None
        self.model: Any = None
        self.is_loaded: bool = False

    def load(
        self,
        model_id: str = "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
        device: str = "cuda:0",
        *,
        precision: str = "bf16",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        self.model_id = model_id
        target_device = device if (torch.cuda.is_available() and "cuda" in device and offload_strategy != "cpu_ram_offload") else "cpu"
        self.device = target_device

        if precision == "bf16" and torch.cuda.is_available() and torch.cuda.is_bf16_supported():
            self.torch_dtype = torch.bfloat16
        elif precision in ("fp16", "bf16") and torch.cuda.is_available():
            self.torch_dtype = torch.float16
        else:
            self.torch_dtype = torch.float32

        logger.info("Loading LlmGenerationStrategy model_id=%s on device=%s dtype=%s", self.model_id, self.device, self.torch_dtype)

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_id, trust_remote_code=True)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        try:
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_id,
                dtype=self.torch_dtype,
                device_map=self.device,
                trust_remote_code=True,
            )
        except Exception as exc:
            logger.warning("AutoModelForCausalLM failed for %s (%s); trying conditional/VLM loader", self.model_id, exc)
            try:
                from transformers import Qwen2_5_VLForConditionalGeneration
                self.model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
                    self.model_id,
                    dtype=self.torch_dtype,
                    device_map=self.device,
                    trust_remote_code=True,
                )
            except Exception:
                fallback_id = "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B"
                logger.warning("Falling back to default causal LM %s", fallback_id)
                self.tokenizer = AutoTokenizer.from_pretrained(fallback_id, trust_remote_code=True)
                if self.tokenizer.pad_token is None:
                    self.tokenizer.pad_token = self.tokenizer.eos_token
                self.model = AutoModelForCausalLM.from_pretrained(
                    fallback_id,
                    dtype=self.torch_dtype,
                    device_map=self.device,
                    trust_remote_code=True,
                )

        self.model.eval()
        self.is_loaded = True

        return {
            "status": "ready",
            "engine_id": kwargs.get("engine_id", "deepseek-r1-distill-qwen"),
            "model_id": self.model_id,
            "device": self.device,
            "pipeline_type": self.pipeline_type,
            "modality": self.output_modality,
        }

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self.model or not self.tokenizer:
            raise RuntimeError("LlmGenerationStrategy is not loaded. Call load() first.")

        t0 = time.perf_counter()
        prompt = str(inputs or parameters.get("prompt") or "")
        max_new_tokens = int(parameters.get("max_new_tokens", 128))
        temperature = float(parameters.get("temperature", 0.7))
        top_p = float(parameters.get("top_p", 0.9))

        enc = self.tokenizer(prompt, return_tensors="pt")
        if hasattr(enc, "to"):
            enc = enc.to(self.device)
        elif isinstance(enc, dict):
            enc = {k: (v.to(self.device) if hasattr(v, "to") else v) for k, v in enc.items()}
        gen_kwargs: dict[str, Any] = {
            **enc,
            "max_new_tokens": max_new_tokens,
            "pad_token_id": self.tokenizer.pad_token_id,
            "eos_token_id": self.tokenizer.eos_token_id,
        }
        if temperature > 0:
            gen_kwargs["do_sample"] = True
            gen_kwargs["temperature"] = temperature
            gen_kwargs["top_p"] = top_p
        else:
            gen_kwargs["do_sample"] = False

        with torch.no_grad():
            out_ids = self.model.generate(**gen_kwargs)

        input_len = enc["input_ids"].shape[1]
        new_tokens = out_ids[0][input_len:]
        gen_text = self.tokenizer.decode(new_tokens, skip_special_tokens=True)
        full_text = self.tokenizer.decode(out_ids[0], skip_special_tokens=True)

        latency_ms = (time.perf_counter() - t0) * 1000.0
        tps = round(len(new_tokens) / max(0.001, latency_ms / 1000.0), 1)

        return {
            "modality": self.output_modality,
            "pipeline_type": self.pipeline_type,
            "generated_text": full_text,
            "answer_markdown": gen_text or full_text,
            "tokens_generated": len(new_tokens),
            "tokens_per_sec": tps,
            "latency_ms": round(latency_ms, 2),
            "device": self.device,
        }

    def infer_stream(self, inputs: Any, parameters: dict[str, Any]) -> Iterator[str]:
        if not self.model or not self.tokenizer:
            raise RuntimeError("LlmGenerationStrategy is not loaded. Call load() first.")

        prompt = str(inputs or parameters.get("prompt") or "")
        max_new_tokens = int(parameters.get("max_new_tokens", 512))
        temperature = float(parameters.get("temperature", 0.7))
        top_p = float(parameters.get("top_p", 0.9))

        enc = self.tokenizer(prompt, return_tensors="pt")
        if hasattr(enc, "to"):
            enc = enc.to(self.device)
        elif isinstance(enc, dict):
            enc = {k: (v.to(self.device) if hasattr(v, "to") else v) for k, v in enc.items()}
        streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)

        gen_kwargs: dict[str, Any] = {
            **enc,
            "streamer": streamer,
            "max_new_tokens": max_new_tokens,
            "pad_token_id": self.tokenizer.pad_token_id,
            "eos_token_id": self.tokenizer.eos_token_id,
        }
        if temperature > 0:
            gen_kwargs["do_sample"] = True
            gen_kwargs["temperature"] = temperature
            gen_kwargs["top_p"] = top_p
        else:
            gen_kwargs["do_sample"] = False

        thread = threading.Thread(target=self.model.generate, kwargs=gen_kwargs)
        thread.start()

        for token in streamer:
            if token:
                yield token

        thread.join(timeout=2.0)

    def to(self, device: str) -> "LlmGenerationStrategy":
        if hasattr(self.model, "to"):
            self.model.to(device)
            self.device = device
        return self

    def unload(self) -> None:
        if self.model is not None:
            del self.model
            self.model = None
        if self.tokenizer is not None:
            del self.tokenizer
            self.tokenizer = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self.is_loaded = False
        logger.info("LlmGenerationStrategy unloaded")
