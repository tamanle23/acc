"""Virtual Memory Paged KV-Cache Manager & Continuous Batching Simulator.

Implements the fundamental mathematical architecture of vLLM / TensorRT-LLM PagedAttention:
- Fixed-size non-contiguous physical token blocks (block_size=16 or 32)
- Logical-to-physical block table translation (BlockTable)
- Zero external memory fragmentation
- Radix/hash-based prefix caching and block deduplication
- High-concurrency allocation telemetry
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

from core.exceptions import InferenceBackendError

logger = logging.getLogger(__name__)


class PhysicalTokenBlock:
    """A contiguous physical memory block holding up to `block_size` tokens."""

    def __init__(self, block_id: int, block_size: int = 16) -> None:
        self.block_id = block_id
        self.block_size = block_size
        self.tokens: list[int] = []
        self.prefix_hash: str | None = None
        self.ref_count: int = 0

    @property
    def is_full(self) -> bool:
        return len(self.tokens) >= self.block_size

    @property
    def free_slots(self) -> int:
        return max(0, self.block_size - len(self.tokens))

    def reset(self) -> None:
        self.tokens.clear()
        self.prefix_hash = None
        self.ref_count = 0


class PagedKVCacheManager:
    """Manages virtual memory allocation of Key-Value cache pages across concurrent requests."""

    def __init__(
        self,
        total_blocks: int = 512,
        block_size: int = 16,
        enable_prefix_caching: bool = True,
    ) -> None:
        self.total_blocks = total_blocks
        self.block_size = block_size
        self.enable_prefix_caching = enable_prefix_caching

        # Physical block storage pool
        self._all_blocks: list[PhysicalTokenBlock] = [
            PhysicalTokenBlock(block_id=i, block_size=block_size)
            for i in range(total_blocks)
        ]
        self._free_block_ids: list[int] = list(range(total_blocks))

        # Request Block Tables: request_id -> list[physical_block_id]
        self._block_tables: dict[str, list[int]] = {}

        # Prefix Cache Table: prefix_hash -> physical_block_id
        self._prefix_cache: dict[str, int] = {}

        # Telemetry counters
        self._total_allocation_requests: int = 0
        self._prefix_cache_hits: int = 0

    @property
    def allocated_blocks_count(self) -> int:
        return self.total_blocks - len(self._free_block_ids)

    @property
    def free_blocks_count(self) -> int:
        return len(self._free_block_ids)

    @property
    def usage_percent(self) -> float:
        if self.total_blocks == 0:
            return 0.0
        return round((self.allocated_blocks_count / self.total_blocks) * 100.0, 2)

    def _hash_block(self, prev_hash: str, tokens: list[int]) -> str:
        h = hashlib.sha256()
        h.update(prev_hash.encode("ascii"))
        for t in tokens:
            h.update(t.to_bytes(4, byteorder="little", signed=True))
        return h.hexdigest()[:16]

    def allocate_for_request(
        self, request_id: str, prompt_tokens: list[int]
    ) -> tuple[list[int], int]:
        """Allocate physical KV-cache blocks for a prompt sequence.

        Returns:
            tuple[list[int], int]: (allocated_block_ids, prefix_cache_hits)
        """
        if request_id in self._block_tables:
            self.free_request(request_id)

        self._total_allocation_requests += 1
        allocated_ids: list[int] = []
        hits = 0
        prev_hash = "ROOT"

        # Chunk prompt tokens into block_size slices
        chunks = [
            prompt_tokens[i : i + self.block_size]
            for i in range(0, max(len(prompt_tokens), 1), self.block_size)
        ]

        for chunk in chunks:
            is_full_chunk = len(chunk) == self.block_size
            curr_hash = self._hash_block(prev_hash, chunk) if is_full_chunk else None

            # Check prefix cache if chunk is full and prefix caching enabled
            cached_bid: int | None = None
            if self.enable_prefix_caching and curr_hash and curr_hash in self._prefix_cache:
                bid = self._prefix_cache[curr_hash]
                block = self._all_blocks[bid]
                if block.tokens == chunk:
                    cached_bid = bid
                    hits += 1
                    self._prefix_cache_hits += 1

            if cached_bid is not None:
                # Reuse cached block
                block = self._all_blocks[cached_bid]
                block.ref_count += 1
                allocated_ids.append(cached_bid)
            else:
                # Allocate new physical block from free list
                if not self._free_block_ids:
                    # Clean up partial allocation before failing
                    self._rollback_partial(allocated_ids)
                    raise InferenceBackendError(
                        f"Paged KV-Cache saturated: out of physical blocks ({self.allocated_blocks_count}/{self.total_blocks} allocated)",
                        error_code="KV_CACHE_OUT_OF_MEMORY",
                    )
                new_bid = self._free_block_ids.pop(0)
                block = self._all_blocks[new_bid]
                block.reset()
                block.tokens = list(chunk)
                block.ref_count = 1
                block.prefix_hash = curr_hash

                if curr_hash and self.enable_prefix_caching:
                    self._prefix_cache[curr_hash] = new_bid

                allocated_ids.append(new_bid)

            if curr_hash:
                prev_hash = curr_hash

        self._block_tables[request_id] = allocated_ids
        return allocated_ids, hits

    def append_token(self, request_id: str, token: int) -> int:
        """Append a newly generated token to the request's paged KV-cache.

        Returns:
            int: The physical block_id where the token was stored.
        """
        table = self._block_tables.get(request_id)
        if not table:
            raise InferenceBackendError(
                f"Cannot append token to unknown request_id: {request_id}",
                error_code="INVALID_REQUEST_ID",
            )

        last_bid = table[-1]
        last_block = self._all_blocks[last_bid]

        if not last_block.is_full:
            last_block.tokens.append(token)
            return last_bid

        # Last block is full; allocate next block
        if not self._free_block_ids:
            raise InferenceBackendError(
                "Paged KV-Cache saturated during token generation: out of free blocks",
                error_code="KV_CACHE_OUT_OF_MEMORY",
            )

        new_bid = self._free_block_ids.pop(0)
        new_block = self._all_blocks[new_bid]
        new_block.reset()
        new_block.tokens = [token]
        new_block.ref_count = 1
        table.append(new_bid)
        return new_bid

    def free_request(self, request_id: str) -> None:
        """Release all physical blocks allocated to a completed or aborted request."""
        table = self._block_tables.pop(request_id, None)
        if not table:
            return

        for bid in table:
            block = self._all_blocks[bid]
            block.ref_count = max(0, block.ref_count - 1)
            if block.ref_count == 0:
                # Remove from prefix cache if this was the indexed block
                if block.prefix_hash and self._prefix_cache.get(block.prefix_hash) == bid:
                    self._prefix_cache.pop(block.prefix_hash, None)
                block.reset()
                self._free_block_ids.append(bid)

    def _rollback_partial(self, block_ids: list[int]) -> None:
        for bid in block_ids:
            block = self._all_blocks[bid]
            block.ref_count = max(0, block.ref_count - 1)
            if block.ref_count == 0:
                block.reset()
                self._free_block_ids.append(bid)

    def get_telemetry(self) -> dict[str, Any]:
        """Return real-time PagedAttention memory metrics."""
        hit_rate = 0.0
        if self._total_allocation_requests > 0:
            hit_rate = round(
                (self._prefix_cache_hits / (self._total_allocation_requests * 4)) * 100.0, 2
            )

        return {
            "total_blocks": self.total_blocks,
            "block_size": self.block_size,
            "allocated_blocks": self.allocated_blocks_count,
            "free_blocks": self.free_blocks_count,
            "usage_percent": self.usage_percent,
            "total_requests": self._total_allocation_requests,
            "prefix_cache_hits": self._prefix_cache_hits,
            "prefix_cache_hit_rate": hit_rate,
            "external_fragmentation_percent": 0.0,  # Zero by mathematical design of paging
        }

    def reset_all(self) -> None:
        """Wipe all active requests and reset memory pool."""
        self._block_tables.clear()
        self._prefix_cache.clear()
        self._free_block_ids = list(range(self.total_blocks))
        for block in self._all_blocks:
            block.reset()
