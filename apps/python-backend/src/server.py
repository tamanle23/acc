import sys
import os
import time
from concurrent import futures
import grpc

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


class TTSService(tts_pb2_grpc.TTSServiceServicer):
    def Ping(self, request, context):
        current_time = int(time.time() * 1000)
        return common_pb2.PingResponse(
            message=f"TTS pong: {request.message}",
            timestamp_ms=current_time,
            status="READY",
        )

    def Synthesize(self, request, context):
        # Stub response for Phase 1 verification
        return tts_pb2.TTSResponse(
            audio_data=b"",
            sample_rate=24000,
            channels=1,
            duration_ms=0,
        )


class VisionService(vision_pb2_grpc.VisionServiceServicer):
    def Ping(self, request, context):
        current_time = int(time.time() * 1000)
        return common_pb2.PingResponse(
            message=f"Vision pong: {request.message}",
            timestamp_ms=current_time,
            status="READY",
        )

    def EstimateDepth(self, request, context):
        return vision_pb2.DepthResponse(
            depth_map_png=b"",
            min_depth=0.0,
            max_depth=1.0,
        )

    def SegmentSubject(self, request, context):
        return vision_pb2.SegmentationResponse(
            mask_png=b"",
            bounding_box=common_pb2.BoundingBox(x=0.0, y=0.0, width=1.0, height=1.0, confidence=1.0),
            confidence=1.0,
        )


class LLMService(llm_pb2_grpc.LLMServiceServicer):
    def Ping(self, request, context):
        current_time = int(time.time() * 1000)
        return common_pb2.PingResponse(
            message=f"LLM pong: {request.message}",
            timestamp_ms=current_time,
            status="READY",
        )

    def GenerateStructuredJson(self, request, context):
        return llm_pb2.LLMJsonResponse(
            json_output="{}",
            tokens_used=0,
            latency_ms=0,
        )


def serve(port=50051):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    tts_pb2_grpc.add_TTSServiceServicer_to_server(TTSService(), server)
    vision_pb2_grpc.add_VisionServiceServicer_to_server(VisionService(), server)
    llm_pb2_grpc.add_LLMServiceServicer_to_server(LLMService(), server)

    bind_address = f"0.0.0.0:{port}"
    server.add_insecure_port(bind_address)
    print(f"[ACC Python AI] gRPC server listening on {bind_address}", flush=True)
    server.start()

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("[ACC Python AI] Stopping gRPC server...", flush=True)
        server.stop(0)


if __name__ == "__main__":
    target_port = int(os.environ.get("ACC_GRPC_PORT", 50051))
    if len(sys.argv) > 1:
        try:
            target_port = int(sys.argv[1])
        except ValueError:
            pass
    serve(target_port)
