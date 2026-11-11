import { createSignal, createMemo, onMount, onCleanup, createEffect } from 'solid-js';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  type ModifierNode,
  type ClipRenderContext,
  type StreamRenderContext,
  type MasterCompositeContext,
  type ResolvedSequence,
  type ResolvedTrack,
} from '@acc/ir';
import { IRStateManager } from '../../../lib/ir/irState';
import { PLAYGROUND_PRESETS, getPresetsForPlugin, extractSchemaDefaults } from './playgroundPresets';

export type ViewMode = 'trio' | 'focus' | 'code';
export type BackdropMode = 'testcard' | 'dark' | 'white' | 'checkerboard';

export interface PlaygroundTelemetry {
  latencyMs: number;
  fps: number;
  stackDelta: number;
  lastError: string | null;
}

export interface PlaygroundEngineState {
  selectedPluginType: string;
  currentParams: Record<string, any>;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  speed: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
  backdropMode: BackdropMode;
  viewMode: ViewMode;
  telemetry: PlaygroundTelemetry;
}

export function usePlaygroundEngine(initialPluginType = 'overlay/canvas_particles') {
  // Ensure registry is initialized
  const registry = ModifierPluginRegistry.getInstance();
  if (registry.listTypes().length === 0) {
    registerCoreModifierPlugins(registry);
  }

  // State Signals
  const [selectedPluginType, setSelectedPluginType] = createSignal<string>(initialPluginType);
  const [currentParams, setCurrentParams] = createSignal<Record<string, any>>({});
  const [isPlaying, setIsPlaying] = createSignal<boolean>(true);
  const [currentFrame, setCurrentFrame] = createSignal<number>(0);
  const [totalFrames] = createSignal<number>(180); // 6.0s @ 30fps
  const [fps] = createSignal<number>(30);
  const [speed, setSpeed] = createSignal<number>(1.0);
  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1'>('16:9');
  const [backdropMode, setBackdropMode] = createSignal<BackdropMode>('testcard');
  const [viewMode, setViewMode] = createSignal<ViewMode>('trio');

  // Telemetry Signals
  const [latencyMs, setLatencyMs] = createSignal<number>(0);
  const [measuredFps, setMeasuredFps] = createSignal<number>(60);
  const [stackDelta, setStackDelta] = createSignal<number>(0);
  const [lastError, setLastError] = createSignal<string | null>(null);

  // Canvas Reference
  let canvasRef: HTMLCanvasElement | null = null;
  let rafId: number | null = null;
  let lastRafTimestamp = performance.now();
  let frameAccumulator = 0;
  let fpsFramesCount = 0;
  let fpsLastCalculated = performance.now();
  let emaLatency = 0;

  // Active Plugin Memo
  const activePlugin = createMemo(() => {
    const type = selectedPluginType();
    return registry.get(type);
  });

  // Automatically load default/first preset when selected plugin changes
  createEffect(() => {
    const pType = selectedPluginType();
    const plugin = registry.get(pType);
    const presets = getPresetsForPlugin(pType, plugin?.schema);
    if (presets.length > 0 && presets[0].params) {
      setCurrentParams(JSON.parse(JSON.stringify(presets[0].params)));
    } else {
      setCurrentParams(extractSchemaDefaults(plugin?.schema));
    }
    setLastError(null);
  });

  // Render Synthetic Backdrop
  const renderBackdrop = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    mode: BackdropMode
  ) => {
    ctx.save();
    if (mode === 'dark') {
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, width, height);
      // Subtle radial highlight
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        20,
        width / 2,
        height / 2,
        width * 0.7
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (mode === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    } else if (mode === 'checkerboard') {
      const size = 16;
      for (let y = 0; y < height; y += size) {
        for (let x = 0; x < width; x += size) {
          ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? '#181d28' : '#0f1219';
          ctx.fillRect(x, y, size, size);
        }
      }
    } else {
      // SMPTE / High-Contrast Video Testcard
      // Top 60%: 7 Primary & Secondary Color Bars
      const barHeight = Math.floor(height * 0.58);
      const barWidth = width / 7;
      const colors = [
        '#FFFFFF', // White
        '#FFFF00', // Yellow
        '#00FFFF', // Cyan
        '#00FF00', // Green
        '#FF00FF', // Magenta
        '#FF0000', // Red
        '#0000FF', // Blue
      ];
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(i * barWidth, 0, barWidth + 1, barHeight);
      }

      // Middle 22%: Castellation & Luminance Grayscale Ramp
      const midY = barHeight;
      const midHeight = Math.floor(height * 0.22);
      const rampGrad = ctx.createLinearGradient(0, midY, width, midY);
      rampGrad.addColorStop(0, '#000000');
      rampGrad.addColorStop(0.25, '#404040');
      rampGrad.addColorStop(0.5, '#808080');
      rampGrad.addColorStop(0.75, '#C0C0C0');
      rampGrad.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = rampGrad;
      ctx.fillRect(0, midY, width, midHeight);

      // Bottom 20%: Pluge & Calibration Strip
      const botY = midY + midHeight;
      const botHeight = height - botY;
      ctx.fillStyle = '#111318';
      ctx.fillRect(0, botY, width, botHeight);

      // Alignment Crosshair & Label
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      const fontSize = Math.max(11, Math.round(height * 0.024));
      ctx.font = `bold ${fontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('UNIVERSAL VIDEO-IR TEST PATTERN', width / 2, botY + botHeight / 2 + 4);
    }
    ctx.restore();
  };

  // Synthetic Audio Visualizer for DSP Plugins
  const renderAudioWaveform = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: number,
    params: Record<string, any>
  ) => {
    ctx.save();
    const centerY = height / 2;
    const waveCount = 2;
    const colors = ['#00f0ff', '#ff0077'];

    for (let w = 0; w < waveCount; w++) {
      ctx.strokeStyle = colors[w];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const freq = (params.cutoffHz ? params.cutoffHz / 800 : 2.0) + w * 1.5;
      const amp = (params.gain || params.volume || 1.0) * (height * 0.25);

      for (let x = 0; x < width; x += 3) {
        const timeFactor = (frame * 0.1) * (params.speedMultiplier || 1.0);
        const y = centerY + Math.sin(x * 0.02 * freq + timeFactor + w) * amp * Math.cos(x * 0.005);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const audioFontSize = Math.max(10, Math.round(height * 0.022));
    ctx.font = `${audioFontSize}px ui-monospace, monospace`;
    ctx.fillText('AUDIO DSP SYNTHETIC OSCILLOSCOPE', 16, height - 16);
    ctx.restore();
  };

  // Single Frame Render Pass
  const renderFrame = (frame: number) => {
    if (!canvasRef) return;
    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const plugin = activePlugin();
    const params = currentParams();

    const tStart = performance.now();
    let saveCount = 0;
    let restoreCount = 0;

    // Intercept save / restore for balance audit
    const originalSave = ctx.save;
    const originalRestore = ctx.restore;
    ctx.save = function () {
      saveCount++;
      return originalSave.apply(this, arguments as any);
    };
    ctx.restore = function () {
      restoreCount++;
      return originalRestore.apply(this, arguments as any);
    };

    try {
      // 1. Clear & Draw Backdrop
      ctx.clearRect(0, 0, width, height);
      renderBackdrop(ctx, width, height, backdropMode());

      if (plugin) {
        // Construct Zero-Alloc Synthetic Sequence Context
        const syntheticSeq: ResolvedSequence = {
          id: 'playground-preview-sequence',
          trackId: 'playground-track',
          type: (plugin.allowedSequenceTypes?.[0] as any) || 'overlay',
          startFrame: 0,
          endFrame: totalFrames(),
          durationFrames: totalFrames(),
          trimInSec: 0,
          speed: 1.0,
          modifiers: [
            {
              type: selectedPluginType(),
              target: (plugin.allowedSequenceTypes?.[0] as any) || 'overlay',
              params,
            } as ModifierNode,
          ],
        };

        const syntheticTrack: ResolvedTrack = {
          id: 'playground-track',
          type: 'video',
          sequences: [syntheticSeq],
        };

        // Polymorphic Dispatch based on available plugin methods
        if (typeof (plugin as any).renderClipSpace === 'function') {
          const clipCtx: ClipRenderContext = {
            canvas,
            ctx,
            frame,
            localFrame: frame,
            width,
            height,
            sequence: syntheticSeq,
          };
          (plugin as any).renderClipSpace(clipCtx, params);
        } else if (typeof (plugin as any).renderStreamSpace === 'function') {
          const streamCtx: StreamRenderContext = {
            canvas,
            ctx,
            frame,
            width,
            height,
            track: syntheticTrack,
            activeSequences: [syntheticSeq],
          };
          (plugin as any).renderStreamSpace(streamCtx, params);
        } else if (typeof (plugin as any).renderMasterComposite === 'function') {
          const masterCtx: MasterCompositeContext = {
            canvas,
            ctx,
            frame,
            width,
            height,
            pixelBuffer: new Uint8Array(0),
          };
          (plugin as any).renderMasterComposite(masterCtx, params);
        } else if (typeof (plugin as any).processAudioStream === 'function') {
          renderAudioWaveform(ctx, width, height, frame, params);
        }
      }

      setLastError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      // Draw error alert on canvas
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.fillRect(16, 16, width - 32, 48);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`Modifier Render Error: ${msg}`, 28, 44);
      ctx.restore();
    } finally {
      // Restore intercepts
      ctx.save = originalSave;
      ctx.restore = originalRestore;
      const delta = saveCount - restoreCount;
      setStackDelta(delta);

      // Micro-Benchmark Latency EMA
      const tEnd = performance.now();
      const rawLatency = Math.max(0.1, tEnd - tStart);
      emaLatency = emaLatency === 0 ? rawLatency : 0.85 * emaLatency + 0.15 * rawLatency;
      setLatencyMs(parseFloat(emaLatency.toFixed(2)));
    }
  };

  // Main RAF Animation Loop
  const rafLoop = (timestamp: number) => {
    const elapsed = Math.min(250, timestamp - lastRafTimestamp);
    lastRafTimestamp = timestamp;

    // Calculate real FPS every 500ms
    fpsFramesCount++;
    if (timestamp - fpsLastCalculated >= 500) {
      const calculatedFps = Math.round((fpsFramesCount * 1000) / (timestamp - fpsLastCalculated));
      setMeasuredFps(calculatedFps);
      fpsFramesCount = 0;
      fpsLastCalculated = timestamp;
    }

    if (isPlaying()) {
      frameAccumulator += (elapsed / (1000 / fps())) * speed();
      if (frameAccumulator >= 1.0) {
        const framesToAdvance = Math.floor(frameAccumulator);
        frameAccumulator -= framesToAdvance;
        setCurrentFrame((prev) => (prev + framesToAdvance) % totalFrames());
      }
    }

    renderFrame(currentFrame());
    rafId = requestAnimationFrame(rafLoop);
  };

  onMount(() => {
    lastRafTimestamp = performance.now();
    fpsLastCalculated = performance.now();
    rafId = requestAnimationFrame(rafLoop);
  });

  onCleanup(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  // Transport and Control Actions
  const togglePlay = () => setIsPlaying((prev) => !prev);
  const seek = (f: number) => {
    const clamped = Math.max(0, Math.min(totalFrames() - 1, Math.round(f)));
    setCurrentFrame(clamped);
    renderFrame(clamped);
  };

  const setParam = (key: string, value: any) => {
    setCurrentParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const loadPreset = (presetParams: Record<string, any>) => {
    setCurrentParams(JSON.parse(JSON.stringify(presetParams)));
  };

  const resetDefaults = () => {
    const plugin = activePlugin();
    setCurrentParams(extractSchemaDefaults(plugin?.schema));
  };

  const attachCanvas = (el: HTMLCanvasElement | null) => {
    canvasRef = el;
    if (canvasRef) {
      renderFrame(currentFrame());
    }
  };

  // Live VideoIR ModifierNode JSON
  const generatedModifierNode = createMemo<ModifierNode>(() => {
    const plugin = activePlugin();
    const target = (plugin?.defaultTarget || plugin?.allowedSequenceTypes?.[0] || 'overlay') as any;
    return {
      type: selectedPluginType(),
      target,
      params: currentParams(),
    } as ModifierNode;
  });

  // Inject into Studio timeline or copy fallback
  const applyToActiveSequence = (): {
    success: boolean;
    message: string;
    copiedFallback?: boolean;
  } => {
    const manager = IRStateManager.getInstance();
    const state = manager.getState();
    const activeSeqId = state.selectedSequenceId;
    const node = generatedModifierNode();

    if (activeSeqId) {
      manager.addModifier(
        activeSeqId,
        node.type,
        node.params as Record<string, unknown>,
        (node as any).target
      );
      return {
        success: true,
        message: `Applied '${node.type}' to sequence '${activeSeqId}' (Undoable via Ctrl+Z)`,
      };
    } else {
      // Clipboard fallback
      try {
        navigator.clipboard.writeText(JSON.stringify(node, null, 2));
      } catch {
        // Fallback for non-secure contexts
      }
      return {
        success: false,
        message: 'No active sequence selected in Studio timeline. Modifier JSON copied to clipboard!',
        copiedFallback: true,
      };
    }
  };

  return {
    state: {
      get selectedPluginType() {
        return selectedPluginType();
      },
      get currentParams() {
        return currentParams();
      },
      get isPlaying() {
        return isPlaying();
      },
      get currentFrame() {
        return currentFrame();
      },
      get totalFrames() {
        return totalFrames();
      },
      get fps() {
        return fps();
      },
      get speed() {
        return speed();
      },
      get aspectRatio() {
        return aspectRatio();
      },
      get backdropMode() {
        return backdropMode();
      },
      get viewMode() {
        return viewMode();
      },
      get telemetry(): PlaygroundTelemetry {
        return {
          latencyMs: latencyMs(),
          fps: measuredFps(),
          stackDelta: stackDelta(),
          lastError: lastError(),
        };
      },
    },
    activePlugin,
    generatedModifierNode,
    selectPlugin: (type: string) => setSelectedPluginType(type),
    setParam,
    loadPreset,
    togglePlay,
    seek,
    setSpeed,
    setAspectRatio,
    setBackdropMode,
    setViewMode,
    resetDefaults,
    applyToActiveSequence,
    attachCanvas,
  };
}

export type PlaygroundEngine = ReturnType<typeof usePlaygroundEngine>;
