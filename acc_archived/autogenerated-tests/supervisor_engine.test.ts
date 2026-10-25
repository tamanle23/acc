import { describe, expect, it } from "bun:test";
import { SupervisorEngine } from "../apps/ai-supervisor/src/bun/SupervisorEngine.js";

describe("SupervisorEngine Multi-Daemon Orchestration", () => {
  it("initializes fleet with all 4 services in STOPPED state", () => {
    const engine = new SupervisorEngine();
    const states = engine.getAllStates();

    expect(Object.keys(states)).toEqual(["python-backend", "worker", "studio", "ollama"]);
    expect(states["python-backend"].status).toBe("STOPPED");
    expect(states["worker"].status).toBe("STOPPED");
    expect(states["studio"].status).toBe("STOPPED");
    expect(states["ollama"].status).toBe("STOPPED");
  });

  it("calculates dynamic tray colors based on fleet states", () => {
    const engine = new SupervisorEngine();
    // Default stopped -> yellow
    expect(engine.getTrayColor()).toBe("yellow");

    // All running -> green
    const s1 = engine.getServiceState("python-backend")!;
    const s2 = engine.getServiceState("worker")!;
    const s3 = engine.getServiceState("studio")!;
    const s4 = engine.getServiceState("ollama")!;

    s1.status = "RUNNING";
    s2.status = "RUNNING";
    s3.status = "RUNNING";
    s4.status = "ADOPTED";

    // Trigger state evaluation via status change listener
    let emittedTrayColor = "";
    engine.onStatusChange((_states, color) => {
      emittedTrayColor = color;
    });

    // Mock an internal trigger
    (engine as any).emitChange();
    expect(engine.getTrayColor()).toBe("green");
    expect(emittedTrayColor).toBe("green");

    // Any CRASH_LOOP -> red
    s1.status = "CRASH_LOOP";
    (engine as any).emitChange();
    expect(engine.getTrayColor()).toBe("red");
    expect(emittedTrayColor).toBe("red");
  });

  it("detects workload busy state", () => {
    const engine = new SupervisorEngine();
    expect(engine.isBusy()).toBe(false);

    const studio = engine.getServiceState("studio")!;
    studio.status = "BUSY";
    expect(engine.isBusy()).toBe(true);

    studio.status = "RUNNING";
    expect(engine.isBusy()).toBe(false);
  });

  it("dispatches VRAM purge across Ollama and Python backend without throwing", async () => {
    const engine = new SupervisorEngine();
    expect(engine.purgeAllVram()).resolves.toBeUndefined();
  });
});
