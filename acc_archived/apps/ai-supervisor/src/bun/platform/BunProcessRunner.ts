import { spawn, type Subprocess } from "bun";
import {
  type IProcessRunner,
  type ProcessOutput,
  type ExecuteOptions,
  type SpawnManagedOptions,
  type ManagedProcess,
  type Result,
  ProcessError,
} from "./IProcessRunner";

class BunManagedProcess implements ManagedProcess {
  private _killed = false;

  constructor(
    private readonly sub: Subprocess,
    private readonly onUnregister: (proc: BunManagedProcess) => void
  ) {}

  get pid(): number {
    return this.sub.pid;
  }

  get killed(): boolean {
    return this._killed || this.sub.exitCode !== null;
  }

  async kill(signal: NodeJS.Signals | number = "SIGTERM"): Promise<boolean> {
    if (this.killed) return true;
    try {
      this.sub.kill(signal as any);
      this._killed = true;
      this.onUnregister(this);
      return true;
    } catch {
      return false;
    }
  }

  async writeStdin(data: string | Uint8Array): Promise<void> {
    if (this.killed) {
      // Process has already terminated or exited; silently ignore stdin writes
      return;
    }
    try {
      const writer = (this.sub.stdin as any)?.getWriter?.() ?? (this.sub.stdin as any);
      if (!writer) {
        return;
      }

      if (typeof writer.write === "function") {
        const payload = typeof data === "string" ? new TextEncoder().encode(data) : data;
        await writer.write(payload);
        if (typeof writer.flush === "function") {
          await writer.flush();
        }
      }
    } catch {
      // Stream broken / process closed pipe; ignore on exit
    }
  }

  async wait(): Promise<number> {
    const code = await this.sub.exited;
    this.onUnregister(this);
    return code;
  }
}

export class BunProcessRunner implements IProcessRunner {
  private readonly managedProcesses = new Set<BunManagedProcess>();
  private readonly whichCache = new Map<string, string | null>();
  private isShuttingDown = false;

  constructor() {
    this.registerExitHooks();
  }

  private registerExitHooks(): void {
    const handleExit = () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      for (const proc of this.managedProcesses) {
        try {
          proc.kill("SIGKILL");
        } catch {
          // Ignore errors on termination
        }
      }
      this.managedProcesses.clear();
    };

    process.once("SIGINT", handleExit);
    process.once("SIGTERM", handleExit);
    process.once("beforeExit", handleExit);
  }

  async execute(
    cmd: readonly string[],
    options: ExecuteOptions = {}
  ): Promise<Result<ProcessOutput, ProcessError>> {
    try {
      const child = spawn([...cmd], {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        stdin: options.stdin ? "pipe" : "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });

      if (options.stdin && child.stdin) {
        const payload = typeof options.stdin === "string"
          ? new TextEncoder().encode(options.stdin)
          : options.stdin;
        const writer = (child.stdin as any)?.getWriter?.() ?? (child.stdin as any);
        if (typeof writer.write === "function") {
          await writer.write(payload);
          if (typeof writer.close === "function") await writer.close();
        }
      }

      let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;

      if (options.timeoutMs && options.timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore
          }
        }, options.timeoutMs);
      }

      const stdoutPromise = new Response(child.stdout as any).text();
      const stderrPromise = new Response(child.stderr as any).text();

      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        stdoutPromise,
        stderrPromise,
      ]);

      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (timedOut) {
        return {
          ok: false,
          error: new ProcessError(
            `Process execution timed out after ${options.timeoutMs}ms: ${cmd.join(" ")}`,
            -1,
            stdout,
            stderr
          ),
        };
      }

      if (exitCode !== 0) {
        return {
          ok: false,
          error: new ProcessError(
            `Process exited with code ${exitCode}: ${cmd.join(" ")}`,
            exitCode,
            stdout,
            stderr
          ),
        };
      }

      return {
        ok: true,
        value: {
          exitCode,
          stdout,
          stderr,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: new ProcessError(
          `Failed to execute process: ${cmd.join(" ")}`,
          -1,
          "",
          "",
          err
        ),
      };
    }
  }

  spawnManaged(
    cmd: readonly string[],
    options: SpawnManagedOptions = {}
  ): ManagedProcess {
    const child = spawn([...cmd], {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      stdin: options.stdin ?? "ignore",
      stdout: options.stdout ?? "ignore",
      stderr: options.stderr ?? "ignore",
    });

    const managed = new BunManagedProcess(child, (proc) => {
      this.managedProcesses.delete(proc);
    });

    this.managedProcesses.add(managed);

    if (options.onStdout && child.stdout && typeof child.stdout.getReader === "function") {
      const reader = child.stdout.getReader();
      const decoder = new TextDecoder();
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            options.onStdout?.(decoder.decode(value, { stream: true }));
          }
        } catch {
          // stream closed
        }
      })();
    }

    if (options.onStderr && child.stderr && typeof child.stderr.getReader === "function") {
      const reader = child.stderr.getReader();
      const decoder = new TextDecoder();
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            options.onStderr?.(decoder.decode(value, { stream: true }));
          }
        } catch {
          // stream closed
        }
      })();
    }

    child.exited.then((code) => {
      this.managedProcesses.delete(managed);
      options.onExit?.(code);
    });

    return managed;
  }

  async which(tool: string): Promise<string | null> {
    if (this.whichCache.has(tool)) {
      return this.whichCache.get(tool)!;
    }

    const isWindows = process.platform === "win32";
    const lookupCmd = isWindows ? ["where.exe", tool] : ["which", tool];

    const result = await this.execute(lookupCmd, { timeoutMs: 3000 });
    if (result.ok) {
      const path = result.value.stdout.split("\n")[0]?.trim();
      const resolved = path && path.length > 0 ? path : null;
      this.whichCache.set(tool, resolved);
      return resolved;
    }

    this.whichCache.set(tool, null);
    return null;
  }

  async cleanup(): Promise<void> {
    const killPromises = Array.from(this.managedProcesses).map((p) => p.kill("SIGTERM"));
    await Promise.all(killPromises);
    this.managedProcesses.clear();
  }
}

/** Global default process runner singleton */
export const defaultProcessRunner: IProcessRunner = new BunProcessRunner();
