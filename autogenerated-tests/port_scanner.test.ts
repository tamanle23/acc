import { describe, expect, it } from "bun:test";
import net from "node:net";
import { findAvailablePort, isPortAvailable } from "../apps/ai-supervisor/src/bun/portScanner.js";

describe("Dynamic Port Scanner", () => {
  it("detects an available ephemeral port", async () => {
    const available = await isPortAvailable(49152);
    expect(typeof available).toBe("boolean");
  });

  it("detects when a port is actively occupied and bypasses it", async () => {
    // 1. Bind an ephemeral server to an available port
    const basePort = await findAvailablePort(45000);
    const server = net.createServer();

    await new Promise<void>((resolve) => {
      server.listen(basePort, "127.0.0.1", () => resolve());
    });

    try {
      // 2. isPortAvailable should report false
      const available = await isPortAvailable(basePort);
      expect(available).toBe(false);

      // 3. findAvailablePort starting at basePort should skip to basePort + 1 (or higher)
      const nextPort = await findAvailablePort(basePort);
      expect(nextPort).toBeGreaterThan(basePort);
      expect(await isPortAvailable(nextPort)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("throws an error if an invalid port number is requested", async () => {
    expect(findAvailablePort(-1)).rejects.toThrow();
    expect(findAvailablePort(70000)).rejects.toThrow();
  });

  it("accurately detects when a TCP port is listening", async () => {
    const { isPortListening } = await import("../apps/ai-supervisor/src/bun/portScanner.js");
    const testPort = await findAvailablePort(46000);

    // When not listening
    expect(await isPortListening(testPort)).toBe(false);

    // Start listening
    const server = net.createServer();
    await new Promise<void>((resolve) => {
      server.listen(testPort, "127.0.0.1", () => resolve());
    });

    try {
      expect(await isPortListening(testPort)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    expect(await isPortListening(testPort)).toBe(false);
  });
});
