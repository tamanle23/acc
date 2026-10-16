import React, { useState, useEffect, useRef } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
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
} from './components/ui';
import { MediabunnyClientSink } from '@acc/core/client';
import { Video, AlertCircle } from 'lucide-react';
import { IRStateManager } from './lib/ir/irState';

export default function App() {
  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());
  const [currentFrame, setCurrentFrame] = useState(0);
  const [activeTab, setActiveTab] = useState<'vault' | 'inspector'>('inspector');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const cancelExportRef = useRef(false);

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const fps = irState.doc.meta.globalFps || 30;
  const totalFrames = irState.timeline?.totalDurationFrames || 300;
  const width = irState.doc.meta.canvasSize.w || 1920;
  const height = irState.doc.meta.canvasSize.h || 1080;

  const handleScrub = (frame: number) => {
    setCurrentFrame(Math.max(0, Math.min(frame, totalFrames)));
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
      });

      let offscreenCanvas: HTMLCanvasElement | null = null;
      let ctx: CanvasRenderingContext2D | null = null;

      if (typeof document !== 'undefined') {
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      }

      for (let f = 0; f < totalFrames; f++) {
        if (cancelExportRef.current) {
          console.warn('Client export cancelled by user.');
          break;
        }

        let rgba: Uint8Array;
        if (ctx && offscreenCanvas) {
          ctx.fillStyle = f % 2 === 0 ? '#0f172a' : '#1e293b';
          ctx.fillRect(0, 0, width, height);

          ctx.fillStyle = '#38bdf8';
          ctx.font = '36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Video IR Render - Frame ${f}/${totalFrames}`, width / 2, height / 2);

          const imgData = ctx.getImageData(0, 0, width, height);
          rgba = new Uint8Array(imgData.data.buffer);
        } else {
          rgba = new Uint8Array(width * height * 4).fill(128);
        }

        await sink.consumeFrame(f, rgba);
        setExportProgress(Math.round(((f + 1) / totalFrames) * 100));
      }

      if (!cancelExportRef.current) {
        const result = await sink.finalize();
        alert(
          `Client-Side MP4 Export Completed!\nFile Size: ${
            result.fileSizeBytes || result.stats?.inMemoryBufferSize
          } bytes\nFrames: ${result.framesConsumed}`
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
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800">
      {/* 1. Top Titlebar */}
      <Titlebar
        projectTitle={irState.doc.meta.contentId}
        fps={fps}
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        isExporting={isExporting}
        onStartExport={handleStartExport}
        onCancelExport={handleCancelExport}
      />

      {/* IR Error Banner if any */}
      {irState.error && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-2 flex items-center gap-2 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-mono font-medium truncate">{irState.error}</span>
        </div>
      )}

      {/* 2. Main Middle Workspace (Preview & Sidebar) */}
      <div className="flex flex-1 overflow-hidden border-b border-slate-200">
        <div className="flex-1 flex items-center justify-center bg-slate-950 p-6 relative">
          <Preview
            playhead={{
              currentFrame,
              totalFrames,
              currentTime: currentFrame / fps,
              fps,
            }}
          />

          {/* Export Progress Modal */}
          <Dialog
            open={isExporting}
            onOpenChange={(open) => {
              if (!open) handleCancelExport();
            }}
          >
            <DialogContent className="max-w-sm border-slate-200">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-indigo-600" />
                    <DialogTitle>WebCodecs Video Export</DialogTitle>
                  </div>
                  <Badge variant="secondary" className="font-mono text-indigo-700 bg-indigo-50">
                    {exportProgress}%
                  </Badge>
                </div>
                <DialogDescription>
                  Encoding Video IR timeline into MP4 Blob via WebCodecs...
                </DialogDescription>
              </DialogHeader>

              <div className="py-3">
                <Progress value={exportProgress} className="h-2.5" />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelExport}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                >
                  Cancel Export
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* 3. Bottom Timeline Scrubber */}
      <Timeline
        playhead={{
          currentFrame,
          totalFrames,
          fps,
        }}
        onScrub={handleScrub}
      />
    </div>
  );
}
