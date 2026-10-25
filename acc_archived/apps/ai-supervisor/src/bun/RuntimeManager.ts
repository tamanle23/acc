import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn, which } from "bun";

export interface RuntimeManagerOptions {
  storageDir?: string;
}

export class RuntimeManager {
  private storageDir: string;
  private binDir: string;
  private uvBinaryPath: string;
  private pythonInstallDir: string;

  constructor(options?: RuntimeManagerOptions) {
    this.storageDir = options?.storageDir || path.join(os.homedir(), ".acc");
    this.binDir = path.join(this.storageDir, "bin");
    const exeName = process.platform === "win32" ? "uv.exe" : "uv";
    this.uvBinaryPath = path.join(this.binDir, exeName);
    this.pythonInstallDir = path.join(this.storageDir, "python-env");
  }

  public getStorageDir(): string {
    return this.storageDir;
  }

  public getBinDir(): string {
    return this.binDir;
  }

  public getUvBinaryPath(): string {
    return this.uvBinaryPath;
  }

  public getPythonInstallDir(): string {
    return this.pythonInstallDir;
  }

  /**
   * Returns true if uv exists in the isolated ~/.acc/bin/ directory.
   */
  public isUvIsolated(): boolean {
    return fs.existsSync(this.uvBinaryPath);
  }

  /**
   * Finds an existing uv binary from PATH or common system locations.
   */
  public findSystemUvBinary(): string | null {
    try {
      const resolved = which("uv");
      if (resolved && fs.existsSync(resolved)) return resolved;
    } catch {}

    const candidates = [
      path.join(os.homedir(), "AppData", "Local", "hermes", "bin", "uv.exe"),
      path.join(os.homedir(), "AppData", "Roaming", "uv", "bin", "uv.exe"),
      path.join(os.homedir(), ".cargo", "bin", "uv.exe"),
      path.join(os.homedir(), ".local", "bin", "uv"),
      "/usr/local/bin/uv",
      "/opt/homebrew/bin/uv",
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }

    return null;
  }

  /**
   * Returns the path to the uv binary to use:
   * isolated binary in ~/.acc/bin/ if present, otherwise system uv, or fallback "uv".
   */
  public getUvPath(): string {
    if (this.isUvIsolated()) {
      return this.uvBinaryPath;
    }
    const system = this.findSystemUvBinary();
    return system || "uv";
  }

  /**
   * Returns true if uv is available either isolated or on system.
   */
  public isUvAvailable(): boolean {
    return this.isUvIsolated() || this.findSystemUvBinary() !== null;
  }

  /**
   * Ensures the uv binary is provisioned inside ~/.acc/bin/.
   * First attempts copying from detected system binary.
   * If not found on system, attempts downloading release binary.
   */
  public async ensureUv(onProgress?: (msg: string) => void): Promise<string> {
    if (this.isUvIsolated()) {
      return this.uvBinaryPath;
    }

    fs.mkdirSync(this.binDir, { recursive: true });

    // Option 1: Fast copy from system UV
    const systemUv = this.findSystemUvBinary();
    if (systemUv) {
      onProgress?.(`Copying system uv from ${systemUv} to ${this.uvBinaryPath}...`);
      fs.copyFileSync(systemUv, this.uvBinaryPath);
      if (process.platform !== "win32") {
        try {
          fs.chmodSync(this.uvBinaryPath, 0o755);
        } catch {}
      }
      return this.uvBinaryPath;
    }

    // Option 2: Download release binary from Astral GitHub
    onProgress?.("Downloading standalone uv toolchain from Astral...");
    await this.downloadStandaloneUv(onProgress);
    return this.uvBinaryPath;
  }

  private async downloadStandaloneUv(onProgress?: (msg: string) => void): Promise<void> {
    const platform = process.platform;
    const arch = process.arch;

    let target = "";
    let isZip = false;

    if (platform === "win32" && arch === "x64") {
      target = "uv-x86_64-pc-windows-msvc.zip";
      isZip = true;
    } else if (platform === "linux" && arch === "x64") {
      target = "uv-x86_64-unknown-linux-gnu.tar.gz";
    } else if (platform === "linux" && arch === "arm64") {
      target = "uv-aarch64-unknown-linux-gnu.tar.gz";
    } else if (platform === "darwin" && arch === "arm64") {
      target = "uv-aarch64-apple-darwin.tar.gz";
    } else if (platform === "darwin" && arch === "x64") {
      target = "uv-x86_64-apple-darwin.tar.gz";
    } else {
      throw new Error(`Unsupported OS/arch for automated uv download: ${platform} ${arch}`);
    }

    const downloadUrl = `https://github.com/astral-sh/uv/releases/latest/download/${target}`;
    const archivePath = path.join(this.binDir, target);

    onProgress?.(`Fetching uv release from ${downloadUrl}...`);
    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      throw new Error(`Failed to download uv from ${downloadUrl}: ${resp.status} ${resp.statusText}`);
    }

