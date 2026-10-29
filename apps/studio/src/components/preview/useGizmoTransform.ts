import { useState, useRef, useEffect, useCallback } from 'react';
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { IRStateManager } from '../../lib/ir/irState';
import {
  getSequenceDurationFrames,
  getSequenceStartFrame,
  type StudioSequence,
} from '../../lib/ir/studioTypes';
import type { ModifierNode, ResolvedTimeline, VideoIRDocument } from '@acc/ir';
import { StudioPlayheadController } from '../../lib/playhead/StudioPlayheadController';
import {
  Gizmo2DTransformation,
  type BoundingBox2D,
  type SnappingGuide,
  type TransformHandleType,
} from '../../lib/gizmo';

export interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
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
}

export function useGizmoTransform({
  selectedSeqId,
  width,
  height,
  isLocked,
  timeline,
  doc,
  previewEngine,
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
  const [startTransform, setStartTransform] = useState<TransformState>({
    x: 0,
    y: 0,
    scale: 1.0,
    rotation: 0,
  });

  // Sync transform state from selected sequence modifier if available, and auto-seek when paused
  useEffect(() => {
    if (!selectedSeqId) {
      setTransform({ x: 0, y: 0, scale: 1.0, rotation: 0 });
      return;
    }

    const allSeqs: StudioSequence[] = timeline?.sequences
      ? Array.from(timeline.sequences.values())
      : doc?.tracks?.flatMap((t) => t.sequences) || [];
    const seq = allSeqs.find((s) => s.id === selectedSeqId);

    if (seq) {
      const playheadController = StudioPlayheadController.getInstance();
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
        return;
      }
    }

    setTransform({
      x: 0,
      y: 0,
      scale: 1.0,
      rotation: 0,
    });
  }, [selectedSeqId, timeline, doc]);

  const transformSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleTransformDragStart = useCallback(
    (e: DragStartEvent) => {
      if (isLocked) return;
      const data = e.active.data.current;
      if (!data) return;

      const handleType = data.handleType as TransformHandleType;
      setIsDragging(true);
      setActiveHandle(handleType);
      setStartTransform({ ...transform });

      const mode = handleType === 'body' ? 'move' : handleType === 'rotate' ? 'rotate' : 'resize';
      overlayRef.current.setActiveInteraction(handleType, mode);
    },
    [isLocked, transform]
  );

  const handleTransformDragMove = useCallback(
    (e: DragMoveEvent) => {
      if (!isDragging || !activeHandle || !selectedSeqId || isLocked) return;

      const dx = e.delta.x;
      const dy = e.delta.y;

      const baseW = 0.5;
      const baseH = 0.5;
      const canvasW = 1920;
      const canvasH = 1080;

      const startNormBox: BoundingBox2D = {
        x: 0.5 + startTransform.x / canvasW,
        y: 0.5 + startTransform.y / canvasH,
        width: baseW * startTransform.scale,
        height: baseH * startTransform.scale,
        rotation: startTransform.rotation,
      };

      const currentPointerNorm = {
        x: 0.5 + (startTransform.x / canvasW) + (dx / Math.max(1, width)),
        y: 0.5 + (startTransform.y / canvasH) + (dy / Math.max(1, height)),
      };
      const startPointerNorm = {
        x: 0.5 + startTransform.x / canvasW,
        y: 0.5 + startTransform.y / canvasH,
      };

      const dragRes = Gizmo2DTransformation.computeDragTransform(
        startNormBox,
        activeHandle,
        currentPointerNorm,
        startPointerNorm,
        false,
        false
      );

      if (dragRes.snapResult) {
        setActiveGuides(dragRes.snapResult.activeGuides);
      } else {
        setActiveGuides([]);
      }

      const newNormBox = dragRes.box;
      const newTransform: TransformState = {
        x: Math.round((newNormBox.x - 0.5) * canvasW),
        y: Math.round((newNormBox.y - 0.5) * canvasH),
        scale: Number((newNormBox.width / baseW).toFixed(2)),
        rotation: newNormBox.rotation,
      };

      setTransform(newTransform);
      overlayRef.current.update(newNormBox, dragRes.snapResult?.activeGuides || []);

      if (previewEngine?.setEphemeralTransformOverride && selectedSeqId) {
        previewEngine.setEphemeralTransformOverride(selectedSeqId, {
          x: newTransform.x,
          y: newTransform.y,
          scaleX: newTransform.scale,
          scaleY: newTransform.scale,
          rotation: newTransform.rotation,
        });
      }
    },
    [isDragging, activeHandle, selectedSeqId, isLocked, startTransform, width, height, previewEngine]
  );

  const handleTransformDragEnd = useCallback(
    (_e: DragEndEvent) => {
      if (selectedSeqId && !isLocked) {
        IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', { ...transform });
      }
      if (previewEngine?.setEphemeralTransformOverride && selectedSeqId) {
        previewEngine.setEphemeralTransformOverride(selectedSeqId, null);
      }
      setIsDragging(false);
      setActiveHandle(null);
      setActiveGuides([]);
      overlayRef.current.setActiveInteraction(null, null);
    },
    [selectedSeqId, isLocked, transform, previewEngine]
  );

  return {
    overlayRef,
    transform,
    setTransform,
    isDragging,
    activeHandle,
    activeGuides,
    transformSensors,
    handleTransformDragStart,
    handleTransformDragMove,
    handleTransformDragEnd,
  };
}
