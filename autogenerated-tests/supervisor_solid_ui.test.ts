import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import path from "node:path";
import fs from "node:fs";

describe("Supervisor SolidJS + Ark UI + Tailwind CSS Bundle & Static Server", () => {
  const supervisorRoot = path.resolve("apps/ai-supervisor");
  const distUiDir = path.join(supervisorRoot, "dist", "ui");

  it("produces all compiled production UI assets in dist/ui", () => {
    expect(fs.existsSync(distUiDir)).toBe(true);

    const indexHtml = path.join(distUiDir, "index.html");
    const appJs = path.join(distUiDir, "app.js");
    const indexCss = path.join(distUiDir, "index.css");

    expect(fs.existsSync(indexHtml)).toBe(true);
    expect(fs.existsSync(appJs)).toBe(true);
    expect(fs.existsSync(indexCss)).toBe(true);

    const htmlContent = fs.readFileSync(indexHtml, "utf8");
    expect(htmlContent).toContain('<div id="root"></div>');
    expect(htmlContent).toContain('<script type="module" src="/app.js');
    expect(htmlContent).toContain('<link rel="stylesheet" href="/index.css');

    const jsSize = fs.statSync(appJs).size;
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
          const distFilePath = path.join(distUiDir, pathname.slice(1));

          if (fs.existsSync(distFilePath) && fs.statSync(distFilePath).isFile()) {
            const ext = path.extname(distFilePath);
            const mimeTypes: Record<string, string> = {
              ".html": "text/html; charset=utf-8",
              ".js": "application/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
            };
            return new Response(Bun.file(distFilePath), {
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

    it("serves app.js with JavaScript mime type", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/app.js`);
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
