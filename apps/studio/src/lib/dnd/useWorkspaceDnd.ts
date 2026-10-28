import { useState, useCallback } from 'react';
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { IRSequence } from '@acc/ir';
import { IRStateManager } from '../ir/irState';
import type { StudioAssetRecord } from '../ir/studioTypes';
import type { StagingPreset } from '../library/stagingPresets';

export interface UseWorkspaceDndOptions {
  currentFrame: number;
  fps: number;
  onSequenceInserted?: () => void;
}

/**
 * Custom hook encapsulating global workspace Drag-and-Drop (@dnd-kit) sensors and
 * drop handlers for staging presets and media assets onto either the Preview canvas
 * or directly onto Timeline tracks (with automatic Linked A/V Split ingestion).
 */
export function useWorkspaceDnd({
  currentFrame,
  fps,
  onSequenceInserted,
}: UseWorkspaceDndOptions) {
  const [activeDragItem, setActiveDragItem] = useState<Record<string, unknown> | null>(null);

  // @dnd-kit PointerSensor with 6px distance activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragItem(null);

      if (!over) return;

      const data = active.data.current;
      if (!data) return;

      if (over.id === 'canvas-viewport-drop-zone') {
        if (data.type === 'preset' && data.preset) {
          const preset = data.preset as StagingPreset;
          const seq = preset.createSequence({
            startFrame: currentFrame,
            normX: 0.5,
            normY: 0.5,
          });
          IRStateManager.getInstance().addSequence(preset.targetTrackId, seq, {
            trackTypeFallback: preset.targetTrackType,
            trackNameFallback: preset.targetTrackName,
          });
          onSequenceInserted?.();
        } else if (data.type === 'asset' && data.asset) {
          const asset = data.asset as StudioAssetRecord;
          const assetId = String(data.assetId || asset.id || 'asset');
          const targetTrackId = asset.type === 'audio' ? 'track-a1' : 'track-v1';
          const targetTrackType = asset.type === 'audio' ? 'audio' : 'video';
          const seqId = `seq_${assetId}_${Date.now().toString(36)}`;
          const durationFrames = asset.durationSec ? Math.round(asset.durationSec * fps) : 90;

          const newSeq: IRSequence = {
            id: seqId,
            name: assetId,
            type: asset.type === 'audio' ? 'audio' : asset.type === 'image' ? 'image' : 'video',
            time: {
              start: currentFrame,
              duration: durationFrames,
            },
            startFrame: currentFrame,
            timelineStartFrame: currentFrame,
            durationFrames,
            assetId,
            modifiers: [],
          };

          IRStateManager.getInstance().addSequence(targetTrackId, newSeq, {
            trackTypeFallback: targetTrackType,
            trackNameFallback: targetTrackId,
          });
          onSequenceInserted?.();
        }
        return;
      }

      // Direct Track Dropping from LeftSidebar Preset or Asset Library
      const overIdStr = String(over.id);
      const overData = over.data.current as { type?: string; trackId?: string } | undefined;
      if (overIdStr.startsWith('track-') || overData?.type === 'track') {
        const targetTrackId = overData?.trackId || overIdStr.replace(/^track-/, '');

        // Calculate drop frame from translated pointer coordinate relative to target lane
        let dropFrame = currentFrame;
        const zoomScale = 1.0; // default baseline zoom scale
        const pixelsPerFrame = Math.max(1, 4 * zoomScale);

        if (event.active.rect.current.translated && over.rect) {
          const relX = event.active.rect.current.translated.left - over.rect.left;
          if (relX > 0) {
            dropFrame = Math.max(0, Math.round(relX / pixelsPerFrame));
          } else {
            dropFrame = currentFrame;
          }
        }

        // Magnetic Snapping check against current playhead
        if (Math.abs(dropFrame - currentFrame) <= 4) {
          dropFrame = currentFrame;
        }

        if (data.type === 'preset' && data.preset) {
          const preset = data.preset as StagingPreset;
          const seq = preset.createSequence({
            startFrame: dropFrame,
            normX: 0.5,
            normY: 0.5,
          });
          IRStateManager.getInstance().addSequence(targetTrackId, seq, {
            trackTypeFallback: preset.targetTrackType,
            trackNameFallback: preset.targetTrackName,
          });
          onSequenceInserted?.();
        } else if (data.type === 'asset' && data.asset) {
          const asset = data.asset as StudioAssetRecord;
          const assetId = String(data.assetId || asset.id || 'asset');
          const durationFrames = asset.durationSec ? Math.round(asset.durationSec * fps) : 90;

          // Check if asset is video with audio -> Ingest with Linked A/V Split Engine
          if (asset.type === 'video' && asset.hasAudio !== false) {
            const timestamp = Date.now().toString(36);
            const vSeqId = `seq_${assetId}_v_${timestamp}`;
            const aSeqId = `seq_${assetId}_a_${timestamp}`;
            const audioTrackId = 'track-a1';

            const videoSeq: IRSequence = {
              id: vSeqId,
              name: `${assetId} (Video)`,
              type: 'video',
              time: {
                start: dropFrame,
                duration: durationFrames,
              },
              startFrame: dropFrame,
              timelineStartFrame: dropFrame,
              durationFrames,
              assetId,
              modifiers: [
                {
                  id: `mod_link_${vSeqId}`,
                  type: 'editorial/av_link',
                  params: {
                    linkedSequenceId: aSeqId,
                    linkedTrackId: audioTrackId,
                    enabled: true,
                    syncTrim: true,
                  },
                },
              ],
            };

            const audioSeq: IRSequence = {
              id: aSeqId,
              name: `${assetId} (Audio)`,
              type: 'audio',
              time: {
                start: dropFrame,
                duration: durationFrames,
              },
              startFrame: dropFrame,
              timelineStartFrame: dropFrame,
              durationFrames,
              assetId,
              modifiers: [
                {
                  id: `mod_link_${aSeqId}`,
                  type: 'editorial/av_link',
                  params: {
                    linkedSequenceId: vSeqId,
                    linkedTrackId: targetTrackId,
                    enabled: true,
                    syncTrim: true,
                  },
                },
              ],
            };

            IRStateManager.getInstance().addLinkedAVSequences({
              videoSequence: videoSeq,
              audioSequence: audioSeq,
              videoTrackId: targetTrackId,
              audioTrackId,
            });
          } else {
            // Standard single sequence ingestion (Pure Audio or Video without audio stream)
            const targetTrackType = asset.type === 'audio' ? 'audio' : 'video';
            const seqId = `seq_${assetId}_${Date.now().toString(36)}`;
            const newSeq: IRSequence = {
              id: seqId,
              name: assetId,
              type: asset.type === 'audio' ? 'audio' : asset.type === 'image' ? 'image' : 'video',
              time: {
                start: dropFrame,
                duration: durationFrames,
              },
              startFrame: dropFrame,
              timelineStartFrame: dropFrame,
              durationFrames,
              assetId,
              modifiers: [],
            };

            IRStateManager.getInstance().addSequence(targetTrackId, newSeq, {
              trackTypeFallback: targetTrackType,
              trackNameFallback: targetTrackId,
            });
          }
          onSequenceInserted?.();
        }
      }
    },
    [currentFrame, fps, onSequenceInserted]
  );

  return {
    sensors,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
  };
}
