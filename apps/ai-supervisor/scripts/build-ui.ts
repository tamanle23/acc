import { spawn } from "bun";
import type { BunPlugin } from "bun";
import path from "node:path";
import fs from "node:fs";
import { transformSync } from "@babel/core";
// @ts-ignore
import solidPreset from "babel-preset-solid";
// @ts-ignore
import babelTs from "@babel/preset-typescript";

const appRoot = path.resolve(import.meta.dir, "..");
const srcUiDir = path.join(appRoot, "src", "ui");
const distUiDir = path.join(appRoot, "dist", "ui");

// SolidJS JSX + TypeScript transpilation plugin for Bun.build
const solidPlugin: BunPlugin = {
  name: "solid-jsx",
  setup(build) {
    build.onLoad({ filter: /\.(tsx|jsx)$/ }, async (args) => {
      const source = await Bun.file(args.path).text();
      const result = transformSync(source, {
        presets: [
          [solidPreset, { generate: "dom", hydratable: false }],
          [babelTs, {}],
        ],
        parserOpts: {
          plugins: ["jsx", "typescript"],
        },
        filename: args.path,
      });

      return {
        contents: result?.code ?? "",
        loader: "js",
      };
    });
  },
};

async function buildUI() {
  const start = performance.now();
  console.log("[build-ui] Building SolidJS + Ark UI + Tailwind CSS dashboard...");

  if (!fs.existsSync(distUiDir)) {
    fs.mkdirSync(distUiDir, { recursive: true });
  }

  // 1. Bundle JavaScript in-memory via Bun.build with local Solid plugin
  const buildResult = await Bun.build({
    entrypoints: [path.join(srcUiDir, "index.tsx")],
    minify: true,
    target: "browser",
    plugins: [solidPlugin],
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
    },
  });

  if (!buildResult.success) {
    console.error("[build-ui] Bun.build failed:");
    for (const log of buildResult.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // Write bundled app.js from the primary entrypoint output
  const primaryOutput = buildResult.outputs.find(
    (o) => o.kind === "entry-point" || o.path.endsWith(".js")
  );

  if (!primaryOutput) {
    console.error("[build-ui] Failed to find JavaScript output in Bun.build");
    process.exit(1);
  }

  const jsText = await primaryOutput.text();
  fs.writeFileSync(path.join(distUiDir, "app.js"), jsText, "utf8");

  // 2. Compile Tailwind CSS v4 via @tailwindcss/cli
  const inputCss = path.join(srcUiDir, "index.css");
  const outputCss = path.join(distUiDir, "index.css");
  const tailwindProc = spawn(
    ["bunx", "@tailwindcss/cli", "-i", inputCss, "-o", outputCss, "--minify"],
    {
      cwd: appRoot,
      stdout: "ignore",
      stderr: "pipe",
    }
  );

  const tailwindExit = await tailwindProc.exited;
  if (tailwindExit !== 0) {
    const errText = await new Response(tailwindProc.stderr).text();
    console.error("[build-ui] Tailwind CSS compilation failed:", errText);
    process.exit(1);
  }

  // 3. Generate HTML shell embedding compiled bundle with content-hash cache-busting
  const buildHash = Date.now().toString(36);
  const htmlContent = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <title>ACC Control Plane</title>
  <link rel="stylesheet" href="/index.css?v=${buildHash}" />
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-cyan-500 selection:text-white">
  <div id="root"></div>
  <script type="module" src="/app.js?v=${buildHash}"></script>
</body>
</html>
`;

  fs.writeFileSync(path.join(distUiDir, "index.html"), htmlContent, "utf8");

  const elapsed = Math.round(performance.now() - start);
  console.log(`[build-ui] Build completed successfully in ${elapsed}ms -> ${distUiDir}`);
}

if (import.meta.main) {
  const isWatch = process.argv.includes("--watch");
  if (isWatch) {
    console.log("[build-ui] Starting in watch mode...");
    await buildUI();
    fs.watch(srcUiDir, { recursive: true }, async (_event, filename) => {
      if (filename) {
        console.log(`[build-ui] File changed: ${filename}, rebuilding...`);
        try {
          await buildUI();
        } catch (err) {
          console.error("[build-ui] Rebuild error:", err);
        }
      }
    });
  } else {
    await buildUI();
  }
}

export { buildUI, solidPlugin };
