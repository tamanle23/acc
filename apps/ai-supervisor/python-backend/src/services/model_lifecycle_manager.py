import os
import gc
import time
import threading
from typing import Dict, Any, Callable, Optional, List


class ModelEntry:
    def __init__(
        self,
        name: str,
        instance: Any,
        estimated_vram_bytes: int = 0,
        unload_fn: Optional[Callable[[], None]] = None,
    ):
        self.name = name
        self.instance = instance
        self.estimated_vram_bytes = estimated_vram_bytes
        self.unload_fn = unload_fn
        self.last_accessed = time.time()
        self.access_count = 1

    def touch(self):
        self.last_accessed = time.time()
        self.access_count += 1

    def unload(self):
        if self.unload_fn:
            try:
                self.unload_fn()
            except Exception as e:
                print(f"[ModelLifecycleManager] Error in custom unload_fn for {self.name}: {e}", flush=True)
        self.instance = None


class ModelLifecycleManager:
    """
    ModelLifecycleManager:
    Enterprise dynamic VRAM and model memory manager for the ACC Python AI subsystem.
    Features:
    - LRU model lifecycle tracking with configurable idle auto-eviction (default 120s).
    - Synchronized PyTorch CUDA cache purging and garbage collection.
    - Explicit PurgeVRAM gRPC RPC integration.
    """

    _instance: Optional["ModelLifecycleManager"] = None
    _lock = threading.Lock()

    @classmethod
    def get_instance(cls, idle_timeout_sec: float = 120.0) -> "ModelLifecycleManager":
        with cls._lock:
            if cls._instance is None:
                cls._instance = ModelLifecycleManager(idle_timeout_sec=idle_timeout_sec)
            return cls._instance

    def __init__(self, idle_timeout_sec: float = 120.0):
        self.idle_timeout_sec = idle_timeout_sec
        self.models: Dict[str, ModelEntry] = {}
        self._eviction_thread: Optional[threading.Thread] = None
        self._running = True
        self.start_eviction_loop()

    def register_model(
        self,
        name: str,
        instance: Any,
        estimated_vram_bytes: int = 0,
        unload_fn: Optional[Callable[[], None]] = None,
    ) -> None:
        """
        Registers an active AI model with its memory profile.
        """
        with self._lock:
            if name in self.models:
                self.models[name].instance = instance
                self.models[name].estimated_vram_bytes = estimated_vram_bytes
                self.models[name].unload_fn = unload_fn
                self.models[name].touch()
            else:
                self.models[name] = ModelEntry(
                    name=name,
                    instance=instance,
                    estimated_vram_bytes=estimated_vram_bytes,
                    unload_fn=unload_fn,
                )
            print(
                f"[ModelLifecycleManager] Registered model '{name}' (~{estimated_vram_bytes // (1024*1024)}MB)",
                flush=True,
            )

    def touch(self, name: str) -> None:
        """
        Marks a model as recently used to reset its idle eviction countdown.
        """
        with self._lock:
            if name in self.models and self.models[name].instance is not None:
                self.models[name].touch()

    def get_model(self, name: str) -> Optional[Any]:
        """
        Retrieves a loaded model instance, touching its timestamp.
        """
        with self._lock:
            if name in self.models:
                entry = self.models[name]
                if entry.instance is not None:
                    entry.touch()
                    return entry.instance
            return None

    def purge_all(self, force: bool = False) -> tuple[bool, int, str]:
        """
        Immediately evicts all cached models, triggers torch CUDA cache clearing,
        and performs generational garbage collection.
        Returns: (success, estimated_freed_bytes, message)
        """
        with self._lock:
            total_freed = 0
            evicted_names: List[str] = []

            for name, entry in list(self.models.items()):
                if entry.instance is not None:
                    total_freed += entry.estimated_vram_bytes
                    entry.unload()
                    evicted_names.append(name)

            self.models.clear()

            # 1. Python GC
            gc.collect()

            # 2. PyTorch CUDA cache clearing if available
            cuda_cleared = False
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.ipc_collect()
                    cuda_cleared = True
            except Exception:
                pass

            msg = (
                f"Purged {len(evicted_names)} models ({', '.join(evicted_names) if evicted_names else 'none'}). "
                f"Freed ~{total_freed // (1024*1024)}MB VRAM. CUDA cache cleared: {cuda_cleared}."
            )
            print(f"[ModelLifecycleManager] {msg}", flush=True)
            return True, total_freed, msg

    def get_vram_status(self) -> dict:
        """
        Returns real-time telemetry on system/GPU VRAM and active models.
        """
        with self._lock:
            active_models = [
                {"name": name, "vram_mb": entry.estimated_vram_bytes // (1024 * 1024), "access_count": entry.access_count}
                for name, entry in self.models.items()
                if entry.instance is not None
            ]

            total_vram_bytes = 0
            free_vram_bytes = 0

            try:
                import torch
                if torch.cuda.is_available():
                    free_vram_bytes, total_vram_bytes = torch.cuda.mem_get_info()
            except Exception:
                pass

            return {
                "active_models": active_models,
                "total_vram_bytes": total_vram_bytes,
                "free_vram_bytes": free_vram_bytes,
                "cached_model_count": len(active_models),
            }

    def start_eviction_loop(self) -> None:
        """
        Starts a background timer checking for models that exceed the idle timeout.
        """
        def _loop():
            while self._running:
                time.sleep(5.0)  # Check every 5 seconds
                now = time.time()
                with self._lock:
                    for name, entry in list(self.models.items()):
                        if entry.instance is not None and (now - entry.last_accessed) > self.idle_timeout_sec:
                            idle_time = int(now - entry.last_accessed)
                            print(
                                f"[ModelLifecycleManager] Auto-evicting model '{name}' (idle for {idle_time}s > {self.idle_timeout_sec}s threshold)",
                                flush=True,
                            )
                            entry.unload()
                            gc.collect()
                            try:
                                import torch
                                if torch.cuda.is_available():
                                    torch.cuda.empty_cache()
                            except Exception:
                                pass

        self._eviction_thread = threading.Thread(target=_loop, name="VRAMEvictionLoop", daemon=True)
        self._eviction_thread.start()

    def stop(self) -> None:
        self._running = False
