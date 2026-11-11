"""OpenAI-Compatible Gateway API Routes for AI Control Plane.

Exposes standard OpenAI endpoints:
- POST /v1/audio/speech
- POST /v1/audio/transcriptions
- POST /v1/chat/completions
- POST /v1/images/generations

Provides transparent mapping from OpenAI request schemas to the internal
UniversalInferenceRequest and DynamicBatchScheduler architecture.
"""

from __future__ import annotations

import base64
import json
import logging
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from core.exceptions import InvalidInferenceRequestError, ModelNotLoadedError
from core.protocols import UniversalInferenceRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["OpenAI Compatible Gateway"])

# Mapping from standard OpenAI aliases to real local models in the catalog
OPENAI_MODEL_ALIASES: dict[str, str] = {
    "tts-1": "kokoro-82m-tts",
    "tts-1-hd": "vieneu-tts-v3-turbo",
    "whisper-1": "whisper-large-v3-turbo",
    "whisper": "whisper-large-v3-turbo",
    "dall-e-3": "flux-1-schnell",
    "dall-e-2": "flux-1-schnell",
    "gpt-4o": "deepseek-r1-distill-qwen",
    "gpt-4": "deepseek-r1-distill-qwen",
    "gpt-3.5-turbo": "deepseek-r1-distill-qwen",
    "chatgpt-4o-latest": "deepseek-r1-distill-qwen",
}


def _resolve_engine_id(requested_model: str, default: str) -> str:
    """Resolve an OpenAI model name or alias to a registered engine ID."""
    clean = (requested_model or "").strip().lower()
    if clean in OPENAI_MODEL_ALIASES:
        return OPENAI_MODEL_ALIASES[clean]
    if clean:
        return clean
    return default


def _get_container() -> Any:
    from api.main import get_container

    return get_container()


async def _ensure_engine_ready(c: Any, engine_id: str, default_task: str | None = None) -> None:
    """Ensure that the target model engine is loaded and its batch scheduler is active."""
    from api.main import _load_engine_by_manifest

    if engine_id not in c.catalog_manifests:
        from engines.catalog_registry import infer_manifest_for_custom_hf

        try:
            manifest = infer_manifest_for_custom_hf(
                engine_id=engine_id,
                task=default_task,
                probe_remote_hub=True,
            )
            c.catalog_manifests[manifest.engine_id] = manifest
            if hasattr(c, "weights_manager") and c.weights_manager is not None:
                c.weights_manager.register_model(
                    engine_id=manifest.engine_id,
                    model_id=manifest.model_id,
                    pipeline_category=manifest.pipeline_category,
                    pipeline_type=manifest.pipeline_type,
                )
        except Exception as exc:
            raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered and could not be resolved: {exc}")

    manifest = c.catalog_manifests[engine_id]
    is_loaded = (
        engine_id in c.engines
        and (
            c.engines[engine_id].health()["loaded"]
            if hasattr(c.engines[engine_id], "health")
            else getattr(c.engines[engine_id], "is_loaded", True)
        )
    )
    if not is_loaded:
        await _load_engine_by_manifest(
            c,
            engine_id=engine_id,
            task=default_task,
            execution_target=manifest.default_execution_target,
            force_evict=True,
        )


# ==============================================================================
# 1. POST /v1/audio/speech (OpenAI TTS)
# ==============================================================================
class OpenAiSpeechRequest(BaseModel):
    model: str = Field(default="kokoro-82m-tts", description="TTS model or alias (e.g. tts-1, kokoro-82m-tts)")
    input: str = Field(..., description="The text to synthesize into speech.")
    voice: str = Field(default="af_bella", description="Voice preset ID (e.g. af_bella, am_adam, Hải Đăng)")
    response_format: str = Field(default="wav", description="Audio format: wav, pcm, or mp3.")
    speed: float = Field(default=1.0, ge=0.25, le=4.0, description="Speed factor between 0.25 and 4.0.")


