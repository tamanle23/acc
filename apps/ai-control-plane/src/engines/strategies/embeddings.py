"""
EmbeddingsStrategy — Dense Vector Embeddings and Text Classification (BGE-M3 / DistilBERT).

Generates L2-normalized float32 vectors, pairwise cosine similarity matrices, or sentiment scores.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import torch
from transformers import AutoModel, AutoTokenizer, pipeline

from engines.strategies.base import BasePipelineStrategy
from engines.strategies.registry import StrategyRegistry

logger = logging.getLogger(__name__)


@StrategyRegistry.register(
    "feature-extraction",
    "sentence-similarity",
    "text-ranking",
    "text-classification",
    "sentiment-analysis",
)
class EmbeddingsStrategy(BasePipelineStrategy):
    strategy_id: str = "bge_m3_embeddings"
    pipeline_type: str = "feature-extraction"
    output_modality: str = "embeddings"

    def __init__(self) -> None:
        self.model_id: str = "BAAI/bge-m3"
        self.device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype: torch.dtype = torch.float16 if "cuda" in self.device else torch.float32
        self.tokenizer: Any = None
        self.model: Any = None
        self._pipe: Any = None
        self.is_classification: bool = False
        self.is_loaded: bool = False

    def load(
        self,
        model_id: str = "BAAI/bge-m3",
        device: str = "cuda:0",
        *,
        task: str = "feature-extraction",
        precision: str = "fp16",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        self.model_id = model_id
        target_device = device if (torch.cuda.is_available() and "cuda" in device and offload_strategy != "cpu_ram_offload") else "cpu"
        self.device = target_device
        self.torch_dtype = torch.float16 if "cuda" in self.device else torch.float32

        norm_task = task.lower().strip()
        self.is_classification = (
            norm_task in ("text-classification", "sentiment-analysis")
            or "sst-2" in self.model_id.lower()
            or "classification" in self.model_id.lower()
        )
        self.pipeline_type = "text-classification" if self.is_classification else "feature-extraction"
        self.output_modality = "classification" if self.is_classification else "embeddings"

        logger.info("Loading EmbeddingsStrategy model_id=%s task=%s on device=%s", self.model_id, self.pipeline_type, self.device)

        if self.is_classification:
            self._pipe = pipeline(
                "text-classification",
                model=self.model_id,
                dtype=self.torch_dtype,
                device=self.device,
                model_kwargs={"use_safetensors": True},
            )
        else:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
            self.model = AutoModel.from_pretrained(
                self.model_id,
                dtype=self.torch_dtype,
            ).to(self.device)
            self.model.eval()

        self.is_loaded = True
        return {
            "status": "ready",
            "engine_id": kwargs.get("engine_id", "bge-m3-embeddings"),
            "model_id": self.model_id,
            "device": self.device,
            "pipeline_type": self.pipeline_type,
            "modality": self.output_modality,
        }

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        t0 = time.perf_counter()

        if self.is_classification:
            if not self._pipe:
                raise RuntimeError("EmbeddingsStrategy (classification) is not loaded.")
            text = str(inputs or parameters.get("text") or "")
            raw_out = self._pipe(text)
            top = raw_out[0] if isinstance(raw_out, list) and raw_out else raw_out
            latency_ms = (time.perf_counter() - t0) * 1000.0
            return {
                "modality": "classification",
                "pipeline_type": self.pipeline_type,
                "label": top.get("label", "POSITIVE") if isinstance(top, dict) else "POSITIVE",
                "score": round(float(top.get("score", 0.99)), 4) if isinstance(top, dict) else 0.99,
                "output": raw_out,
                "device": self.device,
                "latency_ms": round(latency_ms, 2),
            }

        # Feature Extraction / Embeddings
        if not self.model or not self.tokenizer:
            raise RuntimeError("EmbeddingsStrategy (feature-extraction) is not loaded.")

        if isinstance(inputs, list):
            items = [str(x) for x in inputs if str(x).strip()]
        elif isinstance(inputs, str):
            items = [line.strip() for line in inputs.splitlines() if line.strip()]
        else:
            items = [str(inputs)]

        if not items:
            items = ["Unified AI control plane telemetry"]

        encoded = self.tokenizer(items, padding=True, truncation=True, return_tensors="pt")
        if hasattr(encoded, "to"):
            encoded = encoded.to(self.device)
        elif isinstance(encoded, dict):
            encoded = {k: (v.to(self.device) if hasattr(v, "to") else v) for k, v in encoded.items()}
        with torch.no_grad():
            out = self.model(**encoded)
            attention_mask = encoded.get("attention_mask")
            if attention_mask is None:
                attention_mask = torch.ones(out.last_hidden_state.shape[:2], device=self.device)
            elif not isinstance(attention_mask, torch.Tensor):
                attention_mask = torch.tensor(attention_mask, device=self.device)
            attention_mask = attention_mask.unsqueeze(-1)
            embeddings = torch.sum(out.last_hidden_state * attention_mask, dim=1) / torch.clamp(
                attention_mask.sum(dim=1), min=1e-9
            )
            embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
            sim_matrix = torch.matmul(embeddings, embeddings.T).cpu().tolist()
            vec_list = embeddings.cpu().tolist()

        latency_ms = (time.perf_counter() - t0) * 1000.0
        return {
            "modality": "embeddings",
            "pipeline_type": self.pipeline_type,
            "count": len(items),
            "items": items,
            "dimensions": len(vec_list[0]) if vec_list else 0,
            "embeddings": vec_list,
            "output": vec_list,
            "similarity_matrix": sim_matrix,
            "device": self.device,
            "latency_ms": round(latency_ms, 2),
        }

    def to(self, device: str) -> "EmbeddingsStrategy":
        if self.model is not None and hasattr(self.model, "to"):
            self.model.to(device)
            self.device = device
        elif self._pipe is not None and hasattr(self._pipe, "model") and hasattr(self._pipe.model, "to"):
            self._pipe.model.to(device)
            self.device = device
        return self

    def unload(self) -> None:
        if self.model is not None:
            del self.model
            self.model = None
        if self.tokenizer is not None:
            del self.tokenizer
            self.tokenizer = None
        if self._pipe is not None:
            del self._pipe
            self._pipe = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self.is_loaded = False
        logger.info("EmbeddingsStrategy unloaded")
