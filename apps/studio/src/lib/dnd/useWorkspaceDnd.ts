import { createSignal, type Accessor } from 'solid-js';
import { PointerSensor } from '@dnd-kit/solid';
import type { IRSequence } from '@acc/ir';
import { IRStateManager } from '../ir/irState';
import type { StudioAssetRecord } from '../ir/studioTypes';
import type { StagingPreset } from '../library/stagingPresets';

export interface UseWorkspaceDndOptions {
  currentFrame: number | (() => number);
  fps: number | (() => number);
  timelineScrollLeft?: number | (() => number);
  timelineZoomScale?: number | (() => number);
  onSequenceInserted?: () => void;
}

export type WorkspaceDragPayload =
  | { type: 'preset'; presetId?: string; category?: string; presetData?: any; preset?: StagingPreset }
  | { type: 'asset'; assetId?: string; asset: StudioAssetRecord }
  | { type: 'clip'; clipId?: string; seqId?: string; trackId: string; startFrame: number; durationFrames?: number; seq?: IRSequence }
  | { type: 'trim'; handle: 'start' | 'end'; seqId: string; trackId: string; startFrame: number; durationFrames: number; seq?: IRSequence };

function resolveVal<T>(val: T | (() => T) | undefined, fallback: T): T {
  if (val === undefined) return fallback;
  return typeof val === 'function' ? (val as () => T)() : val;
}

/**
 * useWorkspaceDnd / createWorkspaceDnd:
 * Encapsulates global workspace Drag-and-Drop (@dnd-kit/solid) state and
 * drop handlers for staging presets and media assets onto either the Preview canvas
 * or directly onto Timeline tracks (with automatic Linked A/V Split ingestion).
 */
export function useWorkspaceDnd(options: UseWorkspaceDndOptions) {
  const [activeDragItem, setActiveDragItem] = createSignal<Record<string, any> | null>(null);

  const getCurrentFrame = () => resolveVal(options.currentFrame, 0);
  const getFps = () => resolveVal(options.fps, 30);
  const getTimelineScrollLeft = () => resolveVal(options.timelineScrollLeft, 0);
  const getTimelineZoomScale = () => resolveVal(options.timelineZoomScale, 1.65);

  const handleDragStart = (event: any) => {
    const data = event?.operation?.source?.data || event?.source?.data || event?.active?.data?.current;
    setActiveDragItem(data ?? null);
  };

  const handleDragEnd = (event: any) => {
    setActiveDragItem(null);

    const source = event?.operation?.source || event?.active;
    const target = event?.operation?.target || event?.over;

    if (!target) return;

    const data = source?.data || source?.data?.current;
    if (!data) return;

    if (data.type !== 'preset' && data.type !== 'asset') {
      return;
    }

    const currentFrame = getCurrentFrame();
    const fps = getFps();
    const timelineScrollLeft = getTimelineScrollLeft();
    const timelineZoomScale = getTimelineZoomScale();

    const targetId = String(target.id ?? '');

    if (targetId === 'canvas-viewport-drop-zone') {
      let normX = 0.5;
      let normY = 0.5;

      const sourceRect = event?.operation?.position || source?.rect;
      const targetRect = target?.rect || target?.element?.getBoundingClientRect?.();

      if (sourceRect && targetRect && targetRect.width > 0 && targetRect.height > 0) {
        const left = sourceRect.x ?? sourceRect.left ?? 0;
        const top = sourceRect.y ?? sourceRect.top ?? 0;
        const relX = left - targetRect.left;
        const relY = top - targetRect.top;
        normX = Math.max(0.05, Math.min(0.95, relX / targetRect.width));
        normY = Math.max(0.05, Math.min(0.95, relY / targetRect.height));
      }

      if (data.type === 'preset' && data.preset) {
        const preset = data.preset as StagingPreset;
        const seq = preset.createSequence({
          startFrame: currentFrame,
          normX,
          normY,
        });
        IRStateManager.getInstance().addSequence(preset.targetTrackId, seq, {
          trackTypeFallback: preset.targetTrackType,
          trackNameFallback: preset.targetTrackName,
        });
        options.onSequenceInserted?.();
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
          modifiers: [
            {
              type: 'transform',
              target: ['video', 'image'],
              params: {
                normX,
                normY,
                x: 0,
                y: 0,
                scale: 1.0,
                rotation: 0,
              },
            },
          ],
        };

        IRStateManager.getInstance().addSequence(targetTrackId, newSeq, {
          trackTypeFallback: targetTrackType,
          trackNameFallback: targetTrackId,
        });
        options.onSequenceInserted?.();
      }
      return;
    }

    // Direct Track Dropping (either dropped on the track lane or onto a clip within the track)
    const targetData = target?.data as { type?: string; trackId?: string } | undefined;
    const isTrackTarget = targetId.startsWith('track-') || targetData?.type === 'track';
    const isClipTarget = targetId.startsWith('clip-') || targetData?.type === 'clip';

    if (isTrackTarget || isClipTarget) {
      const targetTrackId = targetData?.trackId || (isTrackTarget ? targetId.replace(/^track-/, '') : '');
      if (!targetTrackId) return;
      let dropFrame = currentFrame;
      const pixelsPerFrame = Math.max(0.2, 1.5 * timelineZoomScale);

      const sourceRect = event?.operation?.position || source?.rect;
      const targetRect = target?.rect || target?.element?.getBoundingClientRect?.();

      if (sourceRect && targetRect) {
        const left = sourceRect.x ?? sourceRect.left ?? 0;
        const relX = left - targetRect.left + timelineScrollLeft;
        if (relX > 0) {
          dropFrame = Math.max(0, Math.floor(relX / pixelsPerFrame));
        }
      }

      const snapThreshold = Math.max(2, Math.round(6 / pixelsPerFrame));
      if (Math.abs(dropFrame - currentFrame) <= snapThreshold) {
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
        options.onSequenceInserted?.();
      } else if (data.type === 'asset' && data.asset) {
        const asset = data.asset as StudioAssetRecord;
        const assetId = String(data.assetId || asset.id || 'asset');
        const durationFrames = asset.durationSec ? Math.round(asset.durationSec * fps) : 90;

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
        options.onSequenceInserted?.();
      }
    }
  };

  return {
    get activeDragItem() {
      return activeDragItem();
    },
    activeDragItemSignal: activeDragItem,
    handleDragStart,
    handleDragEnd,
  };
}
