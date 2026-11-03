import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import path from "node:path";
import fs from "node:fs";

describe("Supervisor SolidJS + Ark UI + Tailwind CSS Electrobun Views & Static Server", () => {
  const supervisorRoot = path.resolve("apps/ai-supervisor");
  const builtViewsDir = path.join(
    supervisorRoot,
    "build",
    "dev-win-x64",
    "ACCControlPlane-dev",
    "Resources",
    "app",
    "views",
    "main"
  );
  const srcViewsDir = path.join(supervisorRoot, "src", "views", "main");

  it("produces all compiled production UI assets in electrobun views directory", () => {
    expect(fs.existsSync(builtViewsDir)).toBe(true);

    const indexHtml = path.join(builtViewsDir, "index.html");
    const indexJs = path.join(builtViewsDir, "index.js");
    const indexCss = path.join(builtViewsDir, "index.css");

    expect(fs.existsSync(indexHtml)).toBe(true);
    expect(fs.existsSync(indexJs)).toBe(true);
    expect(fs.existsSync(indexCss)).toBe(true);

    const htmlContent = fs.readFileSync(indexHtml, "utf8");
    expect(htmlContent).toContain('<div id="root"></div>');
    expect(htmlContent).toContain('src="./index.js"');
    expect(htmlContent).toContain('href="./index.css"');

    const jsSize = fs.statSync(indexJs).size;
    expect(jsSize).toBeGreaterThan(10000); // Bundled SolidJS + Ark UI + Lucide

    const cssSize = fs.statSync(indexCss).size;
    expect(cssSize).toBeGreaterThan(1000); // Compiled Tailwind v4
  });

  describe("Embedded Static HTTP Server Route Verification", () => {
    let server: any;
    const testPort = 33339;

    beforeAll(() => {
      server = Bun.serve({
        port: testPort,
        fetch(req) {
          const url = new URL(req.url);
          const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
          const candidatePaths = [
            path.join(builtViewsDir, pathname.slice(1)),
            path.join(srcViewsDir, pathname.slice(1)),
          ];
          const foundPath = candidatePaths.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());

          if (foundPath) {
            const ext = path.extname(foundPath);
            const mimeTypes: Record<string, string> = {
              ".html": "text/html; charset=utf-8",
              ".js": "application/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
            };
            return new Response(Bun.file(foundPath), {
              headers: { "Content-Type": mimeTypes[ext] || "text/plain" },
            });
          }
          return new Response("Not Found", { status: 404 });
        },
      });
    });

    afterAll(() => {
      server.stop();
    });

    it("serves index.html with HTML mime type at root route", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const text = await res.text();
      expect(text).toContain('<div id="root"></div>');
    });

    it("serves index.js with JavaScript mime type", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/index.js`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("javascript");
      const text = await res.text();
      expect(text.length).toBeGreaterThan(5000);
    });

    it("serves index.css with CSS mime type", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/index.css`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/css");
      const text = await res.text();
      expect(text.length).toBeGreaterThan(500);
    });
  });
});
