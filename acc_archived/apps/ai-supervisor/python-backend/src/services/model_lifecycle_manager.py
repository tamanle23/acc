import gc
import time
import logging
import threading
from contextlib import contextmanager
from typing import Dict, Any, Callable, Optional, List, Tuple

from services.concurrency_utils import ModelState, RWLock, TelemetryAuditBuffer
from services.device_memory_strategy import DeviceMemoryStrategy, get_device_memory_strategy

logger = logging.getLogger("acc.model_lifecycle")


class ModelEntry:
    """
    Thread-safe model entity encapsulating model instance, lifecycle state,
    priority tiers, and Reader-Writer synchronization.
    """

    def __init__(
        self,
        name: str,
        instance: Any,
        estimated_vram_bytes: int = 0,
        unload_fn: Optional[Callable[[], None]] = None,
        priority_tier: int = 2,  # 1 = High, 2 = Medium, 3 = Low
    ):
        self.name = name
        self.instance = instance
        self.estimated_vram_bytes = estimated_vram_bytes
        self.unload_fn = unload_fn
        self.priority_tier = max(1, min(3, priority_tier))
        self.state: ModelState = ModelState.READY if instance is not None else ModelState.UNLOADED
        self.last_accessed = time.time()
        self.access_count = 1 if instance is not None else 0
        self.rw_lock = RWLock()

    def touch(self) -> None:
        self.last_accessed = time.time()
        self.access_count += 1

    def unload(self) -> bool:
        """
        Safely unloads model instance under an exclusive write lock.
        """
        if not self.rw_lock.acquire_write(timeout=5.0):
            logger.warning(f"Could not acquire write lock to unload model '{self.name}'. Active readers present.")
            return False

        try:
            self.state = ModelState.EVICTING
            if self.unload_fn:
                try:
                    self.unload_fn()
                except Exception as e:
                    logger.error(f"Error in custom unload_fn for '{self.name}': {e}", exc_info=True)
            self.instance = None
            self.state = ModelState.UNLOADED
            return True
        finally:
            self.rw_lock.release_write()

    def compute_eviction_score(self, current_time: float) -> float:
        """
        Compound Multi-Criteria Eviction Scoring:
        Score = w_age * AgeNorm + w_size * SizeNorm - w_tier * TierPriority
        Higher score indicates higher priority for eviction.
        """
        idle_seconds = max(0.0, current_time - self.last_accessed)
        size_mb = self.estimated_vram_bytes / (1024.0 * 1024.0)

        # Tier weights: Tier 1 (High priority) gets a huge negative penalty so it is evicted last.
        # Tier 3 (Low priority) gets penalized less, making it easier to evict.
        tier_penalty = (4 - self.priority_tier) * 100.0
        score = (idle_seconds * 1.5) + (size_mb * 0.1) - tier_penalty
        return score


