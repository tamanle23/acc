#!/usr/bin/env node
/**
 * Cross-Platform Python Backend Launcher (`run-backend.mjs`)
 *
 * Eliminates the Windows error:
 *   `error: uv trampoline failed to canonicalize script path`
 *
 * Why that error happens on Windows:
 *   1. `.venv\Scripts\uvicorn.exe` (and `pytest.exe`, `ruff.exe`, `mypy.exe`) are Windows PE
 *      trampoline wrappers that hardcode the absolute path to `python.exe` from when `.venv`
 *      was created. Moving/renaming the project folder or invoking the trampoline under certain
 *      Windows shells causes `uv-trampoline` to fail path canonicalization.
 *   2. If `uv.exe` itself was installed via `pip install uv` inside a relocated Python folder,
 *      calling `uv` also triggers the broken trampoline.
 *
 * Solution:
 *   - Always invoke `python -m <module>` (`python -m uvicorn`, `python -m unittest`, etc.)
 *     using the resolved `python.exe` / `python3` binary directly — bypassing all `.venv\Scripts\*.exe`
 *     PE trampolines!
 *   - Automatically inject `PYTHONPATH=<app_root>/src` so `inference_backend` is always importable.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "../..");
const srcDir = path.join(appRoot, "src");

const isWin = process.platform === "win32";

function canExecutePython(pythonBin) {
  if (!pythonBin) return false;
  try {
    const res = spawnSync(pythonBin, ["-c", "import sys; print(sys.executable)"], {
      cwd: appRoot,
      stdio: "pipe",
      timeout: 5000,
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

function canExecuteModule(pythonBin, moduleName) {
  try {
    const res = spawnSync(pythonBin, ["-c", `import ${moduleName}`], {
      cwd: appRoot,
      stdio: "pipe",
      timeout: 5000,
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

function findBestPython(requiredModule = "uvicorn") {
  const venvCandidates = isWin
    ? [
      path.join(appRoot, ".venv", "Scripts", "python.exe"),
      path.join(repoRoot, ".venv", "Scripts", "python.exe"),
    ]
    : [
      path.join(appRoot, ".venv", "bin", "python"),
      path.join(repoRoot, ".venv", "bin", "python"),
    ];

  for (const candidate of venvCandidates) {
    if (fs.existsSync(candidate) && canExecutePython(candidate)) {
      if (!requiredModule || canExecuteModule(candidate, requiredModule)) {
        return candidate;
      }
    }
  }

  // Try provisioning/syncing via uv if a working uv binary exists
  for (const uvCmd of isWin ? ["uv.exe", "uv"] : ["uv"]) {
    try {
      const uvCheck = spawnSync(uvCmd, ["--version"], { cwd: appRoot, stdio: "pipe", timeout: 5000 });
      if (uvCheck.status === 0) {
        console.log(`[ai-control-plane] Syncing Python virtual environment via ${uvCmd}...`);
        spawnSync(uvCmd, ["sync"], { cwd: appRoot, stdio: "inherit", timeout: 180000 });
        for (const candidate of venvCandidates) {
          if (fs.existsSync(candidate) && canExecutePython(candidate)) {
            return candidate;
          }
        }
      }
    } catch {
      // Ignore broken uv trampoline and fall back to system Python
    }
  }

  // Fall back to system Python interpreter
  const sysCandidates = isWin ? ["python", "python3", "py"] : ["python3", "python"];
  for (const sysBin of sysCandidates) {
    if (canExecutePython(sysBin)) {
      return sysBin;
    }
  }

  return isWin ? "python" : "python3";
}

function releasePortIfOccupied(port) {
  if (isWin) {
    try {
      const res = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`,
        ],
        { stdio: "pipe", timeout: 4000 }
      );
      const pidStr = res.stdout?.toString().trim();
      const pid = Number(pidStr);
      if (pid && !isNaN(pid) && pid > 0 && pid !== process.pid) {
        // Inspect process name and binary path to ensure safety
        const procNameRes = spawnSync(
          "powershell",
          ["-NoProfile", "-Command", `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName`],
          { stdio: "pipe", timeout: 4000 }
        );
        const procPathRes = spawnSync(
          "powershell",
          ["-NoProfile", "-Command", `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path`],
          { stdio: "pipe", timeout: 4000 }
        );
        const procName = procNameRes.stdout?.toString().trim() || "unknown";
        const procPath = procPathRes.stdout?.toString().trim() || "";

        const isPython = procName.toLowerCase().includes("python");
        const isFromOurVenv =
          procPath.toLowerCase().includes("ai-inference") ||
          procPath.toLowerCase().includes(".venv") ||
          procPath.toLowerCase().includes("uv\\python") ||
          procPath.toLowerCase().includes("uv/python");

        if (isPython && isFromOurVenv) {
          console.log(
            `[ai-control-plane] Port ${port} is held by orphaned project backend (PID: ${pid}, ${procName}). Releasing...`
          );
          spawnSync(
            "powershell",
            ["-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`],
            { stdio: "pipe", timeout: 4000 }
          );
          // Brief pause to allow Windows TCP socket teardown
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
          console.log(`[ai-control-plane] Port ${port} is now free.`);
        } else {
          console.error(
            `\n[ai-control-plane] ERROR: Port ${port} is already claimed by another application!`
          );
          console.error(`  Application : ${procName} (PID: ${pid})`);
          if (procPath) {
            console.error(`  Binary Path : ${procPath}`);
          }
          console.error(
            `\nSafety Guard: Refusing to kill an external or unrelated process.`
          );
          console.error(
            `Please either stop that application or run the backend on an alternate port:`
          );
          console.error(`  PORT=8001 node scripts/run-backend.mjs dev\n`);
          process.exit(1);
        }
      }
    } catch {
      // Ignore query errors and allow uvicorn to attempt binding
    }
  } else {
    try {
      const res = spawnSync("lsof", ["-ti", `:${port}`], { stdio: "pipe", timeout: 2000 });
      const pids = res.stdout?.toString().trim().split(/\s+/).filter(Boolean);
      for (const p of pids || []) {
        const pidNum = Number(p);
        if (pidNum && pidNum !== process.pid) {
          const cmdRes = spawnSync(
            "ps",
            ["-p", String(pidNum), "-o", "command="],
            { stdio: "pipe", timeout: 2000 }
          );
          const cmdLine = cmdRes.stdout?.toString() || "";
          if (cmdLine.includes("inference_backend") || cmdLine.includes("uvicorn")) {
            console.log(
              `[ai-control-plane] Port ${port} held by orphaned backend PID ${pidNum}. Releasing...`
            );
            spawnSync("kill", ["-9", String(pidNum)], { timeout: 2000 });
          } else {
            console.error(
              `[ai-control-plane] ERROR: Port ${port} is claimed by unrelated process PID ${pidNum} (${cmdLine.slice(0, 60)}). Refusing to kill.`
            );
            process.exit(1);
          }
        }
      }
    } catch { }
  }
}

const mode = process.argv[2] || "dev";
const extraArgs = process.argv.slice(3);

const env = {
  ...process.env,
  PYTHONPATH: [srcDir, process.env.PYTHONPATH].filter(Boolean).join(isWin ? ";" : ":"),
  PYTHONUTF8: "1",
};

let targetModule = "uvicorn";
let moduleArgs = [];

if (mode === "dev") {
  targetModule = "uvicorn";
  const portIndex = extraArgs.indexOf("--port");
  const targetPort = portIndex !== -1 && extraArgs[portIndex + 1] ? Number(extraArgs[portIndex + 1]) : Number(process.env.PORT || 8000);
  releasePortIfOccupied(targetPort);

  moduleArgs = [
    "-m",
    "uvicorn",
    "api.main:app",
    "--host",
    process.env.HOST || "0.0.0.0",
    "--port",
    String(targetPort),
    "--reload",
    "--reload-dir",
    "src",
    ...extraArgs.filter((_, idx) => idx !== portIndex && idx !== portIndex + 1),
  ];
}  else if (mode === "test") {
  targetModule = "unittest";
  moduleArgs = ["-m", "unittest", "discover", "-s", "tests", "-v", ...extraArgs];
} else if (mode === "lint") {
  targetModule = "ruff";
  moduleArgs = ["-m", "ruff", "check", "src", "tests", ...extraArgs];
} else if (mode === "typecheck") {
  targetModule = "mypy";
  moduleArgs = ["-m", "mypy", "src", ...extraArgs];
} else if (mode === "provision-gpu") {
  targetModule = "";
  moduleArgs = ["-m", "infrastructure.uv_manager", "--gpu", ...extraArgs];
} else {
  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

const pythonExe = findBestPython(targetModule);
console.log(`[ai-control-plane] Launching via direct Python module runner (bypassing Windows .exe trampoline):`);
console.log(`  Interpreter : ${pythonExe}`);
console.log(`  Command     : ${pythonExe} ${moduleArgs.join(" ")}`);
console.log(`  PYTHONPATH  : ${env.PYTHONPATH}`);

const child = spawn(pythonExe, moduleArgs, {
  cwd: appRoot,
  env,
  stdio: ["ignore", "inherit", "inherit"],
});

child.on("error", (err) => {
  console.error(`[ai-control-plane] Failed to start backend child process:`, err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.log(`[ai-control-plane] Backend child process terminated by signal: ${signal}`);
  }
  process.exit(code ?? 0);
});
