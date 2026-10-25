/**
 * Represents a strongly typed Result pattern for enterprise resilience.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface ProcessOutput {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export class ProcessError extends Error {
  constructor(
    message: string,
    public readonly exitCode?: number,
    public readonly stdout?: string,
    public readonly stderr?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ProcessError";
  }
}

export interface ExecuteOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly stdin?: string | Uint8Array;
}

export interface SpawnManagedOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly stdout?: "pipe" | "inherit" | "ignore";
  readonly stderr?: "pipe" | "inherit" | "ignore";
  readonly stdin?: "pipe" | "inherit" | "ignore";
  readonly onStdout?: (chunk: string) => void;
  readonly onStderr?: (chunk: string) => void;
  readonly onExit?: (code: number | null) => void;
}

export interface ManagedProcess {
  readonly pid: number;
  readonly killed: boolean;
  kill(signal?: NodeJS.Signals | number): Promise<boolean>;
  writeStdin(data: string | Uint8Array): Promise<void>;
  wait(): Promise<number>;
}

export interface IProcessRunner {
  /**
   * Run a process to completion, capturing standard streams.
   */
  execute(
    cmd: readonly string[],
    options?: ExecuteOptions
  ): Promise<Result<ProcessOutput, ProcessError>>;

  /**
   * Spawn a tracked long-running child process registered for automatic cleanup on parent termination.
   */
  spawnManaged(
    cmd: readonly string[],
    options?: SpawnManagedOptions
  ): ManagedProcess;

  /**
   * Resolve full executable path via PATH lookup with caching.
   */
  which(tool: string): Promise<string | null>;

  /**
   * Terminate all managed child processes currently running.
   */
  cleanup(): Promise<void>;
}

export { BunProcessRunner, defaultProcessRunner } from "./BunProcessRunner";

