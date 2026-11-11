// ============================================================================
// KINETIX STUDIO v5.0 - WEBGPU / WEBGL2 SHADER ACCELERATION BRIDGE
// High-performance compute & fragment shader pipeline with refractive acrylic
// caustics, chromatic dispersion, and fail-safe analytical 2D canvas fallback.
// ============================================================================

export interface WebGpuShaderUniforms {
  time: number;
  width: number;
  height: number;
  turbulence: number;
  bass: number;
  mid: number;
  high: number;
  chromaticAberration: number;
  paletteBg: [number, number, number];
  paletteAccent: [number, number, number];
}

export class WebGpuShaderBridge {
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private glCtx: WebGL2RenderingContext | null = null;
  private isSupported = false;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;

  constructor() {
    this.initPipeline();
  }

  private initPipeline(): void {
    if (typeof window === 'undefined') return;

    try {
      this.offscreenCanvas = document.createElement('canvas');
      // Attempt WebGL2 context (Universal hardware fragment shader pipeline)
      this.glCtx = this.offscreenCanvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        depth: false,
        premultipliedAlpha: false,
      });

      if (this.glCtx) {
        const compiled = this.compileShaders(this.glCtx);
        this.isSupported = compiled;
      }
    } catch {
      this.isSupported = false;
    }
  }

  public getSupported(): boolean {
    return this.isSupported;
  }

  public renderRefractiveAcrylic(
    destCtx: CanvasRenderingContext2D | { drawImage: (...args: any[]) => void },
    w: number,
    h: number,
    uniforms: WebGpuShaderUniforms
  ): boolean {
    if (!this.isSupported || !this.glCtx || !this.offscreenCanvas || !this.program) {
      return false; // Fallback to 2D Canvas
    }

    const gl = this.glCtx;
    if (this.offscreenCanvas.width !== w || this.offscreenCanvas.height !== h) {
      this.offscreenCanvas.width = w;
      this.offscreenCanvas.height = h;
      gl.viewport(0, 0, w, h);
    }

    gl.useProgram(this.program);

    // Bind uniforms
    const uTime = gl.getUniformLocation(this.program, 'u_time');
    const uResolution = gl.getUniformLocation(this.program, 'u_resolution');
    const uTurbulence = gl.getUniformLocation(this.program, 'u_turbulence');
    const uAudio = gl.getUniformLocation(this.program, 'u_audio');
    const uChromatic = gl.getUniformLocation(this.program, 'u_chromatic');
    const uBg = gl.getUniformLocation(this.program, 'u_bg');
    const uAccent = gl.getUniformLocation(this.program, 'u_accent');

    if (uTime) gl.uniform1f(uTime, uniforms.time);
    if (uResolution) gl.uniform2f(uResolution, w, h);
    if (uTurbulence) gl.uniform1f(uTurbulence, uniforms.turbulence);
    if (uAudio) gl.uniform3f(uAudio, uniforms.bass, uniforms.mid, uniforms.high);
    if (uChromatic) gl.uniform1f(uChromatic, uniforms.chromaticAberration);
    if (uBg) gl.uniform3fv(uBg, uniforms.paletteBg);
    if (uAccent) gl.uniform3fv(uAccent, uniforms.paletteAccent);

    // Draw full-screen quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    const aPos = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Composite back to target 2D canvas
    destCtx.drawImage(this.offscreenCanvas, 0, 0, w, h);
    return true;
  }

  private compileShaders(gl: WebGL2RenderingContext): boolean {
    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Refractive Acrylic Glass with Snell's law chromatic dispersion
    const fsSource = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_turbulence;
      uniform vec3 u_audio;
      uniform float u_chromatic;
      uniform vec3 u_bg;
      uniform vec3 u_accent;

      // Simplex noise approximation
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vec2 uv = v_uv;
        float t = u_time * 0.4;
        float n = snoise(uv * 3.5 * u_turbulence + vec2(t * 0.2, t * 0.15)) * (0.04 + u_audio.x * 0.08);

        // Chromatic dispersion indices of refraction (Red, Green, Blue)
        float disp = u_chromatic * 0.025;
        float rCol = snoise((uv + vec2(n + disp, 0.0)) * 2.5);
        float gCol = snoise((uv + vec2(n, 0.0)) * 2.5);
        float bCol = snoise((uv + vec2(n - disp, 0.0)) * 2.5);

        vec3 caustics = mix(u_bg, u_accent, vec3(rCol, gCol, bCol) * 0.65 + 0.35);
        float alpha = 0.45 + (rCol + gCol + bCol) * 0.15 + u_audio.y * 0.2;

        fragColor = vec4(caustics, clamp(alpha, 0.0, 0.95));
      }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) return false;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.warn('WebGL2 vertex shader compilation failed:', gl.getShaderInfoLog(vs));
      gl.deleteShader(vs);
      return false;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fs) {
      gl.deleteShader(vs);
      return false;
    }
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn('WebGL2 fragment shader compilation failed:', gl.getShaderInfoLog(fs));
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return false;
    }

    const prog = gl.createProgram();
    if (!prog) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return false;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('WebGL2 program link failed:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return false;
    }

    this.program = prog;

    // Full-screen quad geometry
    this.positionBuffer = gl.createBuffer();
    if (!this.positionBuffer) {
      return false;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    );
    return true;
  }
}

// Global Singleton Bridge Instance
export const webGpuShaderBridge = new WebGpuShaderBridge();
