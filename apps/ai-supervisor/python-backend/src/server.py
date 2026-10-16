import sys
import os
import time
import signal
from concurrent import futures
import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

# Add src and generated directories to sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATED_DIR = os.path.join(CURRENT_DIR, "generated")
if GENERATED_DIR not in sys.path:
    sys.path.insert(0, GENERATED_DIR)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

import common_pb2
import common_pb2_grpc
import tts_pb2
import tts_pb2_grpc
import vision_pb2
import vision_pb2_grpc
import llm_pb2
import llm_pb2_grpc
import admin_pb2
import admin_pb2_grpc
from watchdog import PIDManager, start_parent_watchdog
from services.model_lifecycle_manager import ModelLifecycleManager


class TTSService(tts_pb2_grpc.TTSServiceServicer):
    def __init__(self):
        super().__init__()
        from services.tts_engine import TTSEngine
        self.engine = TTSEngine.get_instance()

    def Ping(self, request, context):
        current_time = int(time.time() * 1000)
        return common_pb2.PingResponse(
            message=f"TTS pong: {request.message}",
            timestamp_ms=current_time,
            status="READY",
        )

    def Synthesize(self, request, context):
        try:
            audio_bytes, sr, ch, dur = self.engine.synthesize(
                request.text,
                request.voice_id or "af_heart",
                request.speed or 1.0,
                request.model_strategy or "kokoro"
            )
            return tts_pb2.TTSResponse(
                audio_data=audio_bytes,
                sample_rate=sr,
                channels=ch,
                duration_ms=dur,
            )
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return tts_pb2.TTSResponse()


class VisionService(vision_pb2_grpc.VisionServiceServicer):
    def __init__(self):
        super().__init__()
        from services.vision_engine import VisionEngine
        self.engine = VisionEngine.get_instance()

    def Ping(self, request, context):
        current_time = int(time.time() * 1000)
        return common_pb2.PingResponse(
            message=f"Vision pong: {request.message}",
            timestamp_ms=current_time,
            status="READY",
        )

    def EstimateDepth(self, request, context):
        try:
            depth_bytes, min_d, max_d = self.engine.estimate_depth(request.image_data, request.model_size)
            return vision_pb2.DepthResponse(
                depth_map_png=depth_bytes,
                min_depth=min_d,
                max_depth=max_d,
            )
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return vision_pb2.DepthResponse()

    def SegmentSubject(self, request, context):
        try:
            mask_bytes, bbox, conf = self.engine.segment_subject(request.image_data, request.mode)
            return vision_pb2.SegmentationResponse(
                mask_png=mask_bytes,
                bounding_box=common_pb2.BoundingBox(
                    x=bbox["x"], y=bbox["y"], width=bbox["width"], height=bbox["height"], confidence=conf
                ),
                confidence=conf,
            )
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return vision_pb2.SegmentationResponse()


class LLMService(llm_pb2_grpc.LLMServiceServicer):
    def __init__(self):
        super().__init__()
        from services.llm_engine import LLMEngine
        self.engine = LLMEngine.get_instance()

    def Ping(self, request, context):
        current_time = int(time.time() * 1000)
        return common_pb2.PingResponse(
            message=f"LLM pong: {request.message}",
            timestamp_ms=current_time,
            status="READY",
        )

    def GenerateStructuredJson(self, request, context):
        try:
            json_str, tokens, lat = self.engine.generate_structured_json(
                request.prompt,
                request.json_schema,
                request.system_instruction,
                request.temperature
            )
            return llm_pb2.LLMJsonResponse(
                json_output=json_str,
                tokens_used=tokens,
                latency_ms=lat,
            )
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return llm_pb2.LLMJsonResponse(json_output="{}", tokens_used=0, latency_ms=0)


class AdminService(admin_pb2_grpc.AdminServiceServicer):
    def __init__(self):
        super().__init__()
        self.lifecycle_mgr = ModelLifecycleManager.get_instance()

    def PurgeVRAM(self, request, context):
        try:
            success, freed_bytes, msg = self.lifecycle_mgr.purge_all(force=request.force)
            return admin_pb2.PurgeVRAMResponse(
                success=success,
                freed_bytes=freed_bytes,
                message=msg,
            )
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return admin_pb2.PurgeVRAMResponse(success=False, freed_bytes=0, message=str(e))

    def GetVRAMStatus(self, request, context):
        try:
            status = self.lifecycle_mgr.get_vram_status()
            models_info = [
                admin_pb2.VRAMModelInfo(
                    name=m["name"],
                    vram_mb=m["vram_mb"],
                    access_count=m["access_count"],
                )
                for m in status["active_models"]
            ]
            return admin_pb2.VRAMStatusResponse(
                total_vram_bytes=status["total_vram_bytes"],
                free_vram_bytes=status["free_vram_bytes"],
                cached_model_count=status["cached_model_count"],
                active_models=models_info,
            )
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return admin_pb2.VRAMStatusResponse()


def serve(host="127.0.0.1", port=50051, parent_pid=None):
    pid_manager = PIDManager()
    pid_manager.write_pid()

    # 1. Start parent watchdog if parent_pid is provided
    if parent_pid and parent_pid > 0:
        start_parent_watchdog(parent_pid, poll_interval_sec=1.0, on_terminate=pid_manager.remove_pid)

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    # 2. Register ACC AI services
    tts_pb2_grpc.add_TTSServiceServicer_to_server(TTSService(), server)
    vision_pb2_grpc.add_VisionServiceServicer_to_server(VisionService(), server)
    llm_pb2_grpc.add_LLMServiceServicer_to_server(LLMService(), server)
    admin_pb2_grpc.add_AdminServiceServicer_to_server(AdminService(), server)

    # 3. Standard grpc.health.v1 health check servicer
    health_servicer = health.HealthServicer()
    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("acc.v1.TTSService", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("acc.v1.VisionService", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("acc.v1.LLMService", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("acc.v1.AdminService", health_pb2.HealthCheckResponse.SERVING)
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)

    bind_address = f"{host}:{port}"
    server.add_insecure_port(bind_address)
    print(f"[ACC Python AI] gRPC server listening securely on {bind_address}", flush=True)
    server.start()

    def graceful_shutdown(signum, frame):
        print(f"\n[ACC Python AI] Received signal {signum}. Initiating graceful shutdown...", flush=True)
        health_servicer.set("", health_pb2.HealthCheckResponse.NOT_SERVING)
        server.stop(grace=1.0)
        pid_manager.remove_pid()
        sys.exit(0)

    signal.signal(signal.SIGINT, graceful_shutdown)
    signal.signal(signal.SIGTERM, graceful_shutdown)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, graceful_shutdown)

    try:
        server.wait_for_termination()
    except Exception:
        server.stop(0)
    finally:
        pid_manager.remove_pid()


if __name__ == "__main__":
    target_host = os.environ.get("ACC_GRPC_HOST", "127.0.0.1")
    target_port = int(os.environ.get("ACC_GRPC_PORT", 50051))
    parent_pid_env = os.environ.get("ACC_PARENT_PID")
    target_parent_pid = int(parent_pid_env) if parent_pid_env and parent_pid_env.isdigit() else None

    # CLI args parsing
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--parent-pid" and i + 1 < len(args):
            try:
                target_parent_pid = int(args[i + 1])
            except ValueError:
                pass
            i += 2
        elif arg.isdigit():
            target_port = int(arg)
            i += 1
        else:
            i += 1

    serve(target_host, target_port, parent_pid=target_parent_pid)
