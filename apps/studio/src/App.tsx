import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Titlebar } from './components/Titlebar';
import { LeftSidebar, DragOverlayPreview, type LeftNavTab } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { Preview } from './components/Preview';
import { Timeline } from './components/Timeline';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Progress,
  Button,
  Badge,
  TooltipProvider,
} from './components/ui';
import { MediabunnyClientSink } from '@acc/ir/client';
import { IRPreviewEngine } from '@acc/ir';
import { AssetTextureCache } from './lib/textures/AssetTextureCache';
import { Video, AlertCircle } from 'lucide-react';
import { IRStateManager } from './lib/ir/irState';
import type { StagingPreset } from './lib/library/stagingPresets';
import { ThemeProvider } from './lib/theme/ThemeProvider';
import { SettingsModal } from './components/SettingsModal';

import { WebAudioEngine } from './lib/audio/WebAudioEngine';
import { useShuttleEngine } from './lib/shuttle/useShuttleEngine';
import { snapToDiscreteFrame } from './lib/shuttle/shuttleTypes';
import { StudioPlayheadController } from './lib/playhead/StudioPlayheadController';

function StudioWorkspace() {
  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());
  const [currentFrame, setCurrentFrame] = useState(0);
  const currentFrameRef = useRef(currentFrame);
  currentFrameRef.current = currentFrame;

  // Enterprise Dual-Sidebar Workspace Layout
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [activeNav, setActiveNav] = useState<LeftNavTab>('vault');
  const [activeDragItem, setActiveDragItem] = useState<any>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const cancelExportRef = useRef(false);

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  // Global Workspace Hotkeys: [ (left drawer), ] (right inspector), \ (zen mode)
  // J, K, L, Space, and Arrow keys are handled with discrete frame accuracy by useShuttleEngine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === '[') {
        setIsLeftOpen((prev) => !prev);
      } else if (e.key === ']') {
        setIsRightOpen((prev) => !prev);
      } else if (e.key === '\\') {
        setIsLeftOpen((prevLeft) => {
          const anyOpen = prevLeft || isRightOpen;
          setIsRightOpen(!anyOpen);
          return !anyOpen;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRightOpen]);

  // @dnd-kit PointerSensor with 6px distance activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
        setIsRightOpen(true);
      } else if (data.type === 'asset' && data.asset) {
        const asset = data.asset;
        const assetId = data.assetId;
        const targetTrackId = asset.type === 'audio' ? 'track-a1' : 'track-v1';
        const targetTrackType = asset.type === 'audio' ? 'audio' : 'video';
        const seqId = `seq_${assetId}_${Date.now().toString(36)}`;

        const newSeq = {
          id: seqId,
          name: assetId,
          startFrame: currentFrame,
          timelineStartFrame: currentFrame,
          durationFrames: asset.durationSec ? Math.round(asset.durationSec * fps) : 90,
          assetId,
          modifiers: [],
        };

        IRStateManager.getInstance().addSequence(targetTrackId, newSeq as any, {
          trackTypeFallback: targetTrackType,
          trackNameFallback: targetTrackId,
        });
        setIsRightOpen(true);
      }
      return;
    }

    // Direct Track Dropping from LeftSidebar Preset or Asset Library
    const overIdStr = String(over.id);
    if (overIdStr.startsWith('track-') || (over.data.current as any)?.type === 'track') {
      const targetTrackId = (over.data.current as any)?.trackId || overIdStr.replace(/^track-/, '');

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
        setIsRightOpen(true);
      } else if (data.type === 'asset' && data.asset) {
        const asset = data.asset;
        const assetId = data.assetId;
        const durationFrames = asset.durationSec ? Math.round(asset.durationSec * fps) : 90;

        // Check if asset is video with audio -> Ingest with Linked A/V Split Engine
        if (asset.type === 'video' && asset.hasAudio !== false) {
          const timestamp = Date.now().toString(36);
          const vSeqId = `seq_${assetId}_v_${timestamp}`;
          const aSeqId = `seq_${assetId}_a_${timestamp}`;
          const audioTrackId = 'track-a1';

          const videoSeq = {
            id: vSeqId,
            name: `${assetId} (Video)`,
            startFrame: dropFrame,
            timelineStartFrame: dropFrame,
            durationFrames,
            assetId,
            modifiers: [
              {
                id: `mod_link_${vSeqId}`,
                type: 'editorial/av_link' as const,
                params: {
                  linkedSequenceId: aSeqId,
                  linkedTrackId: audioTrackId,
                  enabled: true,
                  syncTrim: true,
                },
              },
            ],
          };

          const audioSeq = {
            id: aSeqId,
            name: `${assetId} (Audio)`,
            startFrame: dropFrame,
            timelineStartFrame: dropFrame,
            durationFrames,
            assetId,
            modifiers: [
              {
                id: `mod_link_${aSeqId}`,
                type: 'editorial/av_link' as const,
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
            videoSeq: videoSeq as any,
            audioSeq: audioSeq as any,
            videoTrackId: targetTrackId,
            audioTrackId,
          });
        } else {
          // Standard single sequence ingestion (Pure Audio or Video without audio stream)
          const targetTrackType = asset.type === 'audio' ? 'audio' : 'video';
          const seqId = `seq_${assetId}_${Date.now().toString(36)}`;
          const newSeq = {
            id: seqId,
            name: assetId,
            startFrame: dropFrame,
            timelineStartFrame: dropFrame,
            durationFrames,
            assetId,
            modifiers: [],
          };

          IRStateManager.getInstance().addSequence(targetTrackId, newSeq as any, {
            trackTypeFallback: targetTrackType,
            trackNameFallback: targetTrackId,
          });
        }
        setIsRightOpen(true);
      }
    }
  };

  const fps = irState.doc.meta.globalFps || 30;
  const totalFrames = irState.timeline?.totalFrames || 300;
  const width = irState.doc.meta.canvasSize.w || 1920;
  const height = irState.doc.meta.canvasSize.h || 1080;

  // Sync StudioPlayheadController configuration
  useEffect(() => {
    StudioPlayheadController.getInstance().setConfig(fps, totalFrames);
  }, [fps, totalFrames]);

  // Subscribe low-frequency updates to sync React state (e.g. for clip inspector) without per-frame re-renders
  useEffect(() => {
    return StudioPlayheadController.getInstance().subscribeLowFrequency((frame) => {
      setCurrentFrame(frame);
      currentFrameRef.current = frame;
    });
  }, []);

  const handleScrub = (frame: number) => {
    const discrete = snapToDiscreteFrame(frame);
    const clamped = Math.max(0, Math.min(discrete, totalFrames));
    currentFrameRef.current = clamped;
    StudioPlayheadController.getInstance().seek(clamped, !shuttle.isPlaying);
    if (!shuttle.isPlaying) {
      WebAudioEngine.getInstance().playScrubFeedback(clamped, fps, irState);
    }
  };

  // Frame-Accurate J-K-L Shuttle Engine with Discrete Frame Snapping & Audio Clock Sync
  const shuttle = useShuttleEngine({
    currentFrame,
    totalFrames,
    fps,
    onScrub: handleScrub,
    irState,
    enableKeybindings: true,
  });

  const isPlaying = shuttle.isPlaying;

  useEffect(() => {
    StudioPlayheadController.getInstance().setIsPlaying(isPlaying);
  }, [isPlaying]);

  const handleTogglePlay = () => {
    shuttle.togglePlay();
  };


  const handleStartExport = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);
      cancelExportRef.current = false;

      const sink = new MediabunnyClientSink();
      await sink.initialize({
        width,
        height,
        fps,
        format: 'mp4',
        codec: 'avc1.42E01E',
        videoBitrate: 4_000_000,
        enableAudio: true,
      });

      let offscreenCanvas: HTMLCanvasElement | null = null;
      let ctx: CanvasRenderingContext2D | null = null;

      if (typeof document !== 'undefined') {
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      }

      // Initialize IRPreviewEngine with active timeline if available
      const previewEngine = irState.timeline ? new IRPreviewEngine(irState.timeline) : null;
      const studioTextureCache = AssetTextureCache.getInstance();
      const assetsMap = irState.doc?.assets || {};
      const engineTextures = previewEngine ? previewEngine.getTextureCache() : null;

      // Determine popOutIntensity from depth modifiers if present
      let popOutIntensity = 1.0;
      if (irState.timeline?.sequences) {
        for (const seq of irState.timeline.sequences.values()) {
          if (seq.modifiers) {
            for (const mod of seq.modifiers) {
              if (mod.type === 'vfx/depth3d') {
                const p = mod.params as any;
                if (typeof p?.popOutIntensity === 'number') popOutIntensity = p.popOutIntensity;
              }
            }
          }
        }
      }

      for (let f = 0; f < totalFrames; f++) {
        if (cancelExportRef.current) {
          console.warn('Client export cancelled by user.');
          break;
        }

        let rgba: Uint8Array;
        if (ctx && offscreenCanvas) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          if (previewEngine && engineTextures) {
            // Lazy texture loading for active sequences at frame f
            const activeSeqs = irState.intervalTree?.queryActive(f) || [];
            for (const seq of activeSeqs) {
              if (seq.assetId) {
                const assetDef = assetsMap[seq.assetId];
                const assetSrc = assetDef?.src;
                const assetType = assetDef?.type;
                const seqStart = seq.startFrame ?? 0;
                const seqLocalTimeSec = Math.max(0, (f - seqStart) / fps);

                const visualAsset = studioTextureCache.getVisualAsset(
                  seq.assetId,
                  assetSrc,
                  (assetType as any),
                  seqLocalTimeSec
                );

                if (visualAsset.source) {
                  engineTextures.set(seq.assetId, visualAsset.source);
                }
              }
            }

            previewEngine.renderFrame(f, ctx, {
              textureCache: engineTextures,
              popOutIntensity,
            });
          }

          const imgData = ctx.getImageData(0, 0, width, height);
          rgba = new Uint8Array(imgData.data.buffer);
        } else {
          rgba = new Uint8Array(width * height * 4).fill(0);
        }

        await sink.consumeFrame(f, rgba);
        setExportProgress(Math.round(((f + 1) / totalFrames) * 85));
      }

      if (!cancelExportRef.current) {
        setExportProgress(90);

        // Mix timeline audio using UniversalAudioMixer
        let audioMixResult: any = undefined;
        try {
          const resolvedTracks = irState.timeline?.tracks
            ? (irState.timeline.tracks instanceof Map
                ? Array.from(irState.timeline.tracks.values())
                : irState.timeline.tracks)
            : [];
          const audioTracks = resolvedTracks.filter((t: any) => t.type === 'audio');
          if (audioTracks.length > 0) {
            const sampleRate = 48000;
            const totalDurationSec = totalFrames / fps;
            const totalSamples = Math.floor(totalDurationSec * sampleRate);
            const mixer = new UniversalAudioMixer([], sampleRate);

            // Populate clips from compiled audio sequences
            for (const track of audioTracks) {
              const sequences = Array.isArray(track.sequences)
                ? track.sequences
                : track.sequences instanceof Map
                ? Array.from(track.sequences.values())
                : [];
              for (const seq of sequences) {
                const startSec = (seq.startFrame ?? 0) / fps;
                const durationSec = (seq.durationFrames ?? 30) / fps;
                const isVoice = track.id?.includes('voice') || seq.name?.toLowerCase().includes('voice');
                mixer.addClip({
                  id: seq.id,
                  type: isVoice ? 'voice' : 'bgm',
                  startTimeSec: startSec,
                  durationSec: durationSec,
                  volume: 0.85,
                  assetId: seq.assetId,
                  modifiers: seq.modifiers,
                });
              }
            }

            const mix = mixer.mixStereo(0, totalDurationSec);
            audioMixResult = {
              totalSamples,
              sampleRate,
              channels: 2,
              durationSeconds: totalDurationSec,
              buffer: new Float32Array(totalSamples * 2),
              pcmLeft: mix.left,
              pcmRight: mix.right,
            };
          }
        } catch (audioErr) {
          console.warn('Audio mixing for export encountered an error, falling back to silent/video-only:', audioErr);
        }

        setExportProgress(95);
        const result = await sink.finalize(audioMixResult);
        setExportProgress(100);
        const exportBuffer = result.buffer || sink.getBuffer();

        if (exportBuffer && typeof document !== 'undefined' && typeof URL !== 'undefined') {
          const blob = new Blob([exportBuffer], { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `video-ir-export-${Date.now()}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }

        alert(
          `Client-Side MP4 Export Completed!\nFile Size: ${result.fileSizeBytes || exportBuffer?.byteLength || 0} bytes\nFrames: ${result.framesConsumed}`
        );
      }
    } catch (err: any) {
      console.error('Client export error:', err);
      alert(`Client export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleCancelExport = () => {
    cancelExportRef.current = true;
    setIsExporting(false);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-screen select-none liquid-ambient-mesh bg-background text-foreground transition-colors duration-200">
        <SettingsModal />
        {/* 1. Top Titlebar */}
        <Titlebar
          projectTitle={irState.doc.meta.contentId}
          fps={fps}
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          isExporting={isExporting}
          onStartExport={handleStartExport}
          onCancelExport={handleCancelExport}
          isLeftOpen={isLeftOpen}
          onToggleLeft={() => setIsLeftOpen(!isLeftOpen)}
          isRightOpen={isRightOpen}
          onToggleRight={() => setIsRightOpen(!isRightOpen)}
        />

        {/* IR Error Banner if any */}
        {irState.error && (
          <div className="bg-destructive/15 border-b border-destructive/30 px-6 py-2 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <span className="font-mono font-medium truncate">{irState.error}</span>
          </div>
        )}

        {/* 2. Main Middle Workspace (LeftSidebar, Preview, RightSidebar) */}
        <div className="flex flex-1 overflow-hidden border-b border-glass-border">
          <LeftSidebar
            isOpen={isLeftOpen}
            onToggle={() => setIsLeftOpen(!isLeftOpen)}
            activeNav={activeNav}
            setActiveNav={setActiveNav}
            onInsertPreset={(preset) => {
              const seq = preset.createSequence({
                startFrame: currentFrame,
                normX: 0.5,
                normY: 0.5,
              });
              IRStateManager.getInstance().addSequence(preset.targetTrackId, seq, {
                trackTypeFallback: preset.targetTrackType,
                trackNameFallback: preset.targetTrackName,
              });
              setIsRightOpen(true);
            }}
          />

          <div className="flex-1 flex flex-col items-center justify-center p-3 relative overflow-hidden bg-background/50">
            <Preview
              playhead={{
                currentFrame,
                totalFrames,
                currentTime: currentFrame / fps,
                fps,
              }}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onScrub={handleScrub}
            />

            {/* Export Progress Modal */}
            <Dialog
              open={isExporting}
              onOpenChange={(open) => {
                if (!open) handleCancelExport();
              }}
            >
              <DialogContent className="max-w-sm glass-panel border-glass-border text-foreground">
                <DialogHeader>
                  <div className="flex items-center justify-left">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-accent-theme" />
                      <DialogTitle>Video Export</DialogTitle>
                    </div>
                    <Badge variant="outline" className="font-mono text-accent-theme bg-accent-theme/10 border-accent-theme/30">
                      {exportProgress}%
                    </Badge>
                  </div>
                  <DialogDescription>
                    Encoding Video IR timeline into MP4 ...
                  </DialogDescription>
                </DialogHeader>

                <div className="py-3">
                  <Progress value={exportProgress} className="h-2.5" />
                </div>

                <DialogFooter>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelExport}
                  >
                    Cancel Export
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {isRightOpen && <RightSidebar />}
        </div>

        {/* 3. Bottom Timeline Scrubber */}
        <Timeline
          playhead={{
            currentFrame,
            totalFrames,
            fps,
          }}
          onScrub={handleScrub}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          shuttle={shuttle}
        />

        {/* 4. Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          <DragOverlayPreview item={activeDragItem} />
        </DragOverlay>
      </div>
    </DndContext>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <StudioWorkspace />
      </TooltipProvider>
    </ThemeProvider>
  );
}