class ModelLifecycleManager:
    """
    ModelLifecycleManager:
    Enterprise dynamic VRAM and hardware memory manager for the ACC Python AI subsystem.
    Features:
    - Multi-hardware Strategy Pattern (CUDA, Apple Silicon MPS, CPU/Host RAM).
    - Reader-Writer synchronization (parallel inference vs exclusive eviction).
    - Composite Multi-Criteria Eviction (LRU + VRAM Footprint + Tier Priority).
    - Dual-Response OOM Circuit Breaker Context Manager.
    - Thread-safe Telemetry Audit Ring Buffer.
    - Zero-leak Event-Driven Eviction Loop.
    """

    _instance: Optional["ModelLifecycleManager"] = None
    _singleton_lock = threading.Lock()

    @classmethod
    def get_instance(cls, idle_timeout_sec: float = 120.0) -> "ModelLifecycleManager":
        with cls._singleton_lock:
            if cls._instance is None:
                cls._instance = ModelLifecycleManager(idle_timeout_sec=idle_timeout_sec)
            return cls._instance

    def __init__(
        self,
        idle_timeout_sec: float = 120.0,
        device_strategy: Optional[DeviceMemoryStrategy] = None,
    ):
        self.idle_timeout_sec = idle_timeout_sec
        self.device_strategy: DeviceMemoryStrategy = device_strategy or get_device_memory_strategy()
        self.models: Dict[str, ModelEntry] = {}
        self._registry_lock = threading.RLock()
        self.audit_buffer = TelemetryAuditBuffer(capacity=100)
        self._stop_event = threading.Event()
        self._eviction_thread: Optional[threading.Thread] = None

        self.start_eviction_loop()

    def register_model(
        self,
        name: str,
        instance: Any,
        estimated_vram_bytes: int = 0,
        unload_fn: Optional[Callable[[], None]] = None,
        priority_tier: int = 2,
    ) -> None:
        """
        Registers an active AI model with its memory profile and priority tier.
        """
        with self._registry_lock:
            if name in self.models:
                entry = self.models[name]
                # Acquire write lock to update instance cleanly
                if entry.rw_lock.acquire_write(timeout=5.0):
                    try:
                        entry.instance = instance
                        entry.estimated_vram_bytes = estimated_vram_bytes
                        entry.unload_fn = unload_fn
                        entry.priority_tier = priority_tier
                        entry.state = ModelState.READY
                        entry.touch()
                    finally:
                        entry.rw_lock.release_write()
            else:
                self.models[name] = ModelEntry(
                    name=name,
                    instance=instance,
                    estimated_vram_bytes=estimated_vram_bytes,
                    unload_fn=unload_fn,
                    priority_tier=priority_tier,
                )

            self.audit_buffer.record_event(
                "MODEL_REGISTERED",
                name,
                {"vram_mb": estimated_vram_bytes // (1024 * 1024), "tier": priority_tier},
            )
            logger.info(
                f"[ModelLifecycleManager] Registered model '{name}' (~{estimated_vram_bytes // (1024*1024)}MB, Tier {priority_tier})"
            )
            try:
                from services.telemetry_service import TelemetryService
                from generated import telemetry_pb2
                TelemetryService.emit_lifecycle_event(
                    telemetry_pb2.TELEMETRY_EVENT_TYPE_MODEL_LOADED,
                    f"Model '{name}' registered (~{estimated_vram_bytes // (1024*1024)}MB, Tier {priority_tier})"
                )
            except Exception:
                pass

    def touch(self, name: str) -> None:
        """
        Marks a model as recently used to reset its idle eviction countdown.
        """
        with self._registry_lock:
            entry = self.models.get(name)
            if entry and entry.state == ModelState.READY and entry.instance is not None:
                entry.touch()

    def get_model(self, name: str) -> Optional[Any]:
        """
        Retrieves a loaded model instance, touching its timestamp.
        """
        with self._registry_lock:
            entry = self.models.get(name)
            if entry and entry.state == ModelState.READY and entry.instance is not None:
                entry.touch()
                return entry.instance
            return None

    def purge_all(self, force: bool = False) -> Tuple[bool, int, str]:
        """
        Immediately evicts all cached models, triggers device cache clearing,
        and generational garbage collection.
        Returns: (success, estimated_freed_bytes, message)
        """
        total_freed = 0
        evicted_names: List[str] = []

        with self._registry_lock:
            target_entries = list(self.models.values())

        for entry in target_entries:
            if entry.instance is not None:
                bytes_freed = entry.estimated_vram_bytes
                if entry.unload():
                    total_freed += bytes_freed
                    evicted_names.append(entry.name)

        # Generational GC
        gc.collect()

        # Strategy-based accelerator cache deallocation
        cache_cleared = self.device_strategy.empty_cache()

        msg = (
            f"Purged {len(evicted_names)} models ({', '.join(evicted_names) if evicted_names else 'none'}). "
            f"Freed ~{total_freed // (1024*1024)}MB. Cache cleared on {self.device_strategy.get_device_type()}: {cache_cleared}."
        )
        logger.info(f"[ModelLifecycleManager] {msg}")

        self.audit_buffer.record_event(
            "PURGE_ALL",
            "ALL",
            {"freed_mb": total_freed // (1024 * 1024), "models": evicted_names, "cache_cleared": cache_cleared},
        )

        return True, total_freed, msg

    def get_vram_status(self) -> dict:
        """
        Returns real-time telemetry on system/accelerator VRAM, active models, and recent audit events.
        """
        with self._registry_lock:
            active_models = [
                {
                    "name": name,
                    "vram_mb": entry.estimated_vram_bytes // (1024 * 1024),
                    "access_count": entry.access_count,
                    "state": entry.state.value,
                    "priority_tier": entry.priority_tier,
                }
                for name, entry in self.models.items()
                if entry.instance is not None and entry.state == ModelState.READY
            ]

        free_vram_bytes, total_vram_bytes = self.device_strategy.get_memory_info()

        return {
            "active_models": active_models,
            "total_vram_bytes": total_vram_bytes,
            "free_vram_bytes": free_vram_bytes,
            "cached_model_count": len(active_models),
            "device_type": self.device_strategy.get_device_type(),
            "recent_audit_events": self.audit_buffer.get_recent_events(limit=10),
        }

    @contextmanager
    def oom_circuit_breaker(self, model_name: str = "unknown"):
        """
        Enterprise OOM Circuit Breaker Context Manager.
        Protects inference calls from crashing daemon on out-of-memory errors:
        1. Catches CUDA/MPS/MemoryError OutOfMemory exceptions.
        2. Unloads victim model and purges hardware cache.
        3. Records high-priority audit telemetry.
        4. Re-raises exception so caller engine can perform seamless fallback.
        """
        try:
            yield
        except Exception as exc:
            is_oom = False
            exc_str = str(exc).lower()

            if "out of memory" in exc_str or "oom" in exc_str or isinstance(exc, MemoryError):
                is_oom = True
            try:
                import torch
                if isinstance(exc, torch.cuda.OutOfMemoryError):
                    is_oom = True
            except Exception:
                pass

            if is_oom:
                logger.error(f"[ModelLifecycleManager] OOM detected for model '{model_name}'! Activating Circuit Breaker...")
                self.audit_buffer.record_event(
                    "OOM_INTERCEPTED",
                    model_name,
                    {"error": str(exc), "device": self.device_strategy.get_device_type()},
                )

                # Unload victim model to reclaim memory
                with self._registry_lock:
                    entry = self.models.get(model_name)
                    if entry:
                        entry.state = ModelState.ERROR
                        entry.unload()

                # Generational GC & hardware empty cache
                gc.collect()
                self.device_strategy.empty_cache()

                try:
                    from services.telemetry_service import TelemetryService
                    from generated import telemetry_pb2
                    TelemetryService.emit_lifecycle_event(
                        telemetry_pb2.TELEMETRY_EVENT_TYPE_OOM_INTERCEPTED,
                        f"OOM Circuit Breaker triggered for model '{model_name}' on {self.device_strategy.get_device_type()}"
                    )
                except Exception:
                    pass

            raise exc

    def start_eviction_loop(self) -> None:
        """
        Starts the event-driven background thread checking for models exceeding idle timeout.
        """
        def _loop():
            while not self._stop_event.wait(timeout=5.0):
                now = time.time()
                candidates_to_evict: List[ModelEntry] = []

                with self._registry_lock:
                    for name, entry in self.models.items():
                        if entry.instance is not None and entry.state == ModelState.READY:
                            if (now - entry.last_accessed) > self.idle_timeout_sec:
                                candidates_to_evict.append(entry)

                # Sort candidates by compound eviction score descending
                candidates_to_evict.sort(key=lambda e: e.compute_eviction_score(now), reverse=True)

                for candidate in candidates_to_evict:
                    idle_time = int(now - candidate.last_accessed)
                    logger.info(
                        f"[ModelLifecycleManager] Auto-evicting model '{candidate.name}' "
                        f"(idle {idle_time}s > {self.idle_timeout_sec}s threshold, tier {candidate.priority_tier})"
                    )
                    if candidate.unload():
                        gc.collect()
                        self.device_strategy.empty_cache()
                        self.audit_buffer.record_event(
                            "AUTO_EVICT",
                            candidate.name,
                            {"idle_sec": idle_time, "tier": candidate.priority_tier},
                        )

        self._eviction_thread = threading.Thread(target=_loop, name="VRAMEvictionLoop", daemon=True)
        self._eviction_thread.start()

    def stop(self) -> None:
        """
        Cleanly signals background eviction worker to exit and awaits termination.
        """
        self._stop_event.set()
        if self._eviction_thread and self._eviction_thread.is_alive():
            self._eviction_thread.join(timeout=2.0)
        logger.info("[ModelLifecycleManager] Eviction loop stopped.")
