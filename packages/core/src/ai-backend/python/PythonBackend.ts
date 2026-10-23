import { UniversalLogger as Logger } from '@acc/core-isomorphic';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'crypto';

// ==========================================
// IPC Interfaces
// ==========================================
export interface AIRequest {
  id: string;
  action: string;
  payload: any;
}

export interface AIResponse {
  id: string;
  status: 'success' | 'error';
  data?: any;
  message?: string;
}

// ==========================================
// Stream Utility
// ==========================================
/**
 * Safely buffers incoming stdout chunks to prevent JSON parsing errors 
 * when a payload is split across multiple stream events.
 */
class LineBuffer {
  private buffer = '';

  public processChunk(chunk: Buffer | string, onLine: (line: string) => void) {
    this.buffer += chunk.toString();
    let n = this.buffer.indexOf('\n');
    while (n > -1) {
      const line = this.buffer.substring(0, n).trim();
      this.buffer = this.buffer.substring(n + 1);
      if (line) {
        onLine(line);
      }
      n = this.buffer.indexOf('\n');
    }
  }
}

// ==========================================
// Domain Worker
// ==========================================
/**
 * Encapsulates the lifecycle, IPC stream, and queue 
 * of a single Python AI Daemon with resilient supervision.
 */
class PythonWorker {
  private process: ChildProcess | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;
  private isShuttingDown = false;

  private pendingRequests = new Map<string, { resolve: (res: any) => void; reject: (err: any) => void }>();
  private lineBuffer = new LineBuffer();

  constructor(public readonly domain: string) { }

  private resolveWorkerScript(): { scriptPath: string; workingDir: string; exists: boolean } {
    const scriptName = `${this.domain}_worker.py`;
    const globalAccDir = path.join(os.homedir(), '.acc', 'python', 'workers');
    const globalScript = path.join(globalAccDir, scriptName);
    if (fs.existsSync(globalScript)) {
      return { scriptPath: globalScript, workingDir: globalAccDir, exists: true };
    }
    const repoDir = path.resolve(process.cwd(), 'packages/core/src/ai-backend/python/workers');
    const repoScript = path.join(repoDir, scriptName);
    return { scriptPath: repoScript, workingDir: repoDir, exists: fs.existsSync(repoScript) };
  }

  /**
   * Bootstraps the worker process. Ensures singleton initialization per worker instance.
   */
  public async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    const { scriptPath, workingDir, exists } = this.resolveWorkerScript();
    if (!exists) {
      this.initPromise = Promise.reject(new Error(`Worker script not found for domain [${this.domain}]`));
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      Logger.info(`PythonBackend:${this.domain}`, `Bootstrapping Python Worker from ${scriptPath}...`);

      // Spawn using 'bun x' to resolve environment paths reliably
      this.process = spawn('bun', ['x', 'uv', 'run', scriptPath], {
        stdio: ['pipe', 'pipe', 'inherit'],
        cwd: workingDir,
        shell: process.platform === 'win32',
        env: {
          ...process.env,            // Keep existing environment variables
          PYTHONIOENCODING: "utf-8", // Force Python to read strings as UTF-8
          PYTHONUTF8: "1",           // Enforces UTF-8 mode globally in Python 3.7+
          HF_TOKEN: process.env.HF_TOKEN
        }
      });

      this.process.stdout?.on('data', (chunk) => {
        this.lineBuffer.processChunk(chunk, (line) => this.handleLine(line, resolve));
      });

      this.process.on('error', (err) => {
        Logger.error(`PythonBackend:${this.domain}`, `Process Error: ${err.message}`);
        this.rejectAllPending(new Error(`Worker process failed: ${err.message}`));
        reject(err);
      });

      this.process.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          Logger.error(`PythonBackend:${this.domain}`, `Exited with code ${code}`);
        }
        this.isReady = false;
        this.initPromise = null;
        this.process = null;

