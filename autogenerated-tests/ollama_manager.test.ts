import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { OllamaManager } from "../apps/ai-supervisor/src/bun/OllamaManager.js";

describe("OllamaManager Integration & Telemetry", () => {
  let mockServer: any;
  let mockPort: number;
  let receivedKeepAlivePayload: any = null;

  beforeAll(async () => {
    mockServer = Bun.serve({
      port: 0, // pick free port
      fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/api/tags") {
          return Response.json({
            models: [
              { name: "llama3.2:latest", size: 2000000000, digest: "sha256:abc" },
              { name: "qwen2.5:3b", size: 1800000000, digest: "sha256:def" },
            ],
          });
        }

        if (url.pathname === "/api/ps") {
          return Response.json({
            models: [
              { name: "llama3.2:latest", size: 2000000000, size_vram: 1950000000 },
            ],
          });
        }

        if (url.pathname === "/api/generate" && req.method === "POST") {
          return req.json().then((body) => {
            receivedKeepAlivePayload = body;
            return Response.json({ response: "", done: true });
          });
        }

        return new Response("Not found", { status: 404 });
      },
    });

    mockPort = mockServer.port;
  });

  afterAll(() => {
    if (mockServer) {
      mockServer.stop();
    }
  });

  it("checks Ollama liveliness via isAlive()", async () => {
    const manager = new OllamaManager(mockPort);
    expect(await manager.isAlive(mockPort)).toBe(true);

    // Non-existent port
    expect(await manager.isAlive(59999)).toBe(false);
  });

  it("retrieves installed models via listModels()", async () => {
    const manager = new OllamaManager(mockPort);
    const models = await manager.listModels(mockPort);

    expect(models.length).toBe(2);
    expect(models[0].name).toBe("llama3.2:latest");
  });

  it("retrieves currently active VRAM models via getActiveModels()", async () => {
    const manager = new OllamaManager(mockPort);
    const active = await manager.getActiveModels(mockPort);

    expect(active.length).toBe(1);
    expect(active[0].name).toBe("llama3.2:latest");
    expect(active[0].sizeVram).toBeGreaterThan(0);
  });

  it("dispatches keep_alive: 0 to evict model from VRAM", async () => {
    const manager = new OllamaManager(mockPort);
    const success = await manager.unloadModel("llama3.2:latest", mockPort);

    expect(success).toBe(true);
    expect(receivedKeepAlivePayload).toBeDefined();
    expect(receivedKeepAlivePayload.model).toBe("llama3.2:latest");
    expect(receivedKeepAlivePayload.keep_alive).toBe(0);
  });
});
