import path from "node:path";
import { configStore } from "../../configStore.js";
import { findRepoRoot } from "../../SupervisorEngine.js";
import { CORS_HEADERS, type RouteHandler } from "./types.js";

export const handleTtsRoutes: RouteHandler = async (req: Request, url: URL): Promise<Response | null> => {
  if (url.pathname === "/api/tts/test" && req.method === "POST") {
    try {
      const body = await req.json();
      const config = configStore.loadConfig();
      const repoRoot = findRepoRoot(import.meta.dir);
      const protoPath = path.resolve(repoRoot, "packages/proto/proto/acc/v1/tts.proto");
      const protoLoader = await import("@grpc/proto-loader");
      const grpc = await import("@grpc/grpc-js");

      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [path.resolve(repoRoot, "packages/proto/proto/acc/v1")],
      });
      const proto = grpc.loadPackageDefinition(packageDefinition) as any;
      const TTSService = proto.acc?.v1?.TTSService;

      if (!TTSService) {
        return Response.json(
          { success: false, error: "TTSService proto not found" },
          { status: 500, headers: CORS_HEADERS }
        );
      }

      const client = new TTSService(`127.0.0.1:${config.pythonPort}`, grpc.credentials.createInsecure());
      const startTime = performance.now();

      const result = await new Promise<any>((resolve, reject) => {
        client.Synthesize(
          {
            text: body.text || "Hello from ACC AI-Supervisor Neural Speech Playground.",
            voice_id: body.voice_id || "af_heart",
            speed: Number(body.speed || 1.0),
            model_strategy: body.model_strategy || "kokoro",
          },
          (err: any, response: any) => {
            if (err) reject(err);
            else resolve(response);
          }
        );
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const audioBase64 = Buffer.from(result.audio_data).toString("base64");
      const durationMs = Number(result.duration_ms) || 1000;
      const rtf = Number((latencyMs / durationMs).toFixed(3));

      return Response.json(
        {
          success: true,
          audioBase64,
          sampleRate: result.sample_rate || 24000,
          durationMs,
          latencyMs,
          rtf,
          modelStrategy: body.model_strategy || "kokoro",
        },
        { headers: CORS_HEADERS }
      );
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return null;
};
