"""Zero-dependency pure-Python binary parser for GGUF model files (v2 and v3).

Extracts model metadata, architecture, tensor counts, context lengths, and quantization
types directly from binary headers without requiring C++ compilation or llama-cpp-python.
"""

from __future__ import annotations

import io
import os
import struct
from typing import Any, BinaryIO


GGUF_MAGIC = b"GGUF"  # 0x46554747 in little-endian

# GGUF Value Types
GGUF_TYPE_UINT8 = 0
GGUF_TYPE_INT8 = 1
GGUF_TYPE_UINT16 = 2
GGUF_TYPE_INT16 = 3
GGUF_TYPE_UINT32 = 4
GGUF_TYPE_INT32 = 5
GGUF_TYPE_FLOAT32 = 6
GGUF_TYPE_BOOL = 7
GGUF_TYPE_STRING = 8
GGUF_TYPE_ARRAY = 9
GGUF_TYPE_UINT64 = 10
GGUF_TYPE_INT64 = 11
GGUF_TYPE_FLOAT64 = 12

_TYPE_FORMATS = {
    GGUF_TYPE_UINT8: ("<B", 1),
    GGUF_TYPE_INT8: ("<b", 1),
    GGUF_TYPE_UINT16: ("<H", 2),
    GGUF_TYPE_INT16: ("<h", 2),
    GGUF_TYPE_UINT32: ("<I", 4),
    GGUF_TYPE_INT32: ("<i", 4),
    GGUF_TYPE_FLOAT32: ("<f", 4),
    GGUF_TYPE_BOOL: ("<?", 1),
    GGUF_TYPE_UINT64: ("<Q", 8),
    GGUF_TYPE_INT64: ("<q", 8),
    GGUF_TYPE_FLOAT64: ("<d", 8),
}

# GGUF Quantization type mappings (GGML_TYPE enum)
QUANT_NAMES = {
    0: "F32",
    1: "F16",
    2: "Q4_0",
    3: "Q4_1",
    6: "Q5_0",
    7: "Q5_1",
    8: "Q8_0",
    9: "Q8_1",
    10: "Q2_K",
    11: "Q3_K",
    12: "Q4_K",
    13: "Q5_K",
    14: "Q6_K",
    15: "Q8_K",
    16: "IQ2_XXS",
    17: "IQ2_XS",
    18: "IQ3_XXS",
    19: "IQ1_S",
    20: "IQ4_NL",
    21: "IQ3_S",
    22: "IQ2_S",
    23: "IQ4_XS",
    24: "I8",
    25: "I16",
    26: "I32",
    27: "I64",
    28: "F64",
    29: "IQ1_M",
    30: "BF16",
}


def _read_str(f: BinaryIO) -> str:
    raw_len = f.read(8)
    if len(raw_len) < 8:
        raise ValueError("Unexpected EOF reading string length")
    (s_len,) = struct.unpack("<Q", raw_len)
    s_bytes = f.read(s_len)
    return s_bytes.decode("utf-8", errors="replace")


def _read_value(f: BinaryIO, vtype: int, depth: int = 0) -> Any:
    if depth > 4:
        return "<nested_array_overflow>"

    if vtype == GGUF_TYPE_STRING:
        return _read_str(f)

    if vtype == GGUF_TYPE_ARRAY:
        raw_arr_header = f.read(12)
        if len(raw_arr_header) < 12:
            raise ValueError("Unexpected EOF reading array header")
        elem_type, arr_len = struct.unpack("<IQ", raw_arr_header)
        # Cap array reading to first 64 items to avoid slow memory overhead on massive tensors
        items = []
        for i in range(arr_len):
            val = _read_value(f, elem_type, depth=depth + 1)
            if i < 64:
                items.append(val)
        return items

    if vtype in _TYPE_FORMATS:
        fmt, size = _TYPE_FORMATS[vtype]
        raw = f.read(size)
        if len(raw) < size:
            raise ValueError(f"Unexpected EOF reading type {vtype}")
        (val,) = struct.unpack(fmt, raw)
        return val

    raise ValueError(f"Unknown GGUF value type: {vtype}")