@router.post("/audio/speech")
async def openai_audio_speech(
    body: OpenAiSpeechRequest,
    c: Any = Depends(_get_container),
) -> Response:
    """Synthesize speech following OpenAI Audio API format."""
    engine_id = _resolve_engine_id(body.model, default="kokoro-82m-tts")
    await _ensure_engine_ready(c, engine_id, default_task="text-to-speech")

    univ_req = UniversalInferenceRequest(
        inputs=body.input,
        slots={"prompt": body.input, "voice": body.voice},
        parameters={"voice": body.voice, "speed": body.speed},
    )

    scheduler = c.schedulers.get(engine_id)
    if scheduler is None:
        raise ModelNotLoadedError(f"Scheduler for engine '{engine_id}' is unavailable.")

    res = await scheduler.submit(univ_req)
    out_payload = getattr(res, "output", res)

    wav_bytes: bytes | None = None
    if isinstance(out_payload, dict):
        wav_bytes = out_payload.get("wav_bytes") or out_payload.get("raw_bytes")
        if not wav_bytes and "audio_wav_base64" in out_payload:
            wav_bytes = base64.b64decode(out_payload["audio_wav_base64"])
        elif not wav_bytes and "audio_base64" in out_payload:
            wav_bytes = base64.b64decode(out_payload["audio_base64"])
    elif hasattr(res, "wav_bytes"):
        wav_bytes = getattr(res, "wav_bytes")

    if not wav_bytes:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Speech synthesis produced no audio bytes.",
        )

    media_type = "audio/wav"
    if body.response_format.lower() == "mp3":
        media_type = "audio/mpeg"
    elif body.response_format.lower() == "pcm":
        media_type = "audio/pcm"

    return Response(content=wav_bytes, media_type=media_type)


# ==============================================================================
# 2. POST /v1/audio/transcriptions (OpenAI Whisper ASR)
# ==============================================================================
@router.post("/audio/transcriptions")
async def openai_audio_transcriptions(
    file: UploadFile = File(..., description="The audio file object to transcribe."),
    model: str = Form(default="whisper-large-v3-turbo", description="Model ID or alias (e.g. whisper-1)"),
    language: str | None = Form(default=None, description="ISO-639-1 language code."),
    prompt: str | None = Form(default=None, description="Optional prompt to guide the model."),
    response_format: str = Form(default="json", description="Output format: json, text, or verbose_json."),
    temperature: float = Form(default=0.0, description="Sampling temperature."),
    c: Any = Depends(_get_container),
) -> Response:
    """Transcribe audio into text following the OpenAI Audio API format."""
    engine_id = _resolve_engine_id(model, default="whisper-large-v3-turbo")
    await _ensure_engine_ready(c, engine_id, default_task="automatic-speech-recognition")

    raw_audio_bytes = await file.read()
    b64_str = base64.b64encode(raw_audio_bytes).decode("ascii")
    mime = file.content_type or "audio/wav"
    data_uri = f"data:{mime};base64,{b64_str}"

    parameters: dict[str, Any] = {"temperature": temperature}
    if language:
        parameters["language"] = language
    if prompt:
        parameters["prompt"] = prompt

    univ_req = UniversalInferenceRequest(
        inputs=data_uri,
        slots={"audio": data_uri},
        binary_bytes=raw_audio_bytes,
        binary_filename=file.filename or "audio.wav",
        binary_mime_type=mime,
        parameters=parameters,
    )

    scheduler = c.schedulers.get(engine_id)
    if scheduler is None:
        raise ModelNotLoadedError(f"Scheduler for engine '{engine_id}' is unavailable.")

    res = await scheduler.submit(univ_req)
    out_payload = getattr(res, "output", res)

    text = ""
    dur_sec = 0.0
    words = []
    if isinstance(out_payload, dict):
        text = str(out_payload.get("text", out_payload.get("output", "")))
        dur_sec = float(out_payload.get("duration_seconds", 0.0))
        words = out_payload.get("words", [])
    elif isinstance(out_payload, str):
        text = out_payload

    fmt = response_format.lower()
    if fmt == "text":
        return PlainTextResponse(text)

    if fmt == "verbose_json":
        return JSONResponse(
            {
                "task": "transcribe",
                "language": language or "vi",
                "duration": dur_sec,
                "text": text,
                "words": words,
            }
        )

    return JSONResponse({"text": text})


# ==============================================================================
# 3. POST /v1/chat/completions (OpenAI Chat Completions)
# ==============================================================================
class ChatMessage(BaseModel):
    role: str
    content: Any


class ChatCompletionRequest(BaseModel):
    model: str = Field(default="deepseek-r1-distill-qwen", description="Chat model ID or alias.")
    messages: list[ChatMessage] = Field(..., description="List of chat messages in conversation.")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    max_tokens: int | None = Field(default=256, ge=1)
    stream: bool = Field(default=False)


