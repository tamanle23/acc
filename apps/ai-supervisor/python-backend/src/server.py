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


def serve(host="127.0.0.1", port=50051):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    tts_pb2_grpc.add_TTSServiceServicer_to_server(TTSService(), server)
    vision_pb2_grpc.add_VisionServiceServicer_to_server(VisionService(), server)
    llm_pb2_grpc.add_LLMServiceServicer_to_server(LLMService(), server)

    bind_address = f"{host}:{port}"
    server.add_insecure_port(bind_address)
    print(f"[ACC Python AI] gRPC server listening securely on {bind_address}", flush=True)
    server.start()

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("[ACC Python AI] Stopping gRPC server...", flush=True)
        server.stop(0)


if __name__ == "__main__":
    target_host = os.environ.get("ACC_GRPC_HOST", "127.0.0.1")
    target_port = int(os.environ.get("ACC_GRPC_PORT", 50051))
    if len(sys.argv) > 1:
        try:
            target_port = int(sys.argv[1])
        except ValueError:
            pass
    serve(target_host, target_port)
