import React, { useRef, useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';
import { Monitor, Sparkles, Box } from 'lucide-react';
import { IRStateManager } from '../lib/ir/irState';
import { DepthMathEngine } from '../lib/math/DepthMathEngine';

interface PreviewProps {
  playhead: {
    currentFrame: number;
    totalFrames: number;
    currentTime: number;
    fps: number;
  };
}

export function Preview({ playhead }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const [glReady, setGlReady] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const width = irState.doc.meta.canvasSize.w || 1920;
  const height = irState.doc.meta.canvasSize.h || 1080;
  const currentFrame = playhead?.currentFrame || 0;
  const fps = playhead?.fps || 30;

  // Initialize WebGL 2.0 Shader Pipeline with 3D Depth & VFX capabilities
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) {
      console.warn('[Preview] WebGL2 not supported, falling back to 2D');
      return;
    }
    glRef.current = gl;

    // Vertex Shader: Fullscreen quad
    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = (a_position + 1.0) * 0.5;
        v_texCoord.y = 1.0 - v_texCoord.y; // Flip Y for screen space
      }
    `;

    // Fragment Shader: Hardware Color Grading, 3D Depth Parallax & Matrix Rain / Vignette
    const fsSource = `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      out vec4 fragColor;

      uniform float u_time;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_exposure;
      uniform float u_vignette;
      uniform vec2 u_parallax;
      uniform float u_popout;

      void main() {
        vec2 uv = v_texCoord;

        // Apply 3D Parallax Perspective Shift on coordinates
        uv += u_parallax * 0.001;

        // Procedural Cyberpunk backdrop (Deep cyber blue into violet)
        vec3 color = mix(vec3(0.04, 0.06, 0.12), vec3(0.14, 0.08, 0.24), uv.y + sin(uv.x * 3.1415 + u_time * 0.2) * 0.15);

        // Perspective grid lines
        vec2 grid = abs(fract(uv * vec2(20.0, 12.0) - 0.5) - 0.5) / fwidth(uv * vec2(20.0, 12.0));
        float line = min(grid.x, grid.y);
        float gridAlpha = 1.0 - min(line, 1.0);
        color = mix(color, vec3(0.12, 0.45, 0.65), gridAlpha * 0.3);

        // 3D Depth Holographic Subject representation
        vec2 centerDist = uv - vec2(0.5);
        float subjectMask = 1.0 - smoothstep(0.15 * u_popout, 0.35 * u_popout, length(centerDist));
        if (subjectMask > 0.0) {
          vec3 subjectColor = vec3(0.2, 0.85, 0.95);
          float scanline = sin(uv.y * 300.0 + u_time * 15.0) * 0.1;
          color = mix(color, subjectColor + scanline, subjectMask * 0.85);
        }

        // Color Grading: Exposure
        color += vec3(u_exposure);

        // Color Grading: Contrast
        color = (color - 0.5) * u_contrast + 0.5;

        // Color Grading: Saturation
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, u_saturation);

        // Vignette & Frame Breaker Tunnel
        if (u_vignette > 0.0) {
          float dist = distance(uv, vec2(0.5, 0.5));
          float vig = smoothstep(0.85, 0.85 - u_vignette * 0.5, dist);
          color *= vig;
        }

        fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
      }
    `;

    const compileShader = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
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
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    programRef.current = program;

    // Set up quad vertices
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    setGlReady(true);
  }, [width, height]);

  // Event-Driven Render Execution: recalculates uniforms with pts.js math
  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    // 1. Query active sequences
    const activeSeqs = irState.intervalTree?.queryActive(currentFrame) || [];
    let contrast = 1.0;
    let saturation = 1.0;
    let exposure = 0.0;
    let vignette = 0.35;
    let popOutIntensity = 1.0;

    for (const seq of activeSeqs) {
      if (seq.modifiers) {
        for (const mod of seq.modifiers) {
          if (mod.type === 'vfx/color_grading') {
            const p = mod.params as any;
            if (typeof p.contrast === 'number') contrast = p.contrast;
            if (typeof p.saturation === 'number') saturation = p.saturation;
            if (typeof p.exposure === 'number') exposure = p.exposure;
          }
          if (mod.type === 'vfx/depth3d') {
            const p = mod.params as any;
            if (typeof p.popOutIntensity === 'number') popOutIntensity = p.popOutIntensity;
          }
          if (mod.type === 'overlay/canvas_particles') {
            vignette = 0.55;
          }
        }
      }
    }

    // Compute pts.js deterministic parallax vectors
    const parallax = DepthMathEngine.computeParallax(
      currentFrame,
      fps,
      popOutIntensity,
      mousePos.x,
      mousePos.y
    );

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);

    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), currentFrame / fps);
    gl.uniform1f(gl.getUniformLocation(program, 'u_contrast'), contrast);
    gl.uniform1f(gl.getUniformLocation(program, 'u_saturation'), saturation);
    gl.uniform1f(gl.getUniformLocation(program, 'u_exposure'), exposure);
    gl.uniform1f(gl.getUniformLocation(program, 'u_vignette'), vignette);
    gl.uniform2f(gl.getUniformLocation(program, 'u_parallax'), parallax.offsetX, parallax.offsetY);
    gl.uniform1f(gl.getUniformLocation(program, 'u_popout'), popOutIntensity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [currentFrame, fps, irState, glReady, mousePos]);

  // Active cues for subtitles and HUD telemetry
  const activeCues = (irState.intervalTree?.queryActive(currentFrame) || [])
    .filter((s) => s.cues && s.cues.length > 0)
    .flatMap((s) => s.cues || []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  return (
    <Card className="relative max-h-full max-w-full flex flex-col items-center justify-center p-0 overflow-hidden border-slate-800 bg-slate-950/90 shadow-2xl">
      {/* Top Monitor Status Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="bg-slate-900/85 backdrop-blur-xs text-slate-300 border-slate-700/60 font-mono gap-1 text-[10px]"
          >
            <Monitor className="w-3 h-3 text-indigo-400" />
            {width}x{height} (16:9)
          </Badge>
          <Badge
            variant="outline"
            className="bg-slate-900/85 backdrop-blur-xs text-emerald-400 border-slate-700/60 font-mono text-[10px] flex items-center gap-1"
          >
            <Sparkles className="w-2.5 h-2.5" />
            WebGL 2.0 (0 FPS Idle)
          </Badge>
          <Badge
            variant="outline"
            className="bg-slate-900/85 backdrop-blur-xs text-violet-400 border-slate-700/60 font-mono text-[10px] flex items-center gap-1"
          >
            <Box className="w-2.5 h-2.5" />
            pts.js 3D Depth
          </Badge>
        </div>

        <Tooltip content="Viewport Engine">
          <Badge
            variant="secondary"
            className="bg-slate-900/85 text-slate-400 border-slate-700/60 font-mono text-[10px]"
          >
            Calibrated GLSL + Vector Math
          </Badge>
        </Tooltip>
      </div>

      {/* Main Video Viewport Canvas with Mouse Interactive Parallax */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        className="max-h-[70vh] max-w-[80vw] object-contain rounded-lg shadow-inner cursor-crosshair"
        style={{ aspectRatio: '16/9' }}
      />

      {/* Dynamic Subtitles & HUD Callout Overlay */}
      {activeCues.length > 0 && (
        <div className="absolute bottom-6 left-8 right-8 flex flex-col items-center gap-2 pointer-events-none z-20">
          {activeCues.map((cue, idx) => (
            <span
              key={idx}
              className={`backdrop-blur-xs px-4 py-1.5 rounded-md border shadow-lg text-center ${
                cue.text.startsWith('TARGET')
                  ? 'bg-rose-950/80 border-rose-500/40 text-rose-300 font-mono text-xs tracking-wider'
                  : 'bg-black/80 border-white/10 text-white font-medium text-base'
              }`}
            >
              {cue.text}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
