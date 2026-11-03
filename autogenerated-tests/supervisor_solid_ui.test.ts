import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import path from "node:path";
import fs from "node:fs";

describe("Supervisor Desktop SolidJS + Ark UI + Tailwind CSS Vite & Tauri Architecture", () => {
  const desktopRoot = path.resolve("apps/supervisor-desktop");
  const distDir = path.join(desktopRoot, "dist");
  const tauriDir = path.join(desktopRoot, "src-tauri");

  it("produces all compiled production UI assets in dist directory", () => {
    expect(fs.existsSync(distDir)).toBe(true);

    const indexHtml = path.join(distDir, "index.html");
    expect(fs.existsSync(indexHtml)).toBe(true);

    const htmlContent = fs.readFileSync(indexHtml, "utf8");
    expect(htmlContent).toContain('<div id="root"');

    // Check assets directory
    const assetsDir = path.join(distDir, "assets");
    expect(fs.existsSync(assetsDir)).toBe(true);

    const files = fs.readdirSync(assetsDir);
    const jsFile = files.find((f) => f.endsWith(".js"));
    const cssFile = files.find((f) => f.endsWith(".css"));

    expect(jsFile).toBeDefined();
    expect(cssFile).toBeDefined();

    const jsSize = fs.statSync(path.join(assetsDir, jsFile!)).size;
    expect(jsSize).toBeGreaterThan(50000); // Bundled SolidJS + Ark UI + Lucide

    const cssSize = fs.statSync(path.join(assetsDir, cssFile!)).size;
    expect(cssSize).toBeGreaterThan(1000); // Compiled Tailwind CSS
  });

  it("contains valid Tauri 2.x configuration and icons", () => {
    const tauriConf = path.join(tauriDir, "tauri.conf.json");
    expect(fs.existsSync(tauriConf)).toBe(true);

    const confContent = JSON.parse(fs.readFileSync(tauriConf, "utf8"));
    expect(confContent.productName).toBe("ACC Control Plane");
    expect(confContent.identifier).toBe("com.acc.supervisor-desktop");
    expect(confContent.build.frontendDist).toBe("../dist");

    // Check tray icons
    const iconsDir = path.join(tauriDir, "icons");
    expect(fs.existsSync(path.join(iconsDir, "icon.ico"))).toBe(true);
    expect(fs.existsSync(path.join(iconsDir, "tray-green.ico"))).toBe(true);
    expect(fs.existsSync(path.join(iconsDir, "tray-yellow.ico"))).toBe(true);
    expect(fs.existsSync(path.join(iconsDir, "tray-red.ico"))).toBe(true);
  });

  it("contains compiled native Windows desktop host binary", () => {
    const releaseExe = path.join(tauriDir, "target", "release", "acc-supervisor-desktop.exe");
    expect(fs.existsSync(releaseExe)).toBe(true);
    const exeSize = fs.statSync(releaseExe).size;
    expect(exeSize).toBeGreaterThan(5 * 1024 * 1024); // Solid native binary (~11MB)
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
          const targetPath = path.join(distDir, pathname.slice(1));

          if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
            const ext = path.extname(targetPath);
            const mimeTypes: Record<string, string> = {
              ".html": "text/html; charset=utf-8",
              ".js": "application/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
            };
            return new Response(Bun.file(targetPath), {
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
      expect(text).toContain('<div id="root"');
    });
  });
});
