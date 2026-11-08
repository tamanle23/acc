import { createSignal, createEffect, onCleanup, createMemo } from 'solid-js';
import { IRStateManager } from '../../lib/ir/irState';
import {
  getSequenceDurationFrames,
  getSequenceStartFrame,
  type StudioSequence,
} from '../../lib/ir/studioTypes';
import type { ModifierNode, ResolvedTimeline, VideoIRDocument } from '@acc/ir';
import { PlayheadController } from '../../lib/playhead/PlayheadController';
import {
  Gizmo2DTransformation,
  type BoundingBox2D,
  type SnappingGuide,
  type TransformHandleType,
  type SiblingGuideBox,
} from '../../lib/gizmo';
import { CanvasHitTester, type SequenceBounds } from '../../lib/hit-test/CanvasHitTester';

export interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface GizmoTelemetry {
  mode: 'move' | 'scale' | 'rotate' | 'anchor' | null;
  deltaX: number;
  deltaY: number;
  widthPx: number;
  heightPx: number;
  scale: number;
  rotation: number;
  activeGuides: SnappingGuide[];
  anchorPoint?: [number, number];
  gizmoTool?: 'move' | 'anchor';
}

export interface GizmoHUDControls {
  tool: 'move' | 'anchor';
  snapEnabled: boolean;
  axisLock: boolean;
  centerScale: boolean;
  anchorPoint: [number, number];
  setTool: (t: 'move' | 'anchor') => void;
  setSnapEnabled: (s: boolean | ((prev: boolean) => boolean)) => void;
  setAxisLock: (l: boolean | ((prev: boolean) => boolean)) => void;
  setCenterScale: (c: boolean | ((prev: boolean) => boolean)) => void;
  setAnchorPoint: (p: [number, number]) => void;
}

export interface UseGizmoTransformOptions {
  selectedSeqId: string | null;
  width: number;
  height: number;
  isLocked: boolean;
  timeline?: ResolvedTimeline | null;
  doc?: VideoIRDocument | null;
  activeSequences?: StudioSequence[];
  previewEngine?: {
    setEphemeralTransformOverride?: (sequenceId: string, override: any) => void;
  } | null;
  onRenderFrame?: () => void;
}