        // Resilient Supervisor: If exited unexpectedly and not shutting down, attempt auto-restart
        if (!this.isShuttingDown && this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          const backoffMs = Math.min(5000, 500 * Math.pow(2, this.restartAttempts - 1));
          Logger.warn(
            `PythonBackend:${this.domain}`,
            `Process crashed. Supervising auto-restart (attempt ${this.restartAttempts}/${this.maxRestartAttempts}) after ${backoffMs}ms...`
          );
          setTimeout(() => {
            if (!this.isShuttingDown) {
              this.initialize().catch((restartErr) => {
                Logger.error(`PythonBackend:${this.domain}`, `Supervised restart failed: ${restartErr.message}`);
              });
            }
          }, backoffMs);
        } else {
          this.rejectAllPending(new Error(`Worker process exited unexpectedly (code ${code})`));
        }
      });
    });

    return this.initPromise;
  }

  /**
   * Parses complete lines from the daemon's stdout.
   */
  private handleLine(line: string, onReady: () => void) {
    if (!this.isReady && line.includes('WORKER_READY')) {
      Logger.info(`PythonBackend:${this.domain}`, 'System is READY.');
      this.isReady = true;
      this.restartAttempts = 0; // Reset restart count on healthy startup
      onReady();
      return;
    }

    if (this.isReady) {
      try {
        const res = JSON.parse(line) as AIResponse;
        if (res.id && this.pendingRequests.has(res.id)) {
          const { resolve, reject } = this.pendingRequests.get(res.id)!;
          if (res.status === 'success') {
            resolve(res.data);
          } else {
            reject(new Error(res.message || `Unknown error from ${this.domain} worker`));
          }
          this.pendingRequests.delete(res.id);
          return;
        }
      } catch (e) {
        // Not a JSON response, just standard output from python (e.g. print statements)
      }
    }

    // Pass-through logging
    Logger.info(`PythonBackend:${this.domain}`, line);
  }

  /**
   * Safely rejects all pending promises if the daemon crashes.
   */
  private rejectAllPending(error: Error) {
    for (const [id, req] of this.pendingRequests.entries()) {
      req.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Health check probing domain worker responsiveness.
   */
  public async checkHealth(): Promise<boolean> {
    if (this.isShuttingDown) return false;
    const { exists } = this.resolveWorkerScript();
    if (!exists) return false;
    if (!this.isReady) {
      try {
        await this.initialize();
      } catch {
        return false;
      }
    }
    try {
      const res = await Promise.race([
        this.dispatch('ping', {}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 2500)),
      ]);
      return res !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Sends a task to the python daemon via NDJSON over stdin.
   */
  public async dispatch<T>(action: string, payload: any): Promise<T> {
    if (!this.isReady) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        return reject(new Error(`Worker process for domain '${this.domain}' is not running.`));
      }

      const id = randomUUID();
      this.pendingRequests.set(id, { resolve, reject });

      const request: AIRequest = { id, action, payload };
      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Gracefully or forcefully terminates the daemon.
   */
  public kill() {
    this.isShuttingDown = true;
    if (this.process && !this.process.killed) {
      this.process.kill('SIGKILL');
    }
    this.rejectAllPending(new Error('PythonBackend shutting down.'));
    this.isReady = false;
    this.initPromise = null;
  }
}

// ==========================================
// Global Manager (Facade)
// ==========================================
/**
 * PythonBackend is the central Orchestrator for all Python sub-systems.
 * Implements the Singleton pattern to coordinate global daemon lifecycles.
 */
export class PythonBackend {
  private static instance: PythonBackend;
  private workers = new Map<string, PythonWorker>();

  private constructor() {
    this.setupProcessHandlers();
  }

  public static getInstance(): PythonBackend {
    if (!PythonBackend.instance) {
      PythonBackend.instance = new PythonBackend();
    }
    return PythonBackend.instance;
  }

  private setupProcessHandlers() {
    const cleanup = () => this.shutdown();
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  }

  /**
   * Dispatches a task to the specified domain worker.
   * If the worker does not exist, it will be automatically bootstrapped.
   */
  public async dispatchTask<T>(domain: string, action: string, payload: any): Promise<T> {
    let worker = this.workers.get(domain);
    if (!worker) {
      worker = new PythonWorker(domain);
      this.workers.set(domain, worker);
    }
    return worker.dispatch<T>(action, payload);
  }

  /**
   * Performs an asynchronous health check probe against the specified domain worker.
   */
  public async checkHealth(domain: string): Promise<boolean> {
    let worker = this.workers.get(domain);
    if (!worker) {
      worker = new PythonWorker(domain);
      this.workers.set(domain, worker);
    }
    return worker.checkHealth();
  }

  /**
   * Kills all active Python workers and clears the registry.
   */
  public shutdown() {
    for (const worker of this.workers.values()) {
      worker.kill();
    }
    this.workers.clear();
  }
}

