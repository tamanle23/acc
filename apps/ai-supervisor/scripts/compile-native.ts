import { spawn } from "bun";
import path from "node:path";
import fs from "node:fs";

const appRoot = path.resolve(import.meta.dir, "..");
const assetsDir = path.join(appRoot, "src", "assets");
const binDir = path.join(assetsDir, "bin");

console.log("====================================================");
console.log("      ACC AI-Supervisor Native Binaries Compiler    ");
console.log("====================================================");

if (process.platform !== "darwin") {
  console.log(`[compile-native] Target platform is ${process.platform}. macOS Swift compilation skipped.`);
  process.exit(0);
}

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

async function compileUniversal(sourceName: string, outputBinaryName: string) {
  const sourcePath = path.join(assetsDir, sourceName);
  const outPath = path.join(binDir, outputBinaryName);

  if (!fs.existsSync(sourcePath)) {
    console.error(`[compile-native] Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const tmpArm64 = `/tmp/${outputBinaryName}_arm64`;
  const tmpX86 = `/tmp/${outputBinaryName}_x86_64`;

  console.log(`[compile-native] Compiling Universal binary: ${outputBinaryName}...`);

  // 1. Compile arm64 (Apple Silicon)
  const arm64Proc = spawn(
    ["swiftc", sourcePath, "-target", "arm64-apple-macos11.0", "-O", "-suppress-warnings", "-o", tmpArm64],
    { stdout: "inherit", stderr: "inherit" }
  );
  if ((await arm64Proc.exited) !== 0) {
    console.error(`[compile-native] Failed to compile arm64 target for ${sourceName}`);
    process.exit(1);
  }

  // 2. Compile x86_64 (Intel Mac)
  const x86Proc = spawn(
    ["swiftc", sourcePath, "-target", "x86_64-apple-macos11.0", "-O", "-suppress-warnings", "-o", tmpX86],
    { stdout: "inherit", stderr: "inherit" }
  );
  if ((await x86Proc.exited) !== 0) {
    console.error(`[compile-native] Failed to compile x86_64 target for ${sourceName}`);
    process.exit(1);
  }

  // 3. Create Universal Fat Binary via lipo
  const lipoProc = spawn(
    ["lipo", "-create", "-output", outPath, tmpArm64, tmpX86],
    { stdout: "inherit", stderr: "inherit" }
  );
  if ((await lipoProc.exited) !== 0) {
    console.error(`[compile-native] lipo packaging failed for ${outputBinaryName}`);
    process.exit(1);
  }

  // Cleanup temporary single-arch artifacts
  try {
    fs.unlinkSync(tmpArm64);
    fs.unlinkSync(tmpX86);
  } catch {}

  fs.chmodSync(outPath, 0o755);
  console.log(`[compile-native] Successfully generated universal binary: ${outPath}`);
}

await compileUniversal("tray_runner_mac.swift", "tray_runner_mac");
await compileUniversal("webview_host_mac.swift", "webview_host_mac");

console.log("[compile-native] All native platform binaries are up to date.");
