import fs from "node:fs";
import path from "node:path";
import type { RouteHandler } from "./types.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".json": "application/json",
};

function getCandidateViewsDirs(): string[] {
  const dirs: string[] = [];

  // 1. Static dist output from supervisor-desktop (if built)
  const repoRoot = path.resolve(import.meta.dir, "..", "..", "..", "..", "..", "..");
  dirs.push(
    path.join(repoRoot, "apps", "supervisor-desktop", "dist"),
    path.join(repoRoot, "apps", "ai-supervisor", "dist")
  );

  return dirs;
}

export const handleStaticRoutes: RouteHandler = async (_req: Request, url: URL): Promise<Response | null> => {
  const candidateDirs = getCandidateViewsDirs();
  const supervisorAppRoot = path.resolve(import.meta.dir, "..", "..", "..", "..");
  const fallbackHtmlFile = path.resolve(supervisorAppRoot, "src", "views", "main", "index.html");

  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const targetPaths = candidateDirs.map((dir) => path.join(dir, pathname.slice(1)));

  const foundPath = targetPaths.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());

  if (foundPath) {
    const ext = path.extname(foundPath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    return new Response(Bun.file(foundPath), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
      },
    });
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    if (fs.existsSync(fallbackHtmlFile)) {
      return new Response(Bun.file(fallbackHtmlFile), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response("ACC Control Plane Dashboard UI loading...", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return null;
};
