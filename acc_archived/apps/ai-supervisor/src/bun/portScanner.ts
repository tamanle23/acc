import net from "node:net";

/**
 * Checks if a specific network port is currently available for binding.
 */
export async function isPortAvailable(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, host);
  });
}

/**
 * Checks if a specific network port is actively open and accepting TCP connections.
 * Tests IPv4 (127.0.0.1) and IPv6/localhost (::1) fallback.
 */
export async function isPortListening(port: number, host = "localhost", timeoutMs = 500): Promise<boolean> {
  const tryHost = (targetHost: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      socket.setTimeout(timeoutMs);

      socket.once("connect", () => {
        settled = true;
        socket.destroy();
        resolve(true);
      });

      socket.once("timeout", () => {
        if (!settled) {
          settled = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.once("error", () => {
        if (!settled) {
          settled = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.connect(port, targetHost);
    });
  };

  const primary = await tryHost(host);
  if (primary) return true;
  if (host === "127.0.0.1" || host === "localhost") {
    return await tryHost(host === "127.0.0.1" ? "localhost" : "127.0.0.1");
  }
  return false;
}

/**
 * Resolves the OS PID listening on a specific network port.
 * Uses lsof on macOS/Linux and netstat on Windows via IProcessRunner.
 */
export async function findPidByPort(port: number, runner?: any): Promise<number | null> {
  if (!port || port <= 0) return null;
  try {
    if (process.platform === "win32") {
      const netstatCmd = ["netstat", "-ano", "-p", "tcp"];
      const res = runner && typeof runner.execute === "function" ? await runner.execute(netstatCmd) : await Bun.spawn(netstatCmd).output();
      const stdout = typeof res?.stdout === "string" ? res.stdout : new TextDecoder().decode(res);
      const lines = stdout.split("\n");
      for (const line of lines) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (Number.isFinite(pid) && pid > 0) return pid;
        }
      }
    } else {
      // macOS and Linux: lsof -i :<port> -t
      const lsofCmd = ["lsof", "-i", `:${port}`, "-t"];
      if (runner && typeof runner.execute === "function") {
        const res = await runner.execute(lsofCmd);
        const isOk = res && (typeof res.isOk === "function" ? res.isOk() : res.ok === true);
        if (isOk && res.value?.stdout?.trim()) {
          const pids = res.value.stdout.trim().split("\n");
          const pid = parseInt(pids[0], 10);
          if (Number.isFinite(pid) && pid > 0) return pid;
        }
      } else {
        const proc = Bun.spawn(lsofCmd, { stdout: "pipe", stderr: "ignore" });
        const text = await new Response(proc.stdout).text();
        await proc.exited;
        if (text.trim()) {
          const pids = text.trim().split("\n");
          const pid = parseInt(pids[0], 10);
          if (Number.isFinite(pid) && pid > 0) return pid;
        }
      }
    }
  } catch {
    // Non-fatal, port query failed
  }
  return null;
}

/**
 * Scans starting from a base port until an available port is found.
 * If the starting port is already in use, advances sequentially.
 */
export async function findAvailablePort(startingPort: number, maxTries = 50, host = "127.0.0.1"): Promise<number> {
  if (startingPort <= 0 || startingPort > 65535) {
    throw new Error(`Invalid starting port: ${startingPort}`);
  }

  for (let offset = 0; offset < maxTries; offset++) {
    const port = startingPort + offset;
    if (port > 65535) break;

    const available = await isPortAvailable(port, host);
    if (available) {
      return port;
    }
  }

  throw new Error(`No available ports found starting from ${startingPort} within ${maxTries} tries`);
}
