import { configStore } from "../../configStore.js";
import { CORS_HEADERS, type RouteHandler } from "./types.js";
import { AIInferenceClient } from "@acc/ai-control-plane-sdk";

export const handleTtsRoutes: RouteHandler = async (req: Request, url: URL): Promise<Response | null> => {
  if (url.pathname === "/api/tts/test" && req.method === "POST") {
    try {
      const body = await req.json();
      const config = configStore.loadConfig();
      const port = config.aiControlPlanePort || 50051;

      const client = new AIInferenceClient({
        baseUrls: [`http://127.0.0.1:${port}`, `http://localhost:${port}`],
      });

      const startTime = performance.now();
      const text = body.text || "Hello from ACC AI-Supervisor Neural Speech Playground.";
      const voice = body.voice_id || body.voice || "af_heart";
      const model = body.model_strategy || body.model || "kokoro";
      const speed = Number(body.speed || 1.0);

      const audioBuffer = await client.openAiSpeech({
        input: text,
        voice,
        model,
        speed,
        response_format: "wav",
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");
      // Standard estimation if not returned in wav header: 24kHz 16-bit mono = ~48000 bytes/sec
      const durationMs = Math.max(100, Math.round((audioBuffer.byteLength / 48000) * 1000));
      const rtf = Number((latencyMs / durationMs).toFixed(3));

      return Response.json(
        {
          success: true,
          audioBase64,
          sampleRate: 24000,
          durationMs,
          latencyMs,
          rtf,
          modelStrategy: model,
        },
        { headers: CORS_HEADERS }
      );
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return null;
};
