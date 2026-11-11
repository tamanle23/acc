// ============================================================================
// KINETIX STUDIO v5.0 - DEDICATED COMPOSITE EXPORT & SAVE FILE MODAL
// Multi-format renderer (MP4, WebM, GIF, PNG, SVG) with live progress telemetry,
// browser-native File System Access picker, and guaranteed manual download button.
// ============================================================================

import { createSignal, createEffect, onCleanup, Show, on, untrack, type Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Film,
  Video,
  Image as ImageIcon,
  FileCode,
  Download,
  FolderDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Printer,
  FileText,
} from 'lucide-solid';
import { exportCompositeVideoMp4 } from '@/lib/export-mp4';
import { exportCompositeGif } from '@/lib/export-gif';
import { exportPrintMasterDeck, exportVectorPdfDeck, PRINT_PRESETS } from '@/lib/print-master';
import {
  exportSnapshotPng,
  exportPosterSvg,
  recordCompositeVideoWebm,
  requestSaveFileHandle,
  downloadBlob,
  type ExportResolutionScale,
} from '@/lib/export-video';

export type ExportFormat = 'mp4' | 'webm' | 'gif' | 'png' | 'svg' | 'print' | 'pdf';

export interface ExportSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormat?: ExportFormat;
}

export const ExportSaveModal: Component<ExportSaveModalProps> = (props) => {
  const studio = useStudio();

  const [format, setFormat] = createSignal<ExportFormat>(props.initialFormat ?? 'mp4');
  const [scale, setScale] = createSignal<ExportResolutionScale>(1);
  const [fps, setFps] = createSignal<number>(30);
  const [fileName, setFileName] = createSignal<string>('');
  const [status, setStatus] = createSignal<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [progress, setProgress] = createSignal<number>(0);
  const [currentFrame, setCurrentFrame] = createSignal<number>(0);
  const [totalFrames, setTotalFrames] = createSignal<number>(0);
  const [errorMessage, setErrorMessage] = createSignal<string>('');
  const [renderedBlob, setRenderedBlob] = createSignal<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = createSignal<string>('');
  const [fileSizeStr, setFileSizeStr] = createSignal<string>('');

  // Print Master Deck State
  const [printPreset, setPrintPreset] = createSignal<string>('iso-a1');
  const [printBleedMm, setPrintBleedMm] = createSignal<number>(3);
  const [printIncludeMarks, setPrintIncludeMarks] = createSignal<boolean>(true);

  let abortController: AbortController | null = null;
  let isExporting = false;

  // Sync format and generate default filename strictly when modal opens
  createEffect(
    on(
      () => props.isOpen,
      (isOpen) => {
        if (isOpen) {
          const activeFmt = props.initialFormat ?? untrack(format);
          setFormat(activeFmt);
          setFps(studio.state.fps ?? 30);
          setStatus('idle');
          setProgress(0);
          setCurrentFrame(0);
          setErrorMessage('');
          setRenderedBlob(null);
          const oldPreview = untrack(previewUrl);
          if (oldPreview) {
            URL.revokeObjectURL(oldPreview);
            setPreviewUrl('');
          }

          const currentPreset = untrack(printPreset);
          const ext =
            activeFmt === 'mp4'
              ? 'mp4'
              : activeFmt === 'webm'
              ? 'webm'
              : activeFmt === 'gif'
              ? 'gif'
              : activeFmt === 'svg'
              ? 'svg'
              : activeFmt === 'pdf'
              ? 'pdf'
              : 'png';
          setFileName(
            activeFmt === 'print'
              ? `${studio.state.posterId}-${currentPreset}-300dpi.png`
              : activeFmt === 'pdf'
              ? `${studio.state.posterId}-${currentPreset}-vector-cmyk.pdf`
              : `${studio.state.posterId}-${studio.state.aspectRatio.replace(':', 'x')}.${ext}`
          );
        }
      }
    )
  );

  // Cleanup preview URL on unmount
  onCleanup(() => {
    if (previewUrl()) {
      URL.revokeObjectURL(previewUrl());
    }
    abortController?.abort();
  });

  const handleFormatChange = (newFmt: ExportFormat) => {
    setFormat(newFmt);
    setStatus('idle');
    setRenderedBlob(null);
    if (previewUrl()) {
      URL.revokeObjectURL(previewUrl());
      setPreviewUrl('');
    }
    const ext =
      newFmt === 'mp4'
        ? 'mp4'
        : newFmt === 'webm'
        ? 'webm'
        : newFmt === 'gif'
        ? 'gif'
        : newFmt === 'svg'
        ? 'svg'
        : newFmt === 'pdf'
        ? 'pdf'
        : 'png';
    setFileName(
      newFmt === 'print'
        ? `${studio.state.posterId}-${printPreset()}-300dpi.png`
        : newFmt === 'pdf'
        ? `${studio.state.posterId}-${printPreset()}-vector-cmyk.pdf`
        : `${studio.state.posterId}-${studio.state.aspectRatio.replace(':', 'x')}.${ext}`
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleStartExport = async (promptFilePicker = false) => {
    if (isExporting || status() === 'rendering') return;
    isExporting = true;
    setStatus('rendering');
    setProgress(0);
    setErrorMessage('');
    setRenderedBlob(null);

    abortController = new AbortController();

    let chosenFileHandle: any = null;
    const finalName = fileName().trim() || `kinetix-export.${format()}`;

    // Optionally prompt native OS Save File Picker
    if (promptFilePicker) {
      const mimeMap: Record<ExportFormat, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        gif: 'image/gif',
        png: 'image/png',
        svg: 'image/svg+xml',
        print: 'image/png',
        pdf: 'application/pdf',
      };
      const descMap: Record<ExportFormat, string> = {
        mp4: 'MP4 Video',
        webm: 'WebM Video',
        gif: 'Animated GIF',
        png: 'PNG Image',
        svg: 'Scalable Vector Graphics',
        print: 'Print Master 300 DPI Deck',
        pdf: 'PDF 1.7 Vector Pre-Press Document',
      };

      const handle = await requestSaveFileHandle({
        suggestedName: finalName,
        types: [
          {
            description: descMap[format()],
            accept: { [mimeMap[format()]]: [`.${format() === 'print' ? 'png' : format()}`] },
          },
        ],
      });

      if (handle === 'cancelled') {
        setStatus('idle');
        isExporting = false;
        return;
      }
      chosenFileHandle = handle;
    }

    try {
      let resultBlob: Blob | null = null;

      if (format() === 'mp4') {
        resultBlob = await exportCompositeVideoMp4({
          state: studio.state,
          abortController,
          fileHandle: chosenFileHandle,
          scale: scale(),
          fps: fps(),
          autoDownload: false,
          onProgress: (pct, cur, tot) => {
            setProgress(pct);
            if (cur) setCurrentFrame(cur);
            if (tot) setTotalFrames(tot);
          },
          onSuccess: (b) => {
            resultBlob = b;
          },
          onCancel: () => {
            setStatus('idle');
          },
        });
      } else if (format() === 'webm') {
        resultBlob = await recordCompositeVideoWebm({
          state: studio.state,
          abortController,
          fileHandle: chosenFileHandle,
          scale: scale(),
          autoDownload: false,
          onProgress: (pct) => {
            setProgress(pct);
            const tot = Math.round(studio.state.durationSec * studio.state.fps);
            setCurrentFrame(Math.round((pct / 100) * tot));
            setTotalFrames(tot);
          },
          onSuccess: (b) => {
            if (b) resultBlob = b;
          },
          onCancel: () => {
            setStatus('idle');
          },
        });
      } else if (format() === 'gif') {
        resultBlob = await exportCompositeGif({
          state: studio.state,
          abortController,
          fileHandle: chosenFileHandle,
          autoDownload: false,
          onProgress: (pct) => setProgress(pct),
          onSuccess: (b) => {
            resultBlob = b;
          },
          onCancel: () => {
            setStatus('idle');
          },
        });
      } else if (format() === 'png') {
        const curFrame = Math.round(
          studio.rawProgress * studio.state.fps * studio.state.durationSec
        );
        resultBlob = await exportSnapshotPng({
          state: studio.state,
          scale: scale(),
          frame: curFrame,
          fileHandle: chosenFileHandle,
          autoDownload: false,
        });
        setProgress(100);
      } else if (format() === 'print') {
        const curFrame = Math.round(
          studio.rawProgress * studio.state.fps * studio.state.durationSec
        );
        resultBlob = await exportPrintMasterDeck({
          state: studio.state,
          presetId: printPreset(),
          includeMarks: printIncludeMarks(),
          bleedMm: printBleedMm(),
          frame: curFrame,
          fileHandle: chosenFileHandle,
          autoDownload: false,
        });
        setProgress(100);
      } else if (format() === 'svg') {
        resultBlob = await exportPosterSvg(studio.state, chosenFileHandle, false);
        setProgress(100);
      } else if (format() === 'pdf') {
        resultBlob = await exportVectorPdfDeck({
          state: studio.state,
          presetId: printPreset(),
          bleedMm: printBleedMm(),
          includeSpotPlate: true,
          fileHandle: chosenFileHandle,
          autoDownload: false,
        });
        setProgress(100);
      }

      if (resultBlob) {
        setRenderedBlob(resultBlob);
        setFileSizeStr(formatFileSize(resultBlob.size));
        const url = URL.createObjectURL(resultBlob);
        setPreviewUrl(url);
        setStatus('done');
        if (!chosenFileHandle) {
          downloadBlob(resultBlob, finalName);
        }
        studio.triggerToast(`Successfully rendered and downloaded ${finalName} (${formatFileSize(resultBlob.size)})`);
      } else if (chosenFileHandle) {
        setStatus('done');
        studio.triggerToast(`Successfully saved ${finalName}`);
      } else {
        setStatus('done');
      }
    } catch (err: any) {
      console.error('Export error in modal:', err);
      setErrorMessage(err?.message || 'Export processing failed. Please try a different format.');
      setStatus('error');
    } finally {
      isExporting = false;
    }
  };

  const handleDirectDownload = () => {
    const blob = renderedBlob();
    if (!blob) return;
    const finalName = fileName().trim() || `kinetix-export.${format()}`;
    downloadBlob(blob, finalName);
    studio.triggerToast(`Downloading ${finalName}`);
  };

  const handleCancel = () => {
    abortController?.abort();
    isExporting = false;
    setStatus('idle');
    setProgress(0);
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={
        <div class="flex items-center gap-2">
          <Film class="w-4 h-4 text-primary" />
          <span class="font-bold font-mono text-sm">Export Motion & Static Asset</span>
          <Badge variant="outline" class="ml-2 font-mono text-xs">
            {studio.state.aspectRatio} • {studio.state.durationSec}s
          </Badge>
        </div>
      }
      maxWidthClass="max-w-xl"
    >
      <div class="space-y-4 text-xs font-sans text-foreground">
        {/* FORMAT SELECTION TABS */}
        <div class="grid grid-cols-7 gap-1 p-1 bg-muted/40 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => handleFormatChange('mp4')}
            class={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
              format() === 'mp4'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <Film class="w-4 h-4" />
            <span>MP4</span>
          </button>

          <button
            type="button"
            onClick={() => handleFormatChange('webm')}
            class={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
              format() === 'webm'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <Video class="w-4 h-4" />
            <span>WebM</span>
          </button>

          <button
            type="button"
            onClick={() => handleFormatChange('gif')}
            class={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
              format() === 'gif'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <Sparkles class="w-4 h-4" />
            <span>GIF</span>
          </button>

          <button
            type="button"
            onClick={() => handleFormatChange('png')}
            class={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
              format() === 'png'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <ImageIcon class="w-4 h-4" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={() => handleFormatChange('print')}
            class={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
              format() === 'print'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <Printer class="w-4 h-4" />
            <span>Print Deck</span>
          </button>

          <button
            type="button"
            onClick={() => handleFormatChange('svg')}
            class={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
              format() === 'svg'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <FileCode class="w-4 h-4" />
            <span>SVG</span>
          </button>

          <button
            type="button"
            onClick={() => handleFormatChange('pdf')}
            class={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
              format() === 'pdf'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <FileText class="w-4 h-4" />
            <span>PDF (CMYK)</span>
          </button>
        </div>

        {/* FORMAT DETAILS / SPECS */}
        <div class="p-2.5 rounded-lg bg-card border border-border flex items-center justify-between text-xs">
          <div>
            <span class="font-bold text-foreground">
              {format() === 'mp4' && 'H.264 / AAC MP4 Video (WebCodecs Hardware Accelerated)'}
              {format() === 'webm' && 'VP9 / WebM Loop Container (High Compatibility)'}
              {format() === 'gif' && 'GIF89a Animated Graphic (Optimized Color Quantization)'}
              {format() === 'png' && 'High-DPI Lossless Master Frame Rasterization'}
              {format() === 'print' && 'Publishing Print Deck (300 DPI, Bleed Margins, Crop & Registration Marks)'}
              {format() === 'svg' && 'Clean Math-Precise Scalable Vector Graphics'}
              {format() === 'pdf' && 'PDF 1.7 / PDF/X-4 True Vector CMYK Master Deck with Spot Varnish Plate'}
            </span>
            <p class="text-xs text-muted-foreground mt-0.5">
              {format() === 'mp4' && 'Best for Instagram, TikTok, YouTube Shorts, Twitter, and native video players.'}
              {format() === 'webm' && 'Best for lightweight web playback and browser video loops.'}
              {format() === 'gif' && 'Best for Discord stickers, Slack reactions, and GitHub README embeds.'}
              {format() === 'png' && 'Pixel-for-pixel master frame snapshot matching the live studio viewport.'}
              {format() === 'print' && 'Gallery & archival grade ISO/US standard posters ready for offset litho, risograph, and giclée fine art printing.'}
              {format() === 'svg' && 'Resolution-independent vector output ready for Illustrator and Figma.'}
              {format() === 'pdf' && 'Certified DeviceCMYK separation (300% TAC limiting), BleedBox/TrimBox marks, and isolated spot UV varnish plate.'}
            </p>
          </div>
          <Badge variant="secondary" class="shrink-0 font-mono text-xs">
            {format() === 'pdf' ? 'VECTOR CMYK' : format().toUpperCase()}
          </Badge>
        </div>

        {/* SETTINGS PANEL (FILENAME & RESOLUTION) */}
        <div class="space-y-3 p-3 bg-muted/20 border border-border rounded-lg">
          {/* FILENAME INPUT */}
          <div class="space-y-1">
            <label class="text-xs font-mono text-muted-foreground uppercase font-bold">
              Export File Name
            </label>
            <input
              type="text"
              value={fileName()}
              onInput={(e) => setFileName(e.currentTarget.value)}
              disabled={status() === 'rendering'}
              class="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          {/* RESOLUTION SCALE (FOR PNG) */}
          <Show when={format() === 'png'}>
            <div class="space-y-1">
              <label class="text-xs font-mono text-muted-foreground uppercase font-bold">
                Resolution Scale
              </label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScale(1)}
                  class={`py-1.5 px-2 rounded text-xs font-mono border transition-all cursor-pointer ${
                    scale() === 1
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-background border-border text-foreground hover:bg-accent'
                  }`}
                >
                  1x Standard (1080p)
                </button>
                <button
                  type="button"
                  onClick={() => setScale(2)}
                  class={`py-1.5 px-2 rounded text-xs font-mono border transition-all cursor-pointer ${
                    scale() === 2
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-background border-border text-foreground hover:bg-accent'
                  }`}
                >
                  2x 4K Retina
                </button>
                <button
                  type="button"
                  onClick={() => setScale(4)}
                  class={`py-1.5 px-2 rounded text-xs font-mono border transition-all cursor-pointer ${
                    scale() === 4
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-background border-border text-foreground hover:bg-accent'
                  }`}
                >
                  4x Print Master (300 DPI)
                </button>
              </div>
            </div>
          </Show>

          {/* PRINT MASTER DECK PRESETS (FOR PRINT & PDF) */}
          <Show when={format() === 'print' || format() === 'pdf'}>
            <div class="space-y-2">
              <label class="text-xs font-mono text-muted-foreground uppercase font-bold">
                Print Sheet Standard & Dimensions
              </label>
              <div class="grid grid-cols-2 gap-1.5">
                {PRINT_PRESETS.map((p) => (
                  <button
                    type="button"
                    onClick={() => {
                      setPrintPreset(p.id);
                      setFileName(`${studio.state.posterId}-${p.id}-300dpi.png`);
                    }}
                    class={`p-2 rounded text-left border transition-all cursor-pointer ${
                      printPreset() === p.id
                        ? 'bg-primary/10 border-primary text-foreground font-medium'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div class="font-mono font-bold text-xs text-foreground">{p.name}</div>
                    <div class="text-[10px] text-muted-foreground mt-0.5">{p.description}</div>
                  </button>
                ))}
              </div>

              <div class="flex items-center justify-between pt-1 text-xs">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printIncludeMarks()}
                    onChange={(e) => setPrintIncludeMarks(e.currentTarget.checked)}
                    class="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Include Trim Crop Marks, Registration Crosshairs & CMYK Wedge</span>
                </label>
                <div class="flex items-center gap-1.5">
                  <span class="text-muted-foreground">Bleed:</span>
                  <select
                    value={printBleedMm()}
                    onChange={(e) => setPrintBleedMm(Number(e.currentTarget.value))}
                    class="bg-background border border-border rounded px-1.5 py-0.5 font-mono text-xs text-foreground"
                  >
                    <option value="0">0 mm (No Bleed)</option>
                    <option value="3">3 mm (ISO Standard)</option>
                    <option value="5">5 mm (Heavy Stock)</option>
                  </select>
                </div>
              </div>
            </div>
          </Show>

          {/* FPS SELECTOR (FOR VIDEO) */}
          <Show when={format() === 'mp4' || format() === 'webm'}>
            <div class="flex items-center justify-between text-xs">
              <span class="text-xs font-mono text-muted-foreground uppercase font-bold">
                Frame Rate & Duration
              </span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFps(30)}
                  class={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
                    fps() === 30
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-background border-border text-foreground hover:bg-accent'
                  }`}
                >
                  30 FPS
                </button>
                <button
                  type="button"
                  onClick={() => setFps(60)}
                  class={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
                    fps() === 60
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-background border-border text-foreground hover:bg-accent'
                  }`}
                >
                  60 FPS (Ultra-Smooth)
                </button>
                <span class="font-mono text-muted-foreground text-xs">
                  • {Math.round(studio.state.durationSec * fps())} total frames
                </span>
              </div>
            </div>
          </Show>
        </div>

        {/* PROGRESS / RENDERING STATE */}
        <Show when={status() === 'rendering'}>
          <div class="p-4 bg-muted/30 border border-primary/40 rounded-lg space-y-2.5 animate-pulse">
            <div class="flex items-center justify-between text-xs font-mono">
              <div class="flex items-center gap-2">
                <Loader2 class="w-4 h-4 text-primary animate-spin" />
                <span class="font-bold text-foreground">Rendering Composition...</span>
              </div>
              <span class="text-primary font-bold">{progress()}%</span>
            </div>

            {/* PROGRESS BAR */}
            <div class="w-full bg-background/80 h-2 rounded-full overflow-hidden border border-border">
              <div
                class="bg-primary h-full transition-all duration-150 ease-out"
                style={{ width: `${progress()}%` }}
              />
            </div>

            <div class="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>
                {currentFrame() > 0 ? `Frame ${currentFrame()} of ${totalFrames()}` : 'Initializing pipeline...'}
              </span>
              <Button size="xs" variant="destructive" onClick={handleCancel}>
                Cancel Render
              </Button>
            </div>
          </div>
        </Show>

        {/* SUCCESS / DONE STATE */}
        <Show when={status() === 'done'}>
          <div class="p-4 bg-emerald-950/20 border border-emerald-500/40 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-emerald-400 font-bold font-mono text-xs">
                <CheckCircle2 class="w-4 h-4 text-emerald-400" />
                <span>Render Complete!</span>
              </div>
              <Show when={fileSizeStr()}>
                <Badge variant="outline" class="font-mono text-emerald-300 border-emerald-500/30">
                  {fileSizeStr()}
                </Badge>
              </Show>
            </div>

            {/* PREVIEW CONTAINER */}
            <Show when={previewUrl()}>
              <div class="max-h-48 overflow-hidden rounded border border-border flex items-center justify-center bg-black/60">
                <Show
                  when={format() === 'mp4' || format() === 'webm'}
                  fallback={
                    <img
                      src={previewUrl()}
                      alt="Rendered output"
                      class="max-h-48 object-contain"
                    />
                  }
                >
                  <video
                    src={previewUrl()}
                    controls
                    autoplay
                    loop
                    class="max-h-48 object-contain"
                  />
                </Show>
              </div>
            </Show>

            {/* PRIMARY DIRECT DOWNLOAD BUTTON */}
            <div class="flex items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="md"
                class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs"
                onClick={handleDirectDownload}
              >
                <Download class="w-4 h-4 mr-1.5" />
                Download {fileName()} ({fileSizeStr() || 'Ready'})
              </Button>

              <Show when={typeof window !== 'undefined' && 'showSaveFilePicker' in window}>
                <Button
                  variant="outline"
                  size="md"
                  class="font-mono text-xs"
                  onClick={() => handleStartExport(true)}
                  title="Choose destination directory on disk"
                >
                  <FolderDown class="w-3.5 h-3.5 mr-1" />
                  Save As...
                </Button>
              </Show>
            </div>
          </div>
        </Show>

        {/* ERROR STATE */}
        <Show when={status() === 'error'}>
          <div class="p-3 bg-destructive/10 border border-destructive/40 rounded-lg flex items-start gap-2.5 text-xs text-destructive">
            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
            <div class="space-y-1">
              <span class="font-bold">Render Failed</span>
              <p class="text-xs leading-relaxed text-destructive">{errorMessage()}</p>
            </div>
          </div>
        </Show>

        {/* FOOTER ACTION BUTTONS */}
        <Show when={status() === 'idle'}>
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={props.onClose}>
              Cancel
            </Button>

            <Show when={typeof window !== 'undefined' && 'showSaveFilePicker' in window}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStartExport(true)}
                class="font-mono text-xs"
              >
                <FolderDown class="w-3.5 h-3.5 mr-1.5" />
                Choose Folder & Export
              </Button>
            </Show>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStartExport(false)}
              class="font-bold text-xs"
            >
              <Download class="w-3.5 h-3.5 mr-1.5" />
              Render & Download
            </Button>
          </div>
        </Show>
      </div>
    </Modal>
  );
};