export function useGizmoTransform(options: UseGizmoTransformOptions) {
  const overlay = new Gizmo2DTransformation();
  const [transform, setTransform] = createSignal<TransformState>({
    x: 0,
    y: 0,
    scale: 1.0,
    rotation: 0,
  });
  const [isDragging, setIsDragging] = createSignal(false);
  const [activeHandle, setActiveHandle] = createSignal<TransformHandleType | null>(null);
  const [activeGuides, setActiveGuides] = createSignal<SnappingGuide[]>([]);
  const [telemetry, setTelemetry] = createSignal<GizmoTelemetry | null>(null);
  let startTransform: TransformState = {
    x: 0,
    y: 0,
    scale: 1.0,
    rotation: 0,
  };

  // Studio Pro NLE HUD Controls & Mode States
  const [gizmoTool, setGizmoTool] = createSignal<'move' | 'anchor'>('move');
  const [snapEnabled, setSnapEnabled] = createSignal(true);
  const [axisLock, setAxisLock] = createSignal(false);
  const [centerScale, setCenterScale] = createSignal(true);
  const [anchorPoint, setAnchorPoint] = createSignal<[number, number]>([0.5, 0.5]);
  let startAnchorPoint: [number, number] = [0.5, 0.5];
  let latestAnchorPoint: [number, number] = [0.5, 0.5];

  createEffect(() => {
    latestAnchorPoint = anchorPoint();
  });

  // Resolve active selected sequence
  const allSeqs = createMemo<StudioSequence[]>(() => {
    return options.timeline?.sequences
      ? Array.from(options.timeline.sequences.values())
      : options.doc?.tracks?.flatMap((t) => t.sequences) || [];
  });

  const selectedSeq = createMemo(() => {
    return allSeqs().find((s) => s.id === options.selectedSeqId);
  });

  // Compute dynamic target bounds with 8px breathing padding
  const targetBounds = createMemo<SequenceBounds>(() => {
    const seq = selectedSeq();
    if (!seq) {
      return {
        normX: 0.5,
        normY: 0.5,
        normWidth: 0.5,
        normHeight: 0.5,
        label: '',
        sequenceType: 'video',
      };
    }
    return CanvasHitTester.resolveSequenceBounds(seq as any, options.width, options.height, 8);
  });

  // Sync transform state from selected sequence modifier if available, and auto-seek when paused
  createEffect(() => {
    if (isDragging()) return;
    const seqId = options.selectedSeqId;
    if (!seqId) {
      setTransform({ x: 0, y: 0, scale: 1.0, rotation: 0 });
      setTelemetry(null);
      return;
    }

    const seq = selectedSeq();
    if (seq) {
      const playheadController = PlayheadController.getInstance();
      const isPaused = !playheadController.getIsPlaying();
      const currentNeedleFrame = playheadController.getFrame();
      const seqStart = getSequenceStartFrame(seq);
      const seqDuration = getSequenceDurationFrames(seq, 0);
      const seqEnd = seqStart + seqDuration;

      if (isPaused && (currentNeedleFrame < seqStart || currentNeedleFrame >= seqEnd)) {
        playheadController.seek(seqStart, true);
      }
    }

    if (seq?.modifiers) {
      const transMod = seq.modifiers.find((m: ModifierNode) => m.type === 'transform');
      if (transMod?.params) {
        const p = transMod.params as Record<string, unknown>;
        setTransform({
          x: typeof p.x === 'number' ? p.x : 0,
          y: typeof p.y === 'number' ? p.y : 0,
          scale: typeof p.scale === 'number' ? p.scale : 1.0,
          rotation: typeof p.rotation === 'number' ? p.rotation : 0,
        });
        if (Array.isArray(p.anchorPoint) && p.anchorPoint.length === 2) {
          const pt: [number, number] = [Number(p.anchorPoint[0]), Number(p.anchorPoint[1])];
          setAnchorPoint(pt);
          latestAnchorPoint = pt;
        } else {
          setAnchorPoint([0.5, 0.5]);
          latestAnchorPoint = [0.5, 0.5];
        }
        return;
      }
    }

    setTransform({
      x: 0,
      y: 0,
      scale: 1.0,
      rotation: 0,
    });
    setAnchorPoint([0.5, 0.5]);
    latestAnchorPoint = [0.5, 0.5];
  });

  let dragStartCoords: { clientX: number; clientY: number } | null = null;
  let latestTransform: TransformState = transform();

  createEffect(() => {
    latestTransform = transform();
  });

  const handlePointerDown = (handleType: TransformHandleType, e: PointerEvent) => {
    if (options.isLocked) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    dragStartCoords = { clientX: e.clientX, clientY: e.clientY };
    setIsDragging(true);
    setActiveHandle(handleType);
    startTransform = { ...transform() };
    startAnchorPoint = [...anchorPoint()];

    const mode =
      handleType === 'anchor'
        ? 'anchor'
        : handleType === 'body'
          ? 'move'
          : handleType === 'rotate'
            ? 'rotate'
            : 'scale';
    overlay.setActiveInteraction(handleType, mode === 'anchor' ? 'move' : mode);
  };

  const handlePointerMove = (e: PointerEvent) => {
    const handle = activeHandle();
    if (!isDragging() || !handle || !options.selectedSeqId || options.isLocked || !dragStartCoords)
      return;
    e.stopPropagation();

    const dx = e.clientX - dragStartCoords.clientX;
    const dy = e.clientY - dragStartCoords.clientY;

    const bounds = targetBounds();
    const baseW = Math.max(0.02, bounds.normWidth);
    const baseH = Math.max(0.02, bounds.normHeight);
    const originNormX = bounds.normX;
    const originNormY = bounds.normY;
    const canvasW = options.width;
    const canvasH = options.height;

    const startNormBox: BoundingBox2D = {
      x: originNormX + startTransform.x / canvasW,
      y: originNormY + startTransform.y / canvasH,
      width: baseW * startTransform.scale,
      height: baseH * startTransform.scale,
      rotation: startTransform.rotation,
    };

    const currentPointerNorm = {
      x: originNormX + startTransform.x / canvasW + dx / Math.max(1, options.width),
      y: originNormY + startTransform.y / canvasH + dy / Math.max(1, options.height),
    };
    const startPointerNorm = {
      x: originNormX + startTransform.x / canvasW,
      y: originNormY + startTransform.y / canvasH,
    };

    const isCorner = handle === 'tl' || handle === 'tr' || handle === 'bl' || handle === 'br';
    const lockAspectRatio = isCorner ? !e.shiftKey : false;

    // Dynamic Sibling Harvesting for Magnetic Snapping
    const siblingBoxes: SiblingGuideBox[] = (options.activeSequences || [])
      .filter((s) => s.id !== options.selectedSeqId)
      .map((s) => {
        const b = CanvasHitTester.resolveSequenceBounds(s as any, options.width, options.height, 8);
        return {
          id: s.id,
          label: s.name || b.label || 'Sibling',
          normX: b.normX,
          normY: b.normY,
          normWidth: b.normWidth,
          normHeight: b.normHeight,
        };
      });

    const disableSnapping = !snapEnabled() || e.ctrlKey || e.metaKey;
    const isAxisLocked = axisLock() || (handle === 'body' && e.shiftKey);
    const isCenterScaling = centerScale() || e.altKey;

    const dragRes = Gizmo2DTransformation.computeDragTransform(
      startNormBox,
      handle,
      currentPointerNorm,
      startPointerNorm,
      lockAspectRatio,
      disableSnapping,
      siblingBoxes,
      isCenterScaling,
      isAxisLocked,
      latestAnchorPoint
    );

    if (dragRes.anchorResult) {
      latestAnchorPoint = dragRes.anchorResult;
      setAnchorPoint(dragRes.anchorResult);
    }

    const guides = dragRes.snapResult?.activeGuides || [];
    setActiveGuides(guides);

    const newNormBox = dragRes.box;
    const newTransform: TransformState = {
      x: Math.round((newNormBox.x - originNormX) * canvasW),
      y: Math.round((newNormBox.y - originNormY) * canvasH),
      scale: Number((newNormBox.width / baseW).toFixed(2)),
      rotation: newNormBox.rotation,
    };

    latestTransform = newTransform;
    setTransform(newTransform);
    overlay.update(newNormBox, guides);

    const currentMode =
      handle === 'anchor'
        ? 'anchor'
        : handle === 'body'
          ? 'move'
          : handle === 'rotate'
            ? 'rotate'
            : 'scale';

    setTelemetry({
      mode: currentMode,
      deltaX: newTransform.x,
      deltaY: newTransform.y,
      widthPx: Math.round(newNormBox.width * canvasW),
      heightPx: Math.round(newNormBox.height * canvasH),
      scale: newTransform.scale,
      rotation: newTransform.rotation,
      activeGuides: guides,
      anchorPoint: dragRes.anchorResult || latestAnchorPoint,
      gizmoTool: gizmoTool(),
    });

    if (options.previewEngine?.setEphemeralTransformOverride && options.selectedSeqId) {
      options.previewEngine.setEphemeralTransformOverride(options.selectedSeqId, {
        x: newTransform.x,
        y: newTransform.y,
        scaleX: newTransform.scale,
        scaleY: newTransform.scale,
        rotation: newTransform.rotation,
        anchorPoint: latestAnchorPoint,
        normWidth: bounds.normWidth,
        normHeight: bounds.normHeight,
      });
      options.onRenderFrame?.();
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging()) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    dragStartCoords = null;
    const finalTransform = latestTransform || transform();
    const finalAnchor = latestAnchorPoint || anchorPoint();
    if (options.selectedSeqId && !options.isLocked) {
      IRStateManager.getInstance().updateModifier(options.selectedSeqId, 'transform', {
        ...finalTransform,
        anchorPoint: finalAnchor,
        normWidth: targetBounds().normWidth,
        normHeight: targetBounds().normHeight,
      });
    }
    if (options.previewEngine?.setEphemeralTransformOverride && options.selectedSeqId) {
      options.previewEngine.setEphemeralTransformOverride(options.selectedSeqId, null);
      options.onRenderFrame?.();
    }
    setIsDragging(false);
    setActiveHandle(null);
    setActiveGuides([]);
    setTelemetry(null);
    overlay.setActiveInteraction(null, null);
  };

  // Studio Keyboard Nudging & Shortcuts
  const onKeyDown = (e: KeyboardEvent) => {
    const seqId = options.selectedSeqId;
    if (!seqId || options.isLocked || isDragging()) return;

    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.getAttribute('role') === 'textbox')
    ) {
      return;
    }

    const step = e.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;

    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'Escape') {
      e.preventDefault();
      IRStateManager.getInstance().setSelectedSequenceId(null);
      return;
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      IRStateManager.getInstance().deleteSequence(seqId);
      return;
    } else {
      return;
    }

    e.preventDefault();
    const newT: TransformState = {
      ...latestTransform,
      x: latestTransform.x + dx,
      y: latestTransform.y + dy,
    };
    latestTransform = newT;
    setTransform(newT);
    IRStateManager.getInstance().updateModifier(seqId, 'transform', { ...newT });
    options.onRenderFrame?.();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  }

  return {
    overlayRef: { current: overlay },
    get transform() {
      return transform();
    },
    transformSignal: transform,
    setTransform,
    get targetBounds() {
      return targetBounds();
    },
    targetBoundsSignal: targetBounds,
    get isDragging() {
      return isDragging();
    },
    isDraggingSignal: isDragging,
    get activeHandle() {
      return activeHandle();
    },
    activeHandleSignal: activeHandle,
    get activeGuides() {
      return activeGuides();
    },
    activeGuidesSignal: activeGuides,
    get telemetry() {
      return telemetry();
    },
    telemetrySignal: telemetry,
    hudControls: {
      get tool() {
        return gizmoTool();
      },
      get snapEnabled() {
        return snapEnabled();
      },
      get axisLock() {
        return axisLock();
      },
      get centerScale() {
        return centerScale();
      },
      get anchorPoint() {
        return anchorPoint();
      },
      setTool: setGizmoTool,
      setSnapEnabled,
      setAxisLock,
      setCenterScale,
      setAnchorPoint,
    },
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel: handlePointerUp,
  };
}
