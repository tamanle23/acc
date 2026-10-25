import os
import gc
import logging
from abc import ABC, abstractmethod
from typing import Tuple

logger = logging.getLogger("acc.device_memory_strategy")


class DeviceMemoryStrategy(ABC):
    """
    Abstract strategy for querying hardware device memory and purging caches.
    Follows GoF Strategy Pattern to isolate CUDA, Apple Silicon MPS, and CPU memory logic.
    """

    @abstractmethod
    def get_device_type(self) -> str:
        """Returns the hardware accelerator identifier: 'cuda', 'mps', or 'cpu'."""
        pass

    @abstractmethod
    def get_memory_info(self) -> Tuple[int, int]:
        """
        Returns (free_bytes, total_bytes).
        If metrics are unavailable, returns (0, 0).
        """
        pass

    @abstractmethod
    def empty_cache(self) -> bool:
        """
        Executes hardware-specific deallocation/purge.
        Returns True if cache was purged on a dedicated accelerator.
        """
        pass


class CudaMemoryStrategy(DeviceMemoryStrategy):
    """NVIDIA CUDA memory strategy using PyTorch."""

    def get_device_type(self) -> str:
        return "cuda"

    def get_memory_info(self) -> Tuple[int, int]:
        try:
            import torch
            if torch.cuda.is_available():
                return torch.cuda.mem_get_info()
        except Exception as e:
            logger.debug(f"Failed to read CUDA memory info: {e}")
        return 0, 0

    def empty_cache(self) -> bool:
        purged = False
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                if hasattr(torch.cuda, "ipc_collect"):
                    torch.cuda.ipc_collect()
                purged = True
        except Exception as e:
            logger.warning(f"Error during CUDA empty_cache: {e}")
        return purged


class MpsMemoryStrategy(DeviceMemoryStrategy):
    """Apple Silicon Metal Performance Shaders (MPS) strategy using PyTorch."""

    def get_device_type(self) -> str:
        return "mps"

    def get_memory_info(self) -> Tuple[int, int]:
        # torch.mps does not provide total hardware VRAM directly;
        # report allocated/driver memory if available, or fall back to sysconf host RAM.
        try:
            import torch
            total_bytes = 0
            allocated_bytes = 0
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                if hasattr(torch.mps, "current_allocated_memory"):
                    allocated_bytes = torch.mps.current_allocated_memory()
                # Unified memory estimation from sysconf
                total_bytes = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
                free_bytes = max(0, total_bytes - allocated_bytes)
                return free_bytes, total_bytes
        except Exception as e:
            logger.debug(f"Failed to read MPS memory info: {e}")
        return 0, 0

    def empty_cache(self) -> bool:
        purged = False
        try:
            import torch
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                if hasattr(torch.mps, "empty_cache"):
                    torch.mps.empty_cache()
                    purged = True
        except Exception as e:
            logger.warning(f"Error during MPS empty_cache: {e}")
        return purged


class CpuMemoryStrategy(DeviceMemoryStrategy):
    """Host system RAM strategy (Fallback when no accelerator is active)."""

    def get_device_type(self) -> str:
        return "cpu"

    def get_memory_info(self) -> Tuple[int, int]:
        total_bytes = 0
        free_bytes = 0
        try:
            # POSIX sysconf
            page_size = os.sysconf("SC_PAGE_SIZE")
            total_pages = os.sysconf("SC_PHYS_PAGES")
            avail_pages = os.sysconf("SC_AVPHYS_PAGES")
            total_bytes = page_size * total_pages
            free_bytes = page_size * avail_pages
        except Exception:
            pass
        return free_bytes, total_bytes

    def empty_cache(self) -> bool:
        # Host CPU has no accelerator cache to flush beyond Python GC
        return False


def get_device_memory_strategy() -> DeviceMemoryStrategy:
    """
    Factory resolving the optimal DeviceMemoryStrategy based on platform hardware.
    """
    try:
        import torch
        if torch.cuda.is_available():
            logger.info("Selected CudaMemoryStrategy for model memory management.")
            return CudaMemoryStrategy()
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            logger.info("Selected MpsMemoryStrategy (Apple Silicon) for model memory management.")
            return MpsMemoryStrategy()
    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"Device inspection fallback: {e}")

    logger.info("Selected CpuMemoryStrategy (Host RAM fallback) for model memory management.")
    return CpuMemoryStrategy()
