import time
import queue
import logging
from typing import Generator
import grpc

from generated import telemetry_pb2, telemetry_pb2_grpc
from services.model_lifecycle_manager import ModelLifecycleManager

logger = logging.getLogger("acc.telemetry_service")


class TelemetryEventBroadcaster:
    """
    Observer / Broadcaster for distributing telemetry and lifecycle events
    to active gRPC client streams.
    """
    _instance = None

    def __init__(self):
        self._subscribers: list[queue.Queue] = []

    @classmethod
    def get_instance(cls) -> "TelemetryEventBroadcaster":
        if cls._instance is None:
            cls._instance = TelemetryEventBroadcaster()
        return cls._instance

    def subscribe(self) -> queue.Queue:
        q = queue.Queue(maxsize=100)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        if q in self._subscribers:
            self._subscribers.remove(q)

    def broadcast(self, event: telemetry_pb2.TelemetryEvent) -> None:
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except queue.Full:
                try:
                    q.get_nowait()
                except queue.Empty:
                    pass
                try:
                    q.put_nowait(event)
                except queue.Full:
                    pass


class TelemetryService(telemetry_pb2_grpc.TelemetryServiceServicer):
    """
    gRPC Server Streaming Servicer for Sidecar Telemetry.
    Streams VRAM, GPU memory, active model lifecycle states, and OOM circuit breaker alerts.
    """

    def __init__(self):
        super().__init__()
        self.lifecycle_mgr = ModelLifecycleManager.get_instance()
        self.broadcaster = TelemetryEventBroadcaster.get_instance()

    def StreamTelemetry(
        self,
        request: telemetry_pb2.TelemetryStreamRequest,
        context: grpc.ServicerContext
    ) -> Generator[telemetry_pb2.TelemetryEvent, None, None]:
        client_id = request.client_id or "supervisor"
        interval_sec = max(0.5, (request.interval_ms or 1000) / 1000.0)
        logger.info(f"[TelemetryService] Client '{client_id}' connected to telemetry stream (interval: {interval_sec}s)")

        sub_queue = self.broadcaster.subscribe()

        try:
            last_heartbeat = 0.0
            while context.is_active():
                now = time.time()

                # 1. Drain any pending lifecycle/OOM alert events from broadcast queue
                while not sub_queue.empty():
                    event = sub_queue.get_nowait()
                    yield event

                # 2. Emit periodic heartbeat with hardware VRAM & model state
                if now - last_heartbeat >= interval_sec:
                    heartbeat_event = self._build_snapshot_event(
                        event_type=telemetry_pb2.TELEMETRY_EVENT_TYPE_HEARTBEAT,
                        message="Heartbeat"
                    )
                    yield heartbeat_event
                    last_heartbeat = now

                # Yield control briefly to avoid tight loop
                time.sleep(0.1)

        except Exception as e:
            logger.warning(f"[TelemetryService] Client '{client_id}' stream terminated: {e}")
        finally:
            self.broadcaster.unsubscribe(sub_queue)
            logger.info(f"[TelemetryService] Client '{client_id}' unsubscribed.")

    def _build_snapshot_event(
        self,
        event_type: telemetry_pb2.TelemetryEventType,
        message: str
    ) -> telemetry_pb2.TelemetryEvent:
        now_ms = int(time.time() * 1000)
        vram_status = self.lifecycle_mgr.get_vram_status()
        mem_strategy = getattr(self.lifecycle_mgr, "device_strategy", None)
        device_type = mem_strategy.get_device_type().upper() if mem_strategy else "CPU"

        total_bytes = vram_status.get("total_vram_bytes", 0)
        free_bytes = vram_status.get("free_vram_bytes", 0)
        allocated_bytes = max(0, total_bytes - free_bytes)

        # Active models
        active_models_pb = []
        for m in vram_status.get("active_models", []):
            active_models_pb.append(
                telemetry_pb2.ActiveModelInfo(
                    name=m.get("name", "unknown"),
                    allocated_bytes=int(m.get("vram_mb", 0) * 1024 * 1024),
                    touch_count=int(m.get("access_count", 0)),
                    state=str(m.get("state", "READY")),
                )
            )

        return telemetry_pb2.TelemetryEvent(
            timestamp_ms=now_ms,
            service_name="python-backend",
            event_type=event_type,
            message=message,
            vram_allocated_bytes=allocated_bytes,
            vram_reserved_bytes=allocated_bytes,
            vram_total_bytes=total_bytes,
            hardware_tier=device_type,
            gpu_utilization_percent=float((allocated_bytes / total_bytes * 100.0) if total_bytes > 0 else 0.0),
            active_models=active_models_pb,
            total_registered_models=len(self.lifecycle_mgr.models),
            active_cached_models=vram_status.get("cached_model_count", 0),
        )

    @classmethod
    def emit_lifecycle_event(
        cls,
        event_type: telemetry_pb2.TelemetryEventType,
        message: str
    ) -> None:
        """Utility for other services to broadcast immediate lifecycle or OOM events."""
        servicer = TelemetryService()
        event = servicer._build_snapshot_event(event_type, message)
        TelemetryEventBroadcaster.get_instance().broadcast(event)