@router.post("/chat/completions")
async def openai_chat_completions(
    body: ChatCompletionRequest,
    c: Any = Depends(_get_container),
) -> Response:
    """Generate LLM completions conforming to the OpenAI Chat Completion format."""
    engine_id = _resolve_engine_id(body.model, default="deepseek-r1-distill-qwen")
    await _ensure_engine_ready(c, engine_id, default_task="text-generation")

    # Format messages into conversation string
    prompt_lines: list[str] = []
    for m in body.messages:
        content_str = m.content if isinstance(m.content, str) else json.dumps(m.content)
        prompt_lines.append(f"<|im_start|>{m.role}\n{content_str}<|im_end|>")
    prompt_lines.append("<|im_start|>assistant\n")
    formatted_prompt = "\n".join(prompt_lines)

    params: dict[str, Any] = {
        "temperature": body.temperature,
        "top_p": body.top_p,
        "max_new_tokens": body.max_tokens or 256,
    }

    scheduler = c.schedulers.get(engine_id)
    if scheduler is None:
        raise ModelNotLoadedError(f"Scheduler for engine '{engine_id}' is unavailable.")

    cmpl_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created_ts = int(time.time())

    # Handle streaming response
    if body.stream:
        async def _event_generator():
            engine_obj = c.engines.get(engine_id)
            if engine_obj and hasattr(engine_obj, "infer_stream"):
                async for chunk in engine_obj.infer_stream(formatted_prompt, params):
                    token_text = chunk if isinstance(chunk, str) else (chunk.decode("utf-8") if isinstance(chunk, bytes) else "")
                    chunk_payload = {
                        "id": cmpl_id,
                        "object": "chat.completion.chunk",
                        "created": created_ts,
                        "model": engine_id,
                        "choices": [
                            {
                                "index": 0,
                                "delta": {"content": token_text},
                                "finish_reason": None,
                            }
                        ],
                    }
                    yield f"data: {json.dumps(chunk_payload)}\n\n"
            yield f"data: {json.dumps({'id': cmpl_id, 'object': 'chat.completion.chunk', 'created': created_ts, 'model': engine_id, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(_event_generator(), media_type="text/event-stream")

    # Single-shot execution
    univ_req = UniversalInferenceRequest(
        inputs=formatted_prompt,
        slots={"prompt": formatted_prompt},
        parameters=params,
    )
    res = await scheduler.submit(univ_req)
    out_payload = getattr(res, "output", res)

    gen_text = ""
    if isinstance(out_payload, dict):
        gen_text = out_payload.get("answer_markdown") or out_payload.get("generated_text") or str(out_payload.get("output", ""))
    elif isinstance(out_payload, str):
        gen_text = out_payload

    prompt_tokens = max(1, len(formatted_prompt.split()))
    completion_tokens = max(1, len(gen_text.split()))

    return JSONResponse(
        {
            "id": cmpl_id,
            "object": "chat.completion",
            "created": created_ts,
            "model": engine_id,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": gen_text,
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }
    )


# ==============================================================================
# 4. POST /v1/images/generations (OpenAI Image Generations)
# ==============================================================================
class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Prompt describing the desired image.")
    model: str = Field(default="flux-1-schnell", description="Diffusion model ID or alias (e.g. dall-e-3).")
    n: int = Field(default=1, ge=1, le=1)
    size: str = Field(default="1024x1024", description="Image resolution (e.g. 1024x1024, 512x512).")
    response_format: str = Field(default="url", description="Format: 'url' (data URI) or 'b64_json'.")


@router.post("/images/generations")
async def openai_images_generations(
    body: ImageGenerationRequest,
    c: Any = Depends(_get_container),
) -> Response:
    """Synthesize images following the OpenAI Image Generation API format."""
    engine_id = _resolve_engine_id(body.model, default="flux-1-schnell")
    await _ensure_engine_ready(c, engine_id, default_task="text-to-image")

    w, h = 1024, 1024
    if "x" in body.size:
        try:
            parts = body.size.split("x")
            w, h = int(parts[0]), int(parts[1])
        except Exception:
            pass

    univ_req = UniversalInferenceRequest(
        inputs=body.prompt,
        slots={"prompt": body.prompt},
        parameters={"width": w, "height": h, "aspect_ratio": body.size},
    )

    scheduler = c.schedulers.get(engine_id)
    if scheduler is None:
        raise ModelNotLoadedError(f"Scheduler for engine '{engine_id}' is unavailable.")

    res = await scheduler.submit(univ_req)
    out_payload = getattr(res, "output", res)

    data_uri = ""
    if isinstance(out_payload, dict):
        data_uri = out_payload.get("image_data_uri") or str(out_payload.get("output", ""))
    elif isinstance(out_payload, str):
        data_uri = out_payload

    b64_part = ""
    if "base64," in data_uri:
        b64_part = data_uri.split("base64,")[1]

    data_item: dict[str, str] = {}
    if body.response_format == "b64_json":
        data_item["b64_json"] = b64_part
    else:
        data_item["url"] = data_uri

    return JSONResponse(
        {
            "created": int(time.time()),
            "data": [data_item],
        }
    )
