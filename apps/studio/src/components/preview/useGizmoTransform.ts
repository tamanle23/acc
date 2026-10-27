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
  timeline?: any;
  doc?: any;
}

export function useGizmoTransform({
  selectedSeqId,
  width,
  height,
  isLocked,
  timeline,
  doc,
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

    const allSeqs = timeline?.sequences
      ? Array.from(timeline.sequences.values())
      : doc?.tracks?.flatMap((t: any) => t.sequences) || [];
    const seq = allSeqs.find((s: any) => s.id === selectedSeqId);

    if (seq) {
      const playheadController = StudioPlayheadController.getInstance();
      const isPaused = !playheadController.getIsPlaying();
      const currentNeedleFrame = playheadController.getFrame();
      const seqStart = (seq as any).startFrame ?? 0;
      const seqDuration = (seq as any).durationFrames ?? 0;
      const seqEnd = seqStart + seqDuration;

      if (isPaused && (currentNeedleFrame < seqStart || currentNeedleFrame >= seqEnd)) {
        playheadController.seek(seqStart, true);
      }
    }

    if (seq?.modifiers) {
      const transMod = seq.modifiers.find((m: any) => m.type === 'transform');
      if (transMod?.params) {
        const p = transMod.params as any;
        setTransform({
          x: p.x ?? 0,
          y: p.y ?? 0,
          scale: p.scale ?? 1.0,
          rotation: p.rotation ?? 0,
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
      const startNormBox: BoundingBox2D = {
        x: 0.5 + startTransform.x / width,
        y: 0.5 + startTransform.y / height,
        width: baseW * startTransform.scale,
        height: baseH * startTransform.scale,
        rotation: startTransform.rotation,
      };

      const currentPointerNorm = {
        x: 0.5 + (startTransform.x + dx) / width,
        y: 0.5 + (startTransform.y + dy) / height,
      };
      const startPointerNorm = {
        x: 0.5 + startTransform.x / width,
        y: 0.5 + startTransform.y / height,
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
        x: Math.round((newNormBox.x - 0.5) * width),
        y: Math.round((newNormBox.y - 0.5) * height),
        scale: Number((newNormBox.width / baseW).toFixed(2)),
        rotation: newNormBox.rotation,
      };

      setTransform(newTransform);
      overlayRef.current.update(newNormBox, dragRes.snapResult?.activeGuides || []);
    },
    [isDragging, activeHandle, selectedSeqId, isLocked, startTransform, width, height]
  );

  const handleTransformDragEnd = useCallback(
    (_e: DragEndEvent) => {
      if (selectedSeqId && !isLocked) {
        IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', transform as any);
      }
      setIsDragging(false);
      setActiveHandle(null);
      setActiveGuides([]);
      overlayRef.current.setActiveInteraction(null, null);
    },
    [selectedSeqId, isLocked, transform]
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
