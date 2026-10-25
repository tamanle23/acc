import { spawn } from "bun";
import path from "node:path";

const appRoot = path.resolve(import.meta.dir, "..");

console.log("====================================================");
console.log("       ACC AI-Supervisor Development Workspace       ");
console.log("====================================================");

// 1. First ensure an initial UI build is produced
console.log("[dev-runner] Running initial UI build...");
const initBuild = spawn(["bun", "run", "scripts/build-ui.ts"], {
  cwd: appRoot,
  stdout: "inherit",
  stderr: "inherit",
});
await initBuild.exited;

// 2. Spawn UI watcher process (recompiles on src/ui changes)
const uiWatch = spawn(["bun", "run", "scripts/build-ui.ts", "--watch"], {
  cwd: appRoot,
  stdout: "inherit",
  stderr: "inherit",
});

// 3. Spawn Supervisor backend process with --watch
const appProc = spawn(["bun", "--watch", "run", "src/bun/index.ts"], {
  cwd: appRoot,
  stdout: "inherit",
  stderr: "inherit",
});

const cleanup = () => {
  console.log("\n[dev-runner] Stopping all dev processes...");
  try {
    uiWatch.kill();
    appProc.kill();
  } catch {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

await Promise.race([uiWatch.exited, appProc.exited]);
