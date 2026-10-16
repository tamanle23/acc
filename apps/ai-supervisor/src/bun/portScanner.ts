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
 */
export async function isPortListening(port: number, host = "127.0.0.1", timeoutMs = 500): Promise<boolean> {
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

    socket.connect(port, host);
  });
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