    const buffer = await resp.arrayBuffer();
    await Bun.write(archivePath, buffer);

    onProgress?.(`Extracting ${archivePath} into ${this.binDir}...`);
    if (isZip) {
      // Use system tar on Windows (built-in Windows 10+ bsdtar handles .zip)
      const extractProc = spawn(["tar", "-xf", archivePath, "-C", this.binDir]);
      const exitCode = await extractProc.exited;
      if (exitCode !== 0) {
        throw new Error(`Failed to extract uv zip archive (code ${exitCode})`);
      }
    } else {
      const extractProc = spawn(["tar", "-xzf", archivePath, "-C", this.binDir]);
      const exitCode = await extractProc.exited;
      if (exitCode !== 0) {
        throw new Error(`Failed to extract uv tar.gz archive (code ${exitCode})`);
      }
    }

    // Clean up archive
    try {
      fs.unlinkSync(archivePath);
    } catch {}

    // Check if extracted into a subfolder or root
    if (!fs.existsSync(this.uvBinaryPath)) {
      const files = fs.readdirSync(this.binDir);
      for (const f of files) {
        const sub = path.join(this.binDir, f);
        if (fs.statSync(sub).isDirectory()) {
          const candidate = path.join(sub, process.platform === "win32" ? "uv.exe" : "uv");
          if (fs.existsSync(candidate)) {
            fs.copyFileSync(candidate, this.uvBinaryPath);
            break;
          }
        }
      }
    }

    if (process.platform !== "win32" && fs.existsSync(this.uvBinaryPath)) {
      try {
        fs.chmodSync(this.uvBinaryPath, 0o755);
      } catch {}
    }
  }

  /**
   * Checks whether the specified Python version (default 3.12) is installed in pythonInstallDir.
   */
  public isPythonInstalled(version = "3.12"): boolean {
    if (!fs.existsSync(this.pythonInstallDir)) {
      return false;
    }

    try {
      const entries = fs.readdirSync(this.pythonInstallDir);
      const prefix = `cpython-${version}`;
      return entries.some((entry) => entry.startsWith(prefix));
    } catch {
      return false;
    }
  }

  /**
   * Runs `uv python install <version> --install-dir <pythonInstallDir>`.
   */
  public async ensurePython(version = "3.12", onProgress?: (msg: string) => void): Promise<void> {
    if (this.isPythonInstalled(version)) {
      onProgress?.(`Isolated Python ${version} already installed in ${this.pythonInstallDir}`);
      return;
    }

    fs.mkdirSync(this.pythonInstallDir, { recursive: true });
    const uvBin = await this.ensureUv(onProgress);

    onProgress?.(`Installing isolated Python ${version} into ${this.pythonInstallDir}...`);

    const proc = spawn([uvBin, "python", "install", version, "--install-dir", this.pythonInstallDir], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        UV_PYTHON_INSTALL_DIR: this.pythonInstallDir,
      },
    });

    if (proc.stdout) {
      (async () => {
        const reader = proc.stdout.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value).trim();
          if (text) onProgress?.(`[uv install] ${text}`);
        }
      })();
    }

    if (proc.stderr) {
      (async () => {
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value).trim();
          if (text) onProgress?.(`[uv install] ${text}`);
        }
      })();
    }

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to install isolated Python ${version} (exit code ${exitCode})`);
    }

    onProgress?.(`Successfully installed isolated Python ${version}`);
  }

  /**
   * Returns true if both uv and isolated Python 3.12 are ready.
   */
  public isReady(): boolean {
    return this.isUvAvailable() && this.isPythonInstalled("3.12");
  }

  /**
   * Complete provisioning pipeline: ensures uv and Python 3.12 runtime.
   */
  public async ensureRuntime(onProgress?: (msg: string) => void): Promise<boolean> {
    await this.ensureUv(onProgress);
    await this.ensurePython("3.12", onProgress);
    return true;
  }

  /**
   * Returns the execution environment variables ensuring complete version isolation.
   */
  public getExecutionEnv(): Record<string, string> {
    const delimiter = path.delimiter;
    const currentPath = process.env.PATH || "";
    const newPath = this.binDir + delimiter + currentPath;

    return {
      ...process.env,
      PATH: newPath,
      UV_PYTHON_INSTALL_DIR: this.pythonInstallDir,
      UV_PYTHON: "3.12",
      PYTHONUNBUFFERED: "1",
    };
  }
}

export const runtimeManager = new RuntimeManager();
