import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
} from '../../lib/gizmo';
import { CanvasHitTester, type SequenceBounds } from '../../lib/hit-test/CanvasHitTester';

export interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface GizmoTelemetry {
  mode: 'move' | 'scale' | 'rotate' | null;
  deltaX: number;
  deltaY: number;
  widthPx: number;
  heightPx: number;
  scale: number;
  rotation: number;
  activeGuides: SnappingGuide[];
}

export interface UseGizmoTransformOptions {
  selectedSeqId: string | null;
  width: number;
  height: number;
  isLocked: boolean;
  timeline?: ResolvedTimeline | null;
  doc?: VideoIRDocument | null;
  previewEngine?: {
    setEphemeralTransformOverride?: (sequenceId: string, override: any) => void;
  } | null;
  onRenderFrame?: () => void;
}

export function useGizmoTransform({
  selectedSeqId,
  width,
  height,
  isLocked,
  timeline,
  doc,
  previewEngine,
  onRenderFrame,
}: UseGizmoTransformOptions) {
  const overlayRef = useRef<Gizmo2DTransformation>(new Gizmo2DTransformation());
  const [transform, setTransform] = useState<TransformState>({
    x: 0,
    y: 0,
    scale: 1.0,
    rotation: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<TransformHandleType | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnappingGuide[]>([]);
  const [telemetry, setTelemetry] = useState<GizmoTelemetry | null>(null);
  const [startTransform, setStartTransform] = useState<TransformState>({
    x: 0,
    y: 0,
    scale: 1.0,
    rotation: 0,
  });

  // Resolve active selected sequence
  const allSeqs: StudioSequence[] = useMemo(() => {
    return timeline?.sequences
      ? Array.from(timeline.sequences.values())
      : doc?.tracks?.flatMap((t) => t.sequences) || [];
  }, [timeline, doc]);

  const selectedSeq = useMemo(() => {
    return allSeqs.find((s) => s.id === selectedSeqId);
  }, [allSeqs, selectedSeqId]);

  // Compute dynamic target bounds with 8px breathing padding
  const targetBounds: SequenceBounds = useMemo(() => {
    if (!selectedSeq) {
      return {
        normX: 0.5,
        normY: 0.5,
        normWidth: 0.5,
        normHeight: 0.5,
        label: '',
        sequenceType: 'video',
      };
    }
    return CanvasHitTester.resolveSequenceBounds(selectedSeq as any, width, height, 8);
  }, [selectedSeq, width, height]);

  // Sync transform state from selected sequence modifier if available, and auto-seek when paused
  useEffect(() => {
    if (isDragging) return;
    if (!selectedSeqId) {
      setTransform({ x: 0, y: 0, scale: 1.0, rotation: 0 });
      setTelemetry(null);
      return;
    }

    if (selectedSeq) {
      const playheadController = PlayheadController.getInstance();
      const isPaused = !playheadController.getIsPlaying();
      const currentNeedleFrame = playheadController.getFrame();
      const seqStart = getSequenceStartFrame(selectedSeq);
      const seqDuration = getSequenceDurationFrames(selectedSeq, 0);
      const seqEnd = seqStart + seqDuration;

      if (isPaused && (currentNeedleFrame < seqStart || currentNeedleFrame >= seqEnd)) {
        playheadController.seek(seqStart, true);
      }
    }

    if (selectedSeq?.modifiers) {
      const transMod = selectedSeq.modifiers.find((m: ModifierNode) => m.type === 'transform');
      if (transMod?.params) {
        const p = transMod.params as Record<string, unknown>;
        setTransform({
          x: typeof p.x === 'number' ? p.x : 0,
          y: typeof p.y === 'number' ? p.y : 0,
          scale: typeof p.scale === 'number' ? p.scale : 1.0,
          rotation: typeof p.rotation === 'number' ? p.rotation : 0,
        });
        return;
      }
    }

    setTransform({
      x: 0,
      y: 0,
      scale: 1.0,
      rotation: 0,
    });
  }, [selectedSeqId, selectedSeq]);

  const dragStartCoordsRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const latestTransformRef = useRef<TransformState>(transform);

  useEffect(() => {
    latestTransformRef.current = transform;
  }, [transform]);

  const handlePointerDown = useCallback(
    (handleType: TransformHandleType, e: React.PointerEvent) => {
      if (isLocked) return;
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}

      dragStartCoordsRef.current = { clientX: e.clientX, clientY: e.clientY };
      setIsDragging(true);
      setActiveHandle(handleType);
      setStartTransform({ ...transform });

      const mode = handleType === 'body' ? 'move' : handleType === 'rotate' ? 'rotate' : 'scale';
      overlayRef.current.setActiveInteraction(handleType, mode);
    },
    [isLocked, transform]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !activeHandle || !selectedSeqId || isLocked || !dragStartCoordsRef.current) return;
      e.stopPropagation();

      const dx = e.clientX - dragStartCoordsRef.current.clientX;
      const dy = e.clientY - dragStartCoordsRef.current.clientY;

      const baseW = Math.max(0.02, targetBounds.normWidth);
      const baseH = Math.max(0.02, targetBounds.normHeight);
      const originNormX = targetBounds.normX;
      const originNormY = targetBounds.normY;
      const canvasW = width;
      const canvasH = height;

      const startNormBox: BoundingBox2D = {
        x: originNormX + startTransform.x / canvasW,
        y: originNormY + startTransform.y / canvasH,
        width: baseW * startTransform.scale,
        height: baseH * startTransform.scale,
        rotation: startTransform.rotation,
      };

      const currentPointerNorm = {
        x: originNormX + startTransform.x / canvasW + dx / Math.max(1, width),
        y: originNormY + startTransform.y / canvasH + dy / Math.max(1, height),
      };
      const startPointerNorm = {
        x: originNormX + startTransform.x / canvasW,
        y: originNormY + startTransform.y / canvasH,
      };

      // Pro NLE Scaling interaction: Corner handles scale uniformly by default (Shift to free-scale).
      // Edge handles stretch single axis.
      const isCorner = activeHandle === 'tl' || activeHandle === 'tr' || activeHandle === 'bl' || activeHandle === 'br';
      const lockAspectRatio = isCorner ? !e.shiftKey : false;

      const dragRes = Gizmo2DTransformation.computeDragTransform(
        startNormBox,
        activeHandle,
        currentPointerNorm,
        startPointerNorm,
        lockAspectRatio,
        false
      );

      const guides = dragRes.snapResult?.activeGuides || [];
      setActiveGuides(guides);

      const newNormBox = dragRes.box;
      const newTransform: TransformState = {
        x: Math.round((newNormBox.x - originNormX) * canvasW),
        y: Math.round((newNormBox.y - originNormY) * canvasH),
        scale: Number((newNormBox.width / baseW).toFixed(2)),
        rotation: newNormBox.rotation,
      };

      latestTransformRef.current = newTransform;
      setTransform(newTransform);
      overlayRef.current.update(newNormBox, guides);

      // Update Live Telemetry HUD state
      const currentMode = activeHandle === 'body' ? 'move' : activeHandle === 'rotate' ? 'rotate' : 'scale';
      setTelemetry({
        mode: currentMode,
        deltaX: newTransform.x,
        deltaY: newTransform.y,
        widthPx: Math.round(newNormBox.width * canvasW),
        heightPx: Math.round(newNormBox.height * canvasH),
        scale: newTransform.scale,
        rotation: newTransform.rotation,
        activeGuides: guides,
      });

      if (previewEngine?.setEphemeralTransformOverride && selectedSeqId) {
        previewEngine.setEphemeralTransformOverride(selectedSeqId, {
          x: newTransform.x,
          y: newTransform.y,
          scaleX: newTransform.scale,
          scaleY: newTransform.scale,
          rotation: newTransform.rotation,
        });
        onRenderFrame?.();
      }
    },
    [
      isDragging,
      activeHandle,
      selectedSeqId,
      isLocked,
      startTransform,
      targetBounds,
      width,
      height,
      previewEngine,
      onRenderFrame,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      dragStartCoordsRef.current = null;
      const finalTransform = latestTransformRef.current || transform;
      if (selectedSeqId && !isLocked) {
        IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', { ...finalTransform });
      }
      if (previewEngine?.setEphemeralTransformOverride && selectedSeqId) {
        previewEngine.setEphemeralTransformOverride(selectedSeqId, null);
        onRenderFrame?.();
      }
      setIsDragging(false);
      setActiveHandle(null);
      setActiveGuides([]);
      setTelemetry(null);
      overlayRef.current.setActiveInteraction(null, null);
    },
    [isDragging, selectedSeqId, isLocked, transform, previewEngine, onRenderFrame]
  );

  // Studio Keyboard Nudging & Shortcuts
  useEffect(() => {
    if (!selectedSeqId || isLocked || isDragging) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
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
        IRStateManager.getInstance().deleteSequence(selectedSeqId);
        return;
      } else {
        return;
      }

      e.preventDefault();
      const newT: TransformState = {
        ...latestTransformRef.current,
        x: latestTransformRef.current.x + dx,
        y: latestTransformRef.current.y + dy,
      };
      latestTransformRef.current = newT;
      setTransform(newT);
      IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', { ...newT });
      onRenderFrame?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSeqId, isLocked, isDragging, onRenderFrame]);

  return {
    overlayRef,
    transform,
    setTransform,
    targetBounds,
    isDragging,
    activeHandle,
    activeGuides,
    telemetry,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel: handlePointerUp,
  };
}
