import { onMount, onCleanup, createSignal, createEffect } from "solid-js";

export interface Depth3DReliefCanvasProps {
  depthMapUri: string;
  textureUri?: string;
  displacementScale?: number;
  wireframe?: boolean;
  nearClip?: number;
  farClip?: number;
  colormap?: string;
  textureMode?: "depth_colormap" | "rgb_texture";
  class?: string;
}

export function Depth3DReliefCanvas(props: Depth3DReliefCanvasProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let animId: number = 0;

  // Camera Orbit State
  const [pitch, setPitch] = createSignal<number>(25); // degrees
  const [yaw, setYaw] = createSignal<number>(-35); // degrees
  const [distance, setDistance] = createSignal<number>(2.4);
  const [pan, setPan] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isDragging, setIsDragging] = createSignal<boolean>(false);
  const [dragButton, setDragButton] = createSignal<number>(0);
  const [lastMouse, setLastMouse] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });

  onMount(() => {
    if (!canvasRef) return;
    const canvas = canvasRef;

    // 1. Initialize WebGL Context (prefer webgl2, fallback to webgl)
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl", { preserveDrawingBuffer: false, antialias: true })) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;

    if (!gl) {
      console.warn("WebGL is not supported on this device/browser.");
      return;
    }

    // 2. Vertex Shader (with Z displacement and near/far clipping)
    const vsSource = `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      uniform mat4 uMVP;
      uniform sampler2D uDepthMap;
      uniform float uDisplacement;
      uniform float uNearClip;
      uniform float uFarClip;
      varying vec2 vTexCoord;
      varying float vClippedDepth;

      void main(void) {
        vTexCoord = aTexCoord;
        // Sample R channel of depth map (normalized [0..1])
        float rawDepth = texture2D(uDepthMap, aTexCoord).r;
        float clipped = clamp((rawDepth - uNearClip) / max(0.01, uFarClip - uNearClip), 0.0, 1.0);
        vClippedDepth = clipped;
        // Invert depth so closer objects (high depth) extrude upwards towards viewer
        vec3 displaced = aPosition + vec3(0.0, 0.0, (1.0 - clipped) * uDisplacement);
        gl_Position = uMVP * vec4(displaced, 1.0);
      }
    `;

    // 3. Fragment Shader with Scientific Colormaps (Turbo, Magma, Viridis, Grayscale)
    const fsSource = `
      precision mediump float;
      uniform sampler2D uTexture;
      uniform bool uUseTexture;
      uniform vec4 uSolidColor;
      uniform int uColormap;
      varying vec2 vTexCoord;
      varying float vClippedDepth;

      vec3 getColormap(float t, int mode) {
        t = clamp(t, 0.0, 1.0);
        if (mode == 3) {
          // Grayscale
          return vec3(t);
        }
        if (mode == 1) {
          // Magma
          float r = clamp(0.12 + t * 0.88, 0.0, 1.0);
          float g = clamp(pow(t, 2.0) * 0.95, 0.0, 1.0);
          float b = clamp(sin(t * 3.14159) * 0.65 + (t > 0.8 ? (t - 0.8) * 4.5 : 0.05), 0.0, 1.0);
          return vec3(r, g, b);
        }
        if (mode == 2) {
          // Viridis
          float r = clamp(0.27 + t * 0.71, 0.0, 1.0);
          float g = clamp(0.01 + t * 0.95, 0.0, 1.0);
          float b = clamp(0.33 + (1.0 - t) * 0.62, 0.0, 1.0);
          return vec3(r, g, b);
        }
        // Turbo (mode 0 - Polynomial approximation)
        float r = clamp(0.14 + t * 4.6 - t * t * 42.0 + t * t * t * 130.0 - t * t * t * t * 150.0 + t * t * t * t * t * 58.0, 0.0, 1.0);
        float g = clamp(0.09 + t * 2.2 + t * t * 4.8 - t * t * t * 14.0 - t * t * t * t * 4.2 - t * t * t * t * t * 2.8, 0.0, 1.0);
        float b = clamp(0.11 + t * 12.6 - t * t * 85.0 - t * t * t * 205.0 - t * t * t * t * 197.0 - t * t * t * t * t * 65.0, 0.0, 1.0);
        return vec3(r, g, b);
      }

      void main(void) {
        if (uUseTexture) {
          vec4 col = texture2D(uTexture, vTexCoord);
          gl_FragColor = col;
        } else {
          if (uColormap >= 0) {
            vec3 c = getColormap(vClippedDepth, uColormap);
            gl_FragColor = vec4(c, 1.0);
          } else {
            gl_FragColor = uSolidColor;
          }
        }
      }
    `;

    const compileShader = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    // Attributes & Uniforms
    const aPosition = gl.getAttribLocation(program, "aPosition");
    const aTexCoord = gl.getAttribLocation(program, "aTexCoord");
    const uMVP = gl.getUniformLocation(program, "uMVP");
    const uDepthMap = gl.getUniformLocation(program, "uDepthMap");
    const uTexture = gl.getUniformLocation(program, "uTexture");
    const uDisplacement = gl.getUniformLocation(program, "uDisplacement");
    const uNearClip = gl.getUniformLocation(program, "uNearClip");
    const uFarClip = gl.getUniformLocation(program, "uFarClip");
    const uColormap = gl.getUniformLocation(program, "uColormap");
    const uUseTexture = gl.getUniformLocation(program, "uUseTexture");
    const uSolidColor = gl.getUniformLocation(program, "uSolidColor");

    // 4. Generate Plane Mesh Grid (80x80 divisions = 12,800 triangles)
    const GRID_SIZE = 80;
    const positions: number[] = [];
    const texCoords: number[] = [];
    const triangleIndices: number[] = [];
    const wireframeIndices: number[] = [];

    for (let y = 0; y <= GRID_SIZE; y++) {
      for (let x = 0; x <= GRID_SIZE; x++) {
        const u = x / GRID_SIZE;
        const v = y / GRID_SIZE;
        // Plane centered at origin in XY [-0.9, 0.9]
        positions.push((u - 0.5) * 1.8, (0.5 - v) * 1.8, 0.0);
        texCoords.push(u, v);
      }
    }

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const i0 = y * (GRID_SIZE + 1) + x;
        const i1 = i0 + 1;
        const i2 = (y + 1) * (GRID_SIZE + 1) + x;
        const i3 = i2 + 1;

        // Triangles
        triangleIndices.push(i0, i2, i1);
        triangleIndices.push(i1, i2, i3);

        // Wireframe lines
        wireframeIndices.push(i0, i1);
        wireframeIndices.push(i0, i2);
      }
    }

    // VBOs
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

    const triIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangleIndices), gl.STATIC_DRAW);

    const wireIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(wireframeIndices), gl.STATIC_DRAW);

    // 5. Textures Setup
    const depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));

    const colorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, colorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([56, 189, 248, 255]));

    // Load Image into WebGL Texture
    const updateTextureFromUri = (tex: WebGLTexture | null, uri: string) => {
      if (!tex || !uri) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = uri;
      img.onload = () => {
        if (!gl) return;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      };
    };

    createEffect(() => {
      updateTextureFromUri(depthTexture, props.depthMapUri);
    });

    createEffect(() => {
      updateTextureFromUri(colorTexture, props.textureUri || props.depthMapUri);
    });

    // 6. Matrix Math Helpers
    const createPerspective = (fovRad: number, aspect: number, near: number, far: number): Float32Array => {
      const f = 1.0 / Math.tan(fovRad / 2);
      const nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0,
      ]);
    };

    const multiplyMatrices = (a: Float32Array, b: Float32Array): Float32Array => {
      const out = new Float32Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          out[i * 4 + j] =
            a[i * 4 + 0] * b[0 * 4 + j] +
            a[i * 4 + 1] * b[1 * 4 + j] +
            a[i * 4 + 2] * b[2 * 4 + j] +
            a[i * 4 + 3] * b[3 * 4 + j];
        }
      }
      return out;
    };

    const createModelView = (
      pDeg: number,
      yDeg: number,
      dist: number,
      panX: number,
      panY: number
    ): Float32Array => {
      const pRad = (pDeg * Math.PI) / 180;
      const yRad = (yDeg * Math.PI) / 180;

      const cp = Math.cos(pRad);
      const sp = Math.sin(pRad);
      const cy = Math.cos(yRad);
      const sy = Math.sin(yRad);

      return new Float32Array([
        cy, sp * sy, -cp * sy, 0,
        0, cp, sp, 0,
        sy, -sp * cy, cp * cy, 0,
        panX, panY, -dist, 1,
      ]);
    };

    // 7. Render Loop
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    const render = () => {
      if (!canvas || !gl) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.clearColor(0.04, 0.06, 0.1, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(program);

      // Attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
      gl.enableVertexAttribArray(aTexCoord);
      gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

      // Textures
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, depthTexture);
      gl.uniform1i(uDepthMap, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, colorTexture);
      gl.uniform1i(uTexture, 1);

      // Uniforms: Displacement, NearClip, FarClip, Colormap
      const disp = props.displacementScale !== undefined ? props.displacementScale : 0.42;
      gl.uniform1f(uDisplacement, disp);

      const nClip = props.nearClip !== undefined ? props.nearClip : 0.1;
      const fClip = props.farClip !== undefined ? props.farClip : 0.95;
      gl.uniform1f(uNearClip, nClip);
      gl.uniform1f(uFarClip, fClip);

      const palName = (props.colormap || "turbo").toLowerCase();
      const colormapMode =
        palName === "magma" ? 1 : palName === "viridis" ? 2 : palName === "grayscale" ? 3 : 0;
      gl.uniform1i(uColormap, colormapMode);

      const useRgbTexture = props.textureMode === "rgb_texture";
      gl.uniform1i(uUseTexture, useRgbTexture ? 1 : 0);

      const aspect = Math.max(0.1, width / Math.max(1, height));
      const proj = createPerspective((45 * Math.PI) / 180, aspect, 0.1, 100.0);
      const mv = createModelView(pitch(), yaw(), distance(), pan().x, pan().y);
      const mvp = multiplyMatrices(proj, mv);
      gl.uniformMatrix4fv(uMVP, false, mvp);

      if (props.wireframe) {
        gl.uniform1i(uUseTexture, 0);
        gl.uniform1i(uColormap, -1);
        gl.uniform4f(uSolidColor, 0.22, 0.74, 0.97, 1.0); // Cyan neon wireframe
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIndexBuffer);
        gl.drawElements(gl.LINES, wireframeIndices.length, gl.UNSIGNED_SHORT, 0);
      } else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triIndexBuffer);
        gl.drawElements(gl.TRIANGLES, triangleIndices.length, gl.UNSIGNED_SHORT, 0);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    // 8. Clean up GPU resources on unmount
    onCleanup(() => {
      cancelAnimationFrame(animId);
      if (gl) {
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(posBuffer);
        gl.deleteBuffer(texBuffer);
        gl.deleteBuffer(triIndexBuffer);
        gl.deleteBuffer(wireIndexBuffer);
        gl.deleteTexture(depthTexture);
        gl.deleteTexture(colorTexture);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    });
  });

  // Pointer event handlers for 3D Camera Orbit
  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragButton(e.button);
    setLastMouse({ x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging()) return;
    e.preventDefault();
    const dx = e.clientX - lastMouse().x;
    const dy = e.clientY - lastMouse().y;
    setLastMouse({ x: e.clientX, y: e.clientY });

    if (dragButton() === 0) {
      // Left click: Orbit Pitch & Yaw
      setYaw((y) => (y + dx * 0.45) % 360);
      setPitch((p) => Math.max(-85, Math.min(85, p + dy * 0.45)));
    } else {
      // Right or Middle click: Pan
      setPan((p) => ({
        x: p.x + dx * 0.003,
        y: p.y - dy * 0.003,
      }));
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging()) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? -0.15 : 0.15;
    setDistance((d) => Math.max(0.8, Math.min(6.0, Number((d + delta).toFixed(2)))));
  };

  return (
    <div
      class={`relative w-full h-full overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing ${
        props.class || ""
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={0}
      role="region"
      aria-label="Interactive 3D Depth Relief Mesh Orbit Viewport"
    >
      <canvas ref={canvasRef} class="w-full h-full block" />

      {/* Orbit Help Guide HUD */}
      <div class="absolute bottom-2.5 left-2.5 z-10 px-2.5 py-1 rounded-lg bg-background/85 dark:bg-card/85 text-muted-foreground border border-border/80 backdrop-blur-sm font-mono text-[10px] pointer-events-none shadow-xs space-y-0.5">
        <div class="flex items-center gap-1.5 text-foreground font-semibold">
          <span>ORBIT: Left Click Drag</span>
          <span class="text-muted-foreground/60">•</span>
          <span>PAN: Right Click Drag</span>
          <span class="text-muted-foreground/60">•</span>
          <span>ZOOM: Scroll</span>
        </div>
        <div class="text-[9px] text-primary tabular-nums">
          Pitch: {Math.round(pitch())}° • Yaw: {Math.round(yaw())}° • Dist: {distance().toFixed(2)}
        </div>
      </div>
    </div>
  );
}