class GgufMetadata:
    """Parsed GGUF metadata container with derived architecture and VRAM estimates."""

    def __init__(
        self,
        version: int,
        tensor_count: int,
        metadata: dict[str, Any],
        file_size_bytes: int = 0,
    ) -> None:
        self.version = version
        self.tensor_count = tensor_count
        self.metadata = metadata
        self.file_size_bytes = file_size_bytes

    @property
    def architecture(self) -> str:
        return str(self.metadata.get("general.architecture", "llama"))

    @property
    def model_name(self) -> str:
        return str(self.metadata.get("general.name", self.architecture))

    @property
    def context_length(self) -> int:
        arch = self.architecture
        return int(
            self.metadata.get(
                f"{arch}.context_length",
                self.metadata.get("llama.context_length", 4096),
            )
        )

    @property
    def block_count(self) -> int:
        """Total transformer layers / blocks in the model."""
        arch = self.architecture
        return int(
            self.metadata.get(
                f"{arch}.block_count",
                self.metadata.get("llama.block_count", 32),
            )
        )

    @property
    def file_type_id(self) -> int:
        return int(self.metadata.get("general.file_type", 1))

    @property
    def quantization_type(self) -> str:
        ft = self.file_type_id
        return QUANT_NAMES.get(ft, f"TYPE_{ft}")

    def calculate_optimal_gpu_layers(self, vram_budget_mb: int) -> int:
        """Calculate optimal `n_gpu_layers` to offload given total VRAM budget in MB."""
        total_layers = self.block_count
        if total_layers <= 0:
            return 0

        # Estimate weights size in MB from file size or tensor counts
        weights_mb = (
            self.file_size_bytes / (1024 * 1024)
            if self.file_size_bytes > 0
            else max(512, self.tensor_count * 15)
        )
        # Add ~512 MB for KV-cache and CUDA context overhead
        overhead_mb = 512
        available_for_layers = max(0, vram_budget_mb - overhead_mb)

        if available_for_layers >= weights_mb:
            return total_layers  # Full GPU offloading

        # Pro-rated layer fraction
        ratio = available_for_layers / max(weights_mb, 1.0)
        recommended = int(total_layers * ratio)
        return max(0, min(total_layers, recommended))

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "architecture": self.architecture,
            "model_name": self.model_name,
            "tensor_count": self.tensor_count,
            "context_length": self.context_length,
            "block_count": self.block_count,
            "quantization_type": self.quantization_type,
            "file_size_mb": round(self.file_size_bytes / (1024 * 1024), 2),
            "key_count": len(self.metadata),
        }


def read_gguf_metadata(source: str | bytes | BinaryIO) -> GgufMetadata:
    """Read and parse GGUF binary metadata from a file path, raw bytes, or stream."""
    close_stream = False
    file_size = 0

    if isinstance(source, (str, os.PathLike)):
        p = str(source)
        if not os.path.isfile(p):
            raise FileNotFoundError(f"GGUF model file not found: {p}")
        file_size = os.path.getsize(p)
        f: BinaryIO = open(p, "rb")
        close_stream = True
    elif isinstance(source, bytes):
        file_size = len(source)
        f = io.BytesIO(source)
    else:
        f = source

    try:
        magic = f.read(4)
        if magic != GGUF_MAGIC:
            raise ValueError(f"Invalid GGUF magic bytes: {magic!r} (expected {GGUF_MAGIC!r})")

        raw_header = f.read(20)
        if len(raw_header) < 20:
            raise ValueError("Corrupt GGUF header (less than 24 bytes total)")

        version, tensor_count, kv_count = struct.unpack("<IQQ", raw_header)
        if version not in (2, 3):
            # We support v2 and v3
            pass

        metadata: dict[str, Any] = {}
        for _ in range(kv_count):
            k = _read_str(f)
            raw_vtype = f.read(4)
            if len(raw_vtype) < 4:
                break
            (vtype,) = struct.unpack("<I", raw_vtype)
            val = _read_value(f, vtype)
            metadata[k] = val

        return GgufMetadata(
            version=version,
            tensor_count=tensor_count,
            metadata=metadata,
            file_size_bytes=file_size,
        )
    finally:
        if close_stream:
            f.close()


def create_synthetic_gguf_bytes(
    arch: str = "llama",
    block_count: int = 32,
    context_length: int = 4096,
    file_type: int = 12,  # Q4_K
    tensor_count: int = 291,
) -> bytes:
    """Utility to generate a valid, synthetic GGUF binary header for testing without huge downloads."""
    buf = io.BytesIO()
    buf.write(GGUF_MAGIC)
    version = 3

    kvs: list[tuple[str, int, Any]] = [
        ("general.architecture", GGUF_TYPE_STRING, arch),
        ("general.name", GGUF_TYPE_STRING, f"{arch.upper()}-Synthetic-Test"),
        ("general.file_type", GGUF_TYPE_UINT32, file_type),
        (f"{arch}.block_count", GGUF_TYPE_UINT32, block_count),
        (f"{arch}.context_length", GGUF_TYPE_UINT32, context_length),
    ]

    buf.write(struct.pack("<IQQ", version, tensor_count, len(kvs)))

    for k, vtype, val in kvs:
        k_bytes = k.encode("utf-8")
        buf.write(struct.pack("<Q", len(k_bytes)))
        buf.write(k_bytes)
        buf.write(struct.pack("<I", vtype))
        if vtype == GGUF_TYPE_STRING:
            v_bytes = val.encode("utf-8")
            buf.write(struct.pack("<Q", len(v_bytes)))
            buf.write(v_bytes)
        elif vtype == GGUF_TYPE_UINT32:
            buf.write(struct.pack("<I", int(val)))

    return buf.getvalue()
