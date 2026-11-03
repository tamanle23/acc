import time
import pytest
from unittest.mock import MagicMock

from services.telemetry_service import TelemetryService, TelemetryEventBroadcaster
from services.model_lifecycle_manager import ModelLifecycleManager
from generated import telemetry_pb2


def test_telemetry_event_broadcaster_subscribe_and_broadcast():
    broadcaster = TelemetryEventBroadcaster.get_instance()
    q = broadcaster.subscribe()

    event = telemetry_pb2.TelemetryEvent(
        timestamp_ms=int(time.time() * 1000),
        service_name="python-backend",
        event_type=telemetry_pb2.TELEMETRY_EVENT_TYPE_HEARTBEAT,
        message="Test heartbeat",
        vram_allocated_bytes=1024 * 1024 * 100,
        hardware_tier="MPS",
    )

    broadcaster.broadcast(event)
    received = q.get(timeout=1.0)

    assert received.service_name == "python-backend"
    assert received.event_type == telemetry_pb2.TELEMETRY_EVENT_TYPE_HEARTBEAT
    assert received.hardware_tier == "MPS"

    broadcaster.unsubscribe(q)


def test_telemetry_service_stream_telemetry_single_yield():
    servicer = TelemetryService()
    req = telemetry_pb2.TelemetryStreamRequest(client_id="test_runner", interval_ms=100)

    mock_context = MagicMock()
    # Let context be active for exactly one loop then terminate
    active_calls = [True, False]
    mock_context.is_active.side_effect = lambda: active_calls.pop(0) if active_calls else False

    gen = servicer.StreamTelemetry(req, mock_context)
    event = next(gen)

    assert event.service_name == "python-backend"
    assert event.event_type == telemetry_pb2.TELEMETRY_EVENT_TYPE_HEARTBEAT
    assert event.hardware_tier in ["CUDA", "MPS", "CPU"]


def test_lifecycle_event_broadcast_hook():
    broadcaster = TelemetryEventBroadcaster.get_instance()
    q = broadcaster.subscribe()

    mgr = ModelLifecycleManager.get_instance()
    mgr.register_model(
        name="test_stream_model",
        instance={"dummy": True},
        estimated_vram_bytes=256 * 1024 * 1024,
        priority_tier=1,
    )

    # We expect a model loaded event from register_model
    event = q.get(timeout=2.0)
    assert event.event_type == telemetry_pb2.TELEMETRY_EVENT_TYPE_MODEL_LOADED
    assert "test_stream_model" in event.message

    broadcaster.unsubscribe(q)
