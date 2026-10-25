import time
import pytest
from unittest.mock import MagicMock

from services.concurrency_utils import ModelState, RWLock, TelemetryAuditBuffer
from services.device_memory_strategy import (
    DeviceMemoryStrategy,
    CpuMemoryStrategy,
    get_device_memory_strategy,
)
from services.model_lifecycle_manager import ModelLifecycleManager, ModelEntry


class MockDeviceStrategy(DeviceMemoryStrategy):
    def __init__(self, device_type="mock_gpu"):
        self._device_type = device_type
        self.empty_cache_called = False

    def get_device_type(self) -> str:
        return self._device_type

    def get_memory_info(self):
        return 4 * 1024 * 1024 * 1024, 8 * 1024 * 1024 * 1024  # 4GB free, 8GB total

    def empty_cache(self) -> bool:
        self.empty_cache_called = True
        return True


def test_device_strategy_resolution():
    strategy = get_device_memory_strategy()
    assert strategy is not None
    assert strategy.get_device_type() in ("cuda", "mps", "cpu")
    free_b, total_b = strategy.get_memory_info()
    assert isinstance(free_b, int)
    assert isinstance(total_b, int)


def test_rwlock_concurrency():
    lock = RWLock()
    # Acquire multiple reads concurrently
    assert lock.acquire_read(timeout=1.0) is True
    assert lock.acquire_read(timeout=1.0) is True
    # Write lock should fail while readers are active
    assert lock.acquire_write(timeout=0.05) is False
    # Release both readers
    lock.release_read()
    lock.release_read()
    # Write lock should now succeed
    assert lock.acquire_write(timeout=1.0) is True
    # Read lock should fail while writer is active
    assert lock.acquire_read(timeout=0.05) is False
    lock.release_write()


def test_model_entry_lifecycle_and_scoring():
    unload_called = False

    def on_unload():
        nonlocal unload_called
        unload_called = True

    entry = ModelEntry(
        name="test_model",
        instance={"dummy": "weights"},
        estimated_vram_bytes=500 * 1024 * 1024,
        unload_fn=on_unload,
        priority_tier=2,
    )

    assert entry.state == ModelState.READY
    assert entry.access_count == 1

    entry.touch()
    assert entry.access_count == 2

    # Verify compound eviction score calculation
    now = time.time() + 10.0
    score = entry.compute_eviction_score(now)
    assert isinstance(score, float)

    # Test unload
    assert entry.unload() is True
    assert unload_called is True
    assert entry.instance is None
    assert entry.state == ModelState.UNLOADED


def test_model_lifecycle_manager_registration_and_purge():
    mock_strategy = MockDeviceStrategy()
    mgr = ModelLifecycleManager(idle_timeout_sec=60.0, device_strategy=mock_strategy)

    unloaded = []
    mgr.register_model(
        "audio_model",
        instance={"net": "audio"},
        estimated_vram_bytes=300 * 1024 * 1024,
        unload_fn=lambda: unloaded.append("audio_model"),
        priority_tier=1,
    )
    mgr.register_model(
        "text_model",
        instance={"net": "text"},
        estimated_vram_bytes=600 * 1024 * 1024,
        unload_fn=lambda: unloaded.append("text_model"),
        priority_tier=3,
    )

    # Check status
    status = mgr.get_vram_status()
    assert status["cached_model_count"] == 2
    assert status["device_type"] == "mock_gpu"
    assert len(status["active_models"]) == 2

    # Purge all
    success, freed_bytes, msg = mgr.purge_all()
    assert success is True
    assert freed_bytes == 900 * 1024 * 1024
    assert mock_strategy.empty_cache_called is True
    assert "audio_model" in unloaded
    assert "text_model" in unloaded

    status_after = mgr.get_vram_status()
    assert status_after["cached_model_count"] == 0

    mgr.stop()


def test_oom_circuit_breaker_recovery():
    mock_strategy = MockDeviceStrategy()
    mgr = ModelLifecycleManager(idle_timeout_sec=60.0, device_strategy=mock_strategy)

    unloaded = False

    def on_unload():
        nonlocal unloaded
        unloaded = True

    mgr.register_model(
        "victim_model",
        instance={"victim": True},
        estimated_vram_bytes=200 * 1024 * 1024,
        unload_fn=on_unload,
        priority_tier=2,
    )

    # Trigger OOM within circuit breaker
    with pytest.raises(MemoryError):
        with mgr.oom_circuit_breaker("victim_model"):
            raise MemoryError("Simulated CUDA Out Of Memory!")

    # Verify circuit breaker purged cache, marked model error, and unloaded
    assert unloaded is True
    assert mock_strategy.empty_cache_called is True
    entry = mgr.models["victim_model"]
    assert entry.state == ModelState.UNLOADED

    # Audit buffer should record OOM event
    recent_events = mgr.audit_buffer.get_recent_events(limit=5)
    assert any(e["event_type"] == "OOM_INTERCEPTED" for e in recent_events)

    mgr.stop()


def test_llm_and_tts_engines_integration():
    from services.llm_engine import LLMEngine
    from services.tts_engine import TTSEngine

    llm = LLMEngine.get_instance()
    json_out, tokens, lat = llm.generate_structured_json("Breaking News: AI Model Lifecycle Upgraded Successfully")
    assert isinstance(json_out, str)
    assert "title" in json_out
    assert tokens > 0

    tts = TTSEngine.get_instance()
    wav_bytes, sr, ch, dur = tts.synthesize("Hello world speech", voice_id="af_heart")
    assert len(wav_bytes) > 44  # Valid WAV header
    assert sr == 24000
    assert ch == 1
    assert dur > 0
