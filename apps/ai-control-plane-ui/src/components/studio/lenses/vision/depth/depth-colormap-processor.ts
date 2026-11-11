import { deterministicHashBytes } from "../../lens-utils";

/**
 * High-accuracy color mapping functions for Scientific & VFX Depth Palettes.
 */
export function turboRgb(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  // 4th-order polynomial approximation of Google Turbo Colormap
  const r = Math.round(
    255 *
      Math.max(
        0,
        Math.min(
          1,
          0.1357 +
            t * (4.5974 - t * (42.3277 - t * (130.5887 - t * (150.5667 - t * 58.1375))))
        )
      )
  );
  const g = Math.round(
    255 *
      Math.max(
        0,
        Math.min(
          1,
          0.0914 +
            t * (2.1856 + t * (4.8052 - t * (14.0195 - t * (4.2109 - t * 2.7747))))
        )
      )
  );
  const b = Math.round(
    255 *
      Math.max(
        0,
        Math.min(
          1,
          0.1067 +
            t * (12.583 - t * (85.2285 - t * (205.1052 - t * (197.6402 - t * 65.4199))))
        )
      )
  );
  return [r, g, b];
}

export function magmaRgb(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const r = Math.round(255 * Math.max(0, Math.min(1, Math.pow(t, 0.75) * 1.05)));
  const g = Math.round(255 * Math.max(0, Math.min(1, Math.pow(t, 2.0) * 0.95)));
  const b = Math.round(
    255 *
      Math.max(
        0,
        Math.min(1, Math.sin(t * Math.PI) * 0.65 + (t > 0.8 ? (t - 0.8) * 5 * 0.95 : 0.05))
      )
  );
  return [r, g, b];
}

export function viridisRgb(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const r = Math.round(
    255 *
      Math.max(
        0,
        Math.min(1, 0.267 + t * (-0.334 + t * (2.052 - t * (1.895 - t * 0.91))))
      )
  );
  const g = Math.round(
    255 *
      Math.max(
        0,
        Math.min(1, 0.004 + t * (0.835 + t * (0.578 - t * (1.139 - t * 0.722))))
      )
  );
  const b = Math.round(
    255 *
      Math.max(
        0,
        Math.min(1, 0.329 + t * (0.871 - t * (1.464 + t * (0.836 - t * 0.472))))
      )
  );
  return [r, g, b];
}

export function grayscaleRgb(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const v = Math.round(255 * t);
  return [v, v, v];
}

export function sampleColormapRgb(
  t: number,
  colormapName: string
): [number, number, number] {
  const norm = Math.max(0, Math.min(1, t));
  const name = (colormapName || "turbo").toLowerCase();
  if (name === "magma") return magmaRgb(norm);
  if (name === "viridis") return viridisRgb(norm);
  if (name === "grayscale") return grayscaleRgb(norm);
  return turboRgb(norm);
}

/**
 * Creates a deterministic procedural depth intensity map (Float32Array [0..1])
 * for sample scenes when the backend has not yet been executed.
 */
export function createProceduralDepthField(
  width: number,
  height: number,
  label: string
): Float32Array {
  const data = new Float32Array(width * height);
  const hash = deterministicHashBytes(label || "datacenter_rack_thermal");
  const seed = (hash[0] * 7 + hash[1]) % 100;

  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const idx = y * width + x;

      // Perspective room depth: floor and walls slope away (closer at bottom, farther at top)
      let z = 0.15 + ny * 0.78;

      // Center subject (e.g. server rack blade or portrait subject in foreground)
      const dx = Math.abs(nx - 0.5);
      const dy = Math.abs(ny - 0.55);
      if (dx < 0.28 && dy < 0.38) {
        // Foreground object stands forward (smaller distance Z = 0.22)
        const edgeFactor = Math.cos(dx * Math.PI * 1.6) * Math.cos(dy * Math.PI * 1.2);
        z = Math.max(0.12, z - 0.48 * Math.max(0, edgeFactor));
      }

      // Add architectural structural details
      const structuralRibs = Math.sin(nx * 32.0 + seed * 0.05) * 0.04;
      const horizontalSlots = Math.sin(ny * 48.0) * 0.02;
      z += structuralRibs + horizontalSlots;

      data[idx] = Math.max(0.05, Math.min(0.98, z));
    }
  }

  return data;
}

/**
 * Recolorizes a depth image or Float32 depth array into a live colorized PNG Data URI,
 * strictly respecting nearClip, farClip, and colormap.
 */
export function renderProcessedDepthDataUri(
  source: HTMLImageElement | Float32Array,
  width: number,
  height: number,
  nearClip: number,
  farClip: number,
  colormap: string
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";

  const imgData = ctx.createImageData(width, height);
  const pixels = imgData.data;
  const clipRange = Math.max(0.01, farClip - nearClip);

  if (source instanceof Float32Array) {
    for (let i = 0; i < source.length; i++) {
      const rawZ = source[i];
      // Normalize between nearClip and farClip
      const normalized = Math.max(0, Math.min(1, (rawZ - nearClip) / clipRange));
      const [r, g, b] = sampleColormapRgb(normalized, colormap);

      const pxIdx = i * 4;
      pixels[pxIdx] = r;
      pixels[pxIdx + 1] = g;
      pixels[pxIdx + 2] = b;
      pixels[pxIdx + 3] = 255;
    }
  } else {
    // Source is an existing HTMLImageElement
    ctx.drawImage(source, 0, 0, width, height);
    const rawPixels = ctx.getImageData(0, 0, width, height).data;

    for (let i = 0; i < rawPixels.length; i += 4) {
      // Extract brightness/intensity as depth proxy
      const rawZ =
        (rawPixels[i] * 0.299 + rawPixels[i + 1] * 0.587 + rawPixels[i + 2] * 0.114) / 255.0;
      const normalized = Math.max(0, Math.min(1, (rawZ - nearClip) / clipRange));
      const [r, g, b] = sampleColormapRgb(normalized, colormap);

      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Creates a clean procedural RGB source image matching the sample scene
 * when the user has not uploaded a binary file.
 */
export function createProceduralSourceDataUri(
  width: number,
  height: number,
  label: string
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Datacenter / studio atmosphere gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#090d16");
  grad.addColorStop(0.5, "#131b2e");
  grad.addColorStop(1, "#0a0e1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Perspective server rack / subject
  ctx.fillStyle = "#1e293b";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  const rw = width * 0.54;
  const rh = height * 0.76;
  const rx = (width - rw) / 2;
  const ry = (height - rh) / 2;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeRect(rx, ry, rw, rh);

  // Rack server slots with green/cyan LED indicators
  const slotCount = 10;
  const slotH = rh / slotCount;
  for (let s = 0; s < slotCount; s++) {
    const sy = ry + s * slotH;
    ctx.fillStyle = s % 2 === 0 ? "#0f172a" : "#1a2438";
    ctx.fillRect(rx + 8, sy + 3, rw - 16, slotH - 6);

    // Status LED
    ctx.fillStyle = s === 3 ? "#ef4444" : s === 7 ? "#f59e0b" : "#10b981";
    ctx.beginPath();
    ctx.arc(rx + 22, sy + slotH / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Rack unit label
    ctx.fillStyle = "#64748b";
    ctx.font = "9px monospace";
    ctx.fillText(`U${slotCount - s} // NVLink Blade`, rx + 36, sy + slotH / 2 + 3);
  }

  // Scene label HUD
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px monospace";
  ctx.fillText(label || "Datacenter GPU Server Rack", 16, 24);

  return canvas.toDataURL("image/png");
}
