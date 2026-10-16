import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';
import { Monitor, Sparkles, Box, Move, RotateCw } from 'lucide-react';
import { IRStateManager } from '../lib/ir/irState';
import { DepthMathEngine } from '../lib/math/DepthMathEngine';
import { AssetTextureCache } from '../lib/textures/AssetTextureCache';
import {
  CanvasTransformOverlay,
  MagneticSnapEngine,
  type BoundingBox2D,
  type SnappingGuide,
  type TransformHandleType,
} from '@acc/effect-engines/client';

interface PreviewProps {
  playhead: {
    currentFrame: number;
    totalFrames: number;
    currentTime: number;
    fps: number;
  };
}

interface TransformState {
  x: number; // offset px
  y: number; // offset px
  scale: number; // 0.2 to 3.0
  rotation: number; // degrees
}

export function Preview({ playhead }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const [glReady, setGlReady] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  // In-Canvas 2D Vector Transform & Magnetic Snapping State
  const [transform, setTransform] = useState<TransformState>({ x: 0, y: 0, scale: 1.0, rotation: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<TransformHandleType | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnappingGuide[]>([]);
  const [startPointer, setStartPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startTransform, setStartTransform] = useState<TransformState>({ x: 0, y: 0, scale: 1.0, rotation: 0 });

  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const width = irState.doc?.meta?.canvasSize?.w || 1920;
  const height = irState.doc?.meta?.canvasSize?.h || 1080;
  const currentFrame = playhead?.currentFrame || 0;
  const fps = playhead?.fps || 30;
  const selectedSeqId = irState.selectedSequenceId;

  // Sync transform state from selected sequence modifier if available
  useEffect(() => {
    if (!selectedSeqId) return;
    const activeSeqs = irState.timeline?.sequences ? Array.from(irState.timeline.sequences.values()) : [];
    const seq = activeSeqs.find((s) => s.id === selectedSeqId);
    if (seq?.modifiers) {
      const transMod = seq.modifiers.find((m) => m.type === 'transform');
      if (transMod?.params) {
        const p = transMod.params as any;
        setTransform({
          x: p.x ?? 0,
          y: p.y ?? 0,
          scale: p.scale ?? 1.0,
          rotation: p.rotation ?? 0,
        });
      }
    }
  }, [selectedSeqId, irState]);

  // Initialize WebGL 2.0 Shader Pipeline with Texture Sampling & 3D Depth
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) {
      console.warn('[Preview] WebGL2 not supported');
      return;
    }
    glRef.current = gl;

    // Vertex Shader: Fullscreen quad with UV flipping
    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = (a_position + 1.0) * 0.5;
        v_texCoord.y = 1.0 - v_texCoord.y;
      }
    `;

    // Fragment Shader: Hardware Color Grading, Texture Sampling, 3D Parallax & Vignette
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
      uniform sampler2D u_image;
      uniform float u_hasTexture;

      void main() {
        vec2 uv = v_texCoord;
        uv += u_parallax * 0.001;

        vec4 texColor = vec4(0.0);
        if (u_hasTexture > 0.5) {
          texColor = texture(u_image, uv);
        }

        // Procedural Cyberpunk backdrop fallback
        vec3 backdrop = mix(vec3(0.04, 0.06, 0.12), vec3(0.14, 0.08, 0.24), uv.y + sin(uv.x * 3.1415 + u_time * 0.2) * 0.15);
        vec2 grid = abs(fract(uv * vec2(20.0, 12.0) - 0.5) - 0.5) / fwidth(uv * vec2(20.0, 12.0));
        float line = min(grid.x, grid.y);
        float gridAlpha = 1.0 - min(line, 1.0);
        backdrop = mix(backdrop, vec3(0.12, 0.45, 0.65), gridAlpha * 0.3);

        vec3 color = u_hasTexture > 0.5 ? mix(backdrop, texColor.rgb, texColor.a) : backdrop;

        // 3D Depth Holographic Subject representation
        vec2 centerDist = uv - vec2(0.5);
        float subjectMask = 1.0 - smoothstep(0.15 * u_popout, 0.35 * u_popout, length(centerDist));
        if (subjectMask > 0.0) {
          vec3 subjectColor = vec3(0.2, 0.85, 0.95);
          float scanline = sin(uv.y * 300.0 + u_time * 15.0) * 0.1;
          color = mix(color, subjectColor + scanline, subjectMask * 0.35);
        }

        // Color Grading: Exposure, Contrast, Saturation
        color += vec3(u_exposure);
        color = (color - 0.5) * u_contrast + 0.5;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, u_saturation);

        // Vignette
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

    // Create texture slot
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    textureRef.current = texture;

    setGlReady(true);
  }, [width, height]);

  // Event-Driven Render Execution: Binds active layer texture & recalculates uniforms
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
    let activeAssetId: string | null = null;

    for (const seq of activeSeqs) {
      if (seq.assetId && !activeAssetId) {
        activeAssetId = seq.assetId;
      }
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

    // Bind texture from AssetTextureCache
    let hasTexture = 0.0;
    if (activeAssetId && textureRef.current) {
      const texCanvas = AssetTextureCache.getInstance().getTextureCanvas(activeAssetId, 640, 360);
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
      hasTexture = 1.0;
    }

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
    gl.uniform1f(gl.getUniformLocation(program, 'u_hasTexture'), hasTexture);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [currentFrame, fps, irState, glReady, mousePos]);

  // Direct in-canvas handle interaction handlers
  const handleHandleMouseDown = (handleType: TransformHandleType, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setActiveHandle(handleType);
    setStartPointer({ x: e.clientX, y: e.clientY });
    setStartTransform({ ...transform });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setMousePos({ x: normX, y: normY });

      if (isDragging && activeHandle && selectedSeqId) {
        const dx = e.clientX - startPointer.x;
        const dy = e.clientY - startPointer.y;

        const baseW = 0.5;
        const baseH = 0.5;
        const startNormBox: BoundingBox2D = {
          x: 0.5 + startTransform.x / width,
          y: 0.5 + startTransform.y / height,
          width: baseW * startTransform.scale,
          height: baseH * startTransform.scale,
          rotation: startTransform.rotation,
        };

        const currentPointerNorm = {
          x: (startPointer.x - rect.left + dx) / rect.width,
          y: (startPointer.y - rect.top + dy) / rect.height,
        };
        const startPointerNorm = {
          x: (startPointer.x - rect.left) / rect.width,
          y: (startPointer.y - rect.top) / rect.height,
        };

        const dragRes = CanvasTransformOverlay.computeDragTransform(
          startNormBox,
          activeHandle,
          currentPointerNorm,
          startPointerNorm,
          e.shiftKey,
          e.shiftKey
        );

        if (dragRes.snapResult) {
          setActiveGuides(dragRes.snapResult.activeGuides);
        } else {
          setActiveGuides([]);
        }

        const newNormBox = dragRes.box;
        const newTransform: TransformState = {
          x: Math.round((newNormBox.x - 0.5) * width),
          y: Math.round((newNormBox.y - 0.5) * height),
          scale: Number((newNormBox.width / baseW).toFixed(2)),
          rotation: newNormBox.rotation,
        };

        setTransform(newTransform);
        IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', newTransform as any);
      }
    },
    [isDragging, activeHandle, startPointer, startTransform, selectedSeqId, width, height]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
    setActiveHandle(null);
    setActiveGuides([]);
  };

  // Active cues for subtitles and HUD telemetry
  const activeCues = (irState.intervalTree?.queryActive(currentFrame) || [])
    .filter((s) => s.cues && s.cues.length > 0)
    .flatMap((s) => s.cues || []);

  return (
    <Card
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative max-h-full max-w-full flex flex-col items-center justify-center p-0 overflow-hidden border-slate-800 bg-slate-950/90 shadow-2xl select-none"
    >
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
            WebGL 2.0 Textures Active
          </Badge>
          <Badge
            variant="outline"
            className="bg-slate-900/85 backdrop-blur-xs text-violet-400 border-slate-700/60 font-mono text-[10px] flex items-center gap-1"
          >
            <Box className="w-2.5 h-2.5" />
            pts.js Vector Math
          </Badge>
        </div>

        {selectedSeqId && (
          <Badge
            variant="secondary"
            className="bg-indigo-950/80 text-indigo-300 border-indigo-700/60 font-mono text-[10px] flex items-center gap-1.5"
          >
            <Move className="w-3 h-3 text-indigo-400" />
            X: {transform.x}px | Y: {transform.y}px | S: {transform.scale.toFixed(2)}x | R: {transform.rotation}°
            {activeGuides.length > 0 && (
              <span className="text-cyan-400 font-semibold ml-1">
                [Snap: {activeGuides.map((g) => g.label).join(', ')}]
              </span>
            )}
          </Badge>
        )}
      </div>

      {/* Main Video Viewport Canvas with Mouse Interactive Parallax */}
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="max-h-[70vh] max-w-[80vw] object-contain rounded-lg shadow-inner cursor-crosshair"
          style={{ aspectRatio: '16/9' }}
        />

        {/* Magnetic Snapping Guidelines Overlay */}
        {activeGuides.map((guide) => (
          <div
            key={guide.id}
            style={
              guide.orientation === 'vertical'
                ? { left: `${guide.position * 100}%`, top: 0, bottom: 0 }
                : { top: `${guide.position * 100}%`, left: 0, right: 0 }
            }
            className={`absolute z-20 pointer-events-none ${
              guide.orientation === 'vertical'
                ? 'w-px border-l border-dashed border-cyan-400 shadow-[0_0_8px_#06b6d4]'
                : 'h-px border-t border-dashed border-cyan-400 shadow-[0_0_8px_#06b6d4]'
            }`}
          >
            <span
              className={`absolute text-[9px] font-mono bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 px-1.5 py-0.2 rounded shadow-xs ${
                guide.orientation === 'vertical' ? 'top-2 -translate-x-1/2' : 'left-2 -translate-y-1/2'
              }`}
            >
              {guide.label}
            </span>
          </div>
        ))}

        {/* Interactive In-Canvas 2D Transform Bounding Box with 8 Handles */}
        {selectedSeqId && (
          <div
            onMouseDown={(e) => handleHandleMouseDown('body', e)}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
              width: '50%',
              height: '50%',
            }}
            className="absolute border-2 border-indigo-400 bg-indigo-500/10 cursor-move rounded-xs flex items-center justify-center group shadow-lg pointer-events-auto z-10"
          >
            {/* 4 Corner Scale Handles */}
            <div
              onMouseDown={(e) => handleHandleMouseDown('tl', e)}
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-600 rounded-xs shadow-xs cursor-nwse-resize hover:scale-125 transition-transform"
              title="Scale Top-Left"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('tr', e)}
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-600 rounded-xs shadow-xs cursor-nesw-resize hover:scale-125 transition-transform"
              title="Scale Top-Right"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('bl', e)}
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-600 rounded-xs shadow-xs cursor-nesw-resize hover:scale-125 transition-transform"
              title="Scale Bottom-Left"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('br', e)}
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-600 rounded-xs shadow-xs cursor-nwse-resize hover:scale-125 transition-transform"
              title="Scale Bottom-Right"
            />

            {/* 4 Edge Stretch Handles */}
            <div
              onMouseDown={(e) => handleHandleMouseDown('tc', e)}
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-2 bg-indigo-200 border border-indigo-600 rounded-xs shadow-xs cursor-ns-resize hover:scale-125 transition-transform"
              title="Stretch Top"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('bc', e)}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-2 bg-indigo-200 border border-indigo-600 rounded-xs shadow-xs cursor-ns-resize hover:scale-125 transition-transform"
              title="Stretch Bottom"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('ml', e)}
              className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-3 bg-indigo-200 border border-indigo-600 rounded-xs shadow-xs cursor-ew-resize hover:scale-125 transition-transform"
              title="Stretch Left"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('mr', e)}
              className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-3 bg-indigo-200 border border-indigo-600 rounded-xs shadow-xs cursor-ew-resize hover:scale-125 transition-transform"
              title="Stretch Right"
            />

            {/* Rotation Stem & Knob Handle */}
            <div className="absolute -top-7 flex flex-col items-center">
              <div
                onMouseDown={(e) => handleHandleMouseDown('rotate', e)}
                className="w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-indigo-500 shadow-md transition-transform hover:scale-110"
                title="Drag to Rotate"
              >
                <RotateCw className="w-2.5 h-2.5" />
              </div>
              <div className="w-0.5 h-3 bg-indigo-400" />
            </div>

            {/* Sequence identifier pill */}
            <span className="text-[10px] font-mono bg-indigo-900/90 text-indigo-200 px-2 py-0.5 rounded shadow-xs select-none">
              {selectedSeqId}
            </span>
          </div>
        )}
      </div>

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
