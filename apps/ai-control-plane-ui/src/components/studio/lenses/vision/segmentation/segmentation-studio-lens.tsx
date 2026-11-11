import { createSignal, createMemo, Show, For, onMount, onCleanup } from "solid-js";
import {
  Scissors,
  Download,
  Copy,
  Check,
  Eye,
  Sliders,
  Palette,
} from "lucide-solid";
import { DraggableSplitWipe } from "../shared/draggable-split-wipe";
import { ViewportControls } from "../shared/viewport-controls";
import { PixelProbeOverlay } from "../shared/pixel-probe-overlay";

export interface SegmentationStudioLensProps {
  output: {
    original_image_data_uri?: string;
    segmented_image_data_uri?: string;
    alpha_mask_data_uri?: string;
    image_data_uri?: string;
    image_source?: string;
    mask_threshold?: number;
    edge_feather_px?: number;
    background_mode?: string;
    output_resolution?: string;
    refine_hair_foreground?: boolean;
    weight_tier?: string;
    foreground_coverage_pct?: number;
    hair_edge_snr_db?: number;
  };
  liveInputText?: string;
  liveParams?: Record<string, any>;
  activeWeightTier?: string;
  onChangeParam?: (key: string, val: any) => void;
  liveConfidenceThreshold?: number;
}

export function SegmentationStudioLens(props: SegmentationStudioLensProps) {
  // View mode
  const [viewMode, setViewMode] = createSignal<
    "split_wipe" | "cutout_only" | "alpha_mask" | "quick_mask" | "side_by_side"
  >("split_wipe");

  // Draggable wipe percentage (50% default)
  const [splitWipePct, setSplitWipePct] = createSignal<number>(50);

  // Pan & Zoom
  const [zoom, setZoom] = createSignal<number>(1.0);
  const [pan, setPan] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanActive, setIsPanActive] = createSignal<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = createSignal<boolean>(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = createSignal<boolean>(false);
  const [dragStart, setDragStart] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === "Space" && tag !== "INPUT" && tag !== "TEXTAREA") {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    });
  });

  // Custom Backdrop Color
  const [customBackdropColor, setCustomBackdropColor] = createSignal<string>("#1e293b");

  // Quick Mask Opacity
  const [quickMaskOpacity, setQuickMaskOpacity] = createSignal<number>(0.65);

  // Pixel Probe State
  const [probeActive, setProbeActive] = createSignal<boolean>(false);
  const [probePos, setProbePos] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });
  const [probeRgba, setProbeRgba] = createSignal<{ r: number; g: number; b: number; a: number }>({
    r: 255,
    g: 255,
    b: 255,
    a: 255,
  });

  // Copy Feedback
  const [copiedCutout, setCopiedCutout] = createSignal<boolean>(false);

  // Offscreen canvas for color/alpha sampling
  let samplingCanvas: HTMLCanvasElement | undefined;
  let samplingCtx: CanvasRenderingContext2D | null = null;
  let cachedSamplingImg: HTMLImageElement | null = null;
  let samplingImgUri: string = "";

  // Resolved parameters
  const maskCutoff = createMemo(() =>
    Number(props.liveParams?.mask_threshold ?? props.output?.mask_threshold ?? props.liveConfidenceThreshold ?? 0.5)
  );
  const edgeFeatherPx = createMemo(() =>
    Number(props.liveParams?.edge_feather_px ?? props.output?.edge_feather_px ?? 1.5)
  );
  const activeBackdrop = createMemo(() =>
    String(props.liveParams?.background_mode ?? props.output?.background_mode ?? "checkerboard")
  );
  const resStr = createMemo(() =>
    String(props.liveParams?.output_resolution ?? props.output?.output_resolution ?? "1024x1024")
  );
  const refineHair = createMemo(() =>
    Boolean(props.liveParams?.refine_hair_foreground ?? props.output?.refine_hair_foreground ?? true)
  );
  const weightTier = createMemo(() =>
    props.activeWeightTier || props.output?.weight_tier || "balanced_fp16"
  );
  const imgSourceLabel = createMemo(() =>
    (props.liveInputText && props.liveInputText.trim()) ||
    props.output?.image_source ||
    "portrait_fine_hair_1024.png"
  );

  const fgCoverage = () => props.output?.foreground_coverage_pct ?? 48.0;
  const hairSnr = () => props.output?.hair_edge_snr_db ?? 38.5;

  const originalUri = () =>
    props.output?.original_image_data_uri && props.output.original_image_data_uri.startsWith("data:image/")
      ? props.output.original_image_data_uri
      : props.output?.image_data_uri || "";

  const segmentedUri = () =>
    props.output?.segmented_image_data_uri && props.output.segmented_image_data_uri.startsWith("data:image/")
      ? props.output.segmented_image_data_uri
      : props.output?.image_data_uri || "";

  const alphaMaskUri = () =>
    props.output?.alpha_mask_data_uri && props.output.alpha_mask_data_uri.startsWith("data:image/")
      ? props.output.alpha_mask_data_uri
      : "";

  // Backdrop CSS styles
  const backdropStyle = createMemo(() => {
    const b = activeBackdrop();
    if (b === "green_screen" || b === "greenscreen") {
      return { "background-color": "#00d959" };
    }
    if (b === "white") {
      return { "background-color": "#ffffff" };
    }
    if (b === "obsidian" || b === "dark") {
      return { "background-color": "#0b0f19" };
    }
    if (b === "custom") {
      return { "background-color": customBackdropColor() };
    }
    if (b === "raw_alpha_mask" || b === "alpha_mask" || viewMode() === "alpha_mask") {
      return { "background-color": "#020617" };
    }
    // High-precision transparency checkerboard
    return {
      "background-color": "#0f172a",
      "background-image":
        "linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)",
      "background-size": "20px 20px",
      "background-position": "0 0, 0 10px, 10px -10px, -10px 0px",
    };
  });

  // Pan & Zoom reset
  const handleResetZoomPan = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Pointer move over canvas for sampling
  const handleCanvasPointerMove = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const pixelX = Math.round(normX * 1024);
    const pixelY = Math.round(normY * 1024);
    setProbePos({ x: pixelX, y: pixelY });

    // Sample pixel from segmented URI
    const uri = segmentedUri() || originalUri();
    if (!uri) return;

    if (!samplingCanvas) {
      samplingCanvas = document.createElement("canvas");
      samplingCanvas.width = 1024;
      samplingCanvas.height = 1024;
      samplingCtx = samplingCanvas.getContext("2d", { willReadFrequently: true });
    }

    if (samplingImgUri !== uri || !cachedSamplingImg) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = uri;
      img.onload = () => {
        cachedSamplingImg = img;
        samplingImgUri = uri;
        samplingCtx?.drawImage(img, 0, 0, 1024, 1024);
        sampleAtPixel(pixelX, pixelY);
      };
    } else {
      sampleAtPixel(pixelX, pixelY);
    }
  };

  const sampleAtPixel = (px: number, py: number) => {
    if (!samplingCtx) return;
    try {
      const pixel = samplingCtx.getImageData(px, py, 1, 1).data;
      setProbeRgba({
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        a: pixel[3],
      });
      setProbeActive(true);
    } catch {
      // CORS protection or unready context
    }
  };

  // Canvas pan dragging
  const handleCanvasPointerDown = (e: PointerEvent) => {
    if (!isPanActive() && e.button !== 1 && !isSpacePressed()) return;
    e.preventDefault();
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan().x, y: e.clientY - pan().y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasDrag = (e: PointerEvent) => {
    if (!isDraggingCanvas()) return;
    e.preventDefault();
    setPan({ x: e.clientX - dragStart().x, y: e.clientY - dragStart().y });
  };

  const handleCanvasPointerUp = (e: PointerEvent) => {
    if (!isDraggingCanvas()) return;
    setIsDraggingCanvas(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Wheel Zoom
  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || isPanActive()) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoom((z) => Math.max(0.25, Math.min(4.0, Number((z + delta).toFixed(2)))));
    }
  };

  // Copy Cutout PNG to Clipboard
  const handleCopyCutout = async () => {
    const uri = segmentedUri();
    if (!uri || !navigator.clipboard) return;

    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopiedCutout(true);
      setTimeout(() => setCopiedCutout(false), 2000);
    } catch {
      // Fallback: Copy data URI as text
      await navigator.clipboard.writeText(uri);
      setCopiedCutout(true);
      setTimeout(() => setCopiedCutout(false), 2000);
    }
  };

  return (
    <div class="space-y-3.5">
      {/* 1. VFX Quality & Telemetry Metrics Strip */}
      <div class="grid grid-cols-4 gap-2 font-mono text-[11px] tabular-nums">
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">COVERAGE</span>
          <span class="text-primary font-bold">{fgCoverage()}%</span>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">HAIR SNR</span>
          <span class="text-success font-bold">{hairSnr()} dB</span>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">FEATHER</span>
          <span class="text-primary font-bold">{edgeFeatherPx()} px</span>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">RES / TIER</span>
          <span class="text-foreground font-bold">
            {resStr().split("x")[0]}p • {weightTier().split("_")[0].toUpperCase()}
          </span>
        </div>
      </div>

      {/* 2. Interactive Studio Controls & View Mode Selector */}
      <div class="p-3 rounded-xl border border-border bg-surface/70 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <Scissors class="w-3.5 h-3.5 text-primary" />
            <span>BRIA RMBG-2.0 Matte Studio ({refineHair() ? "BiRefNet Refined" : "Standard"})</span>
          </span>

          {/* Mode Selector Chips */}
          <div class="flex flex-wrap items-center gap-1" role="tablist" aria-label="Segmentation View Modes">
            <For
              each={[
                { id: "split_wipe", label: "Split Wipe" },
                { id: "cutout_only", label: "Cutout PNG" },
                { id: "alpha_mask", label: "8-Bit Matte" },
                { id: "quick_mask", label: "Quick Mask (Ruby)" },
                { id: "side_by_side", label: "3-Up Compare" },
              ]}
            >
              {(m) => (
                <button
                  type="button"
                  onClick={() => setViewMode(m.id as any)}
                  class={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition border ${
                    viewMode() === m.id
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                  role="tab"
                  aria-selected={viewMode() === m.id}
                >
                  {m.label}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Backdrop Selection Bar */}
        <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
              <Palette class="w-3 h-3 text-primary" />
              <span>Backdrop:</span>
            </span>
            <div class="flex flex-wrap items-center gap-1">
              <For
                each={[
                  { id: "checkerboard", label: "Checker" },
                  { id: "green_screen", label: "Chroma Green" },
                  { id: "white", label: "Studio White" },
                  { id: "obsidian", label: "Dark Slate" },
                  { id: "custom", label: "Custom Hex" },
                ]}
              >
                {(b) => (
                  <button
                    type="button"
                    onClick={() => props.onChangeParam?.("background_mode", b.id)}
                    class={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                      activeBackdrop() === b.id
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {b.label}
                  </button>
                )}
              </For>

              <Show when={activeBackdrop() === "custom"}>
                <input
                  type="color"
                  value={customBackdropColor()}
                  onInput={(e) => setCustomBackdropColor(e.currentTarget.value)}
                  class="w-5 h-5 rounded cursor-pointer border border-border bg-transparent p-0 ml-1"
                  title="Choose custom background color"
                  aria-label="Custom background color picker"
                />
              </Show>
            </div>
          </div>

          <Show when={viewMode() === "quick_mask"}>
            <div class="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span>Ruby Tint:</span>
              <input
                type="range"
                min={0.2}
                max={0.95}
                step={0.05}
                value={quickMaskOpacity()}
                onInput={(e) => setQuickMaskOpacity(parseFloat(e.currentTarget.value))}
                class="studio-slider w-20"
                aria-label="Quick Mask Ruby Opacity"
              />
              <span class="tabular-nums font-semibold">{Math.round(quickMaskOpacity() * 100)}%</span>
            </div>
          </Show>

          {/* Action Buttons: Copy & Download */}
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyCutout}
              class="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1 transition shadow-xs"
              title="Copy Cutout PNG to Clipboard"
            >
              <Show when={copiedCutout()} fallback={<Copy class="w-3 h-3 text-muted-foreground" />}>
                <Check class="w-3 h-3 text-success" />
              </Show>
              <span>{copiedCutout() ? "Copied!" : "Copy PNG"}</span>
            </button>

            <Show when={segmentedUri()}>
              <a
                href={segmentedUri()}
                download="birefnet_cutout.png"
                class="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-card hover:bg-primary hover:text-primary-foreground text-foreground flex items-center gap-1 transition shadow-xs"
                title="Download Transparent Cutout PNG"
              >
                <Download class="w-3 h-3" />
                <span>Cutout</span>
              </a>
            </Show>

            <Show when={alphaMaskUri()}>
              <a
                href={alphaMaskUri()}
                download="birefnet_alpha_matte.png"
                class="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-card hover:bg-secondary text-foreground flex items-center gap-1 transition shadow-xs"
                title="Download 8-bit Alpha Mask PNG"
              >
                <Download class="w-3 h-3" />
                <span>Matte</span>
              </a>
            </Show>
          </div>
        </div>
      </div>

      {/* 3. Main Viewport Canvas */}
      <Show
        when={viewMode() !== "side_by_side"}
        fallback={
          /* 3-Up Side-by-Side Compare */
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-xl border border-border overflow-hidden bg-muted/20 flex flex-col">
              <div class="px-2.5 py-1 bg-surface border-b border-border font-mono text-[10px] text-foreground font-semibold flex items-center justify-between">
                <span>1. Original RGB</span>
                <span class="text-muted-foreground font-normal">Source</span>
              </div>
              <img
                src={originalUri()}
                alt="Original input"
                class="w-full h-56 object-contain bg-slate-950/40"
              />
            </div>
            <div class="rounded-xl border border-border overflow-hidden bg-muted/20 flex flex-col">
              <div class="px-2.5 py-1 bg-surface border-b border-border font-mono text-[10px] text-foreground font-semibold flex items-center justify-between">
                <span>2. BiRefNet 8-Bit Matte</span>
                <span class="text-primary font-normal">Grayscale</span>
              </div>
              <img
                src={alphaMaskUri()}
                alt="8-bit alpha mask"
                class="w-full h-56 object-contain bg-slate-950"
              />
            </div>
            <div
              class="rounded-xl border border-border overflow-hidden flex flex-col"
              style={backdropStyle()}
            >
              <div class="px-2.5 py-1 bg-surface border-b border-border font-mono text-[10px] text-foreground font-semibold flex items-center justify-between">
                <span>3. Transparent Cutout</span>
                <span class="text-success font-normal">RGBA PNG</span>
              </div>
              <img
                src={segmentedUri()}
                alt="Segmented RGBA Cutout"
                class="w-full h-56 object-contain"
              />
            </div>
          </div>
        }
      >
        <div
          class={`relative w-full h-80 rounded-2xl border border-border overflow-hidden shadow-lg select-none ${
            isPanActive() ? (isDraggingCanvas() ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair"
          }`}
          style={backdropStyle()}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={(e) => {
            handleCanvasDrag(e);
            handleCanvasPointerMove(e);
          }}
          onPointerUp={handleCanvasPointerUp}
          onPointerLeave={() => {
            setIsDraggingCanvas(false);
            setProbeActive(false);
          }}
          onWheel={handleWheel}
        >
          {/* Zoom & Pan Container */}
          <div
            class="relative w-full h-full flex items-center justify-center transition-transform duration-75"
            style={{
              transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`,
              "transform-origin": "center center",
            }}
          >
            {/* View Mode: Split Wipe */}
            <Show when={viewMode() === "split_wipe"}>
              <DraggableSplitWipe
                wipePct={splitWipePct()}
                onWipeChange={setSplitWipePct}
                beforeLabel="ORIGINAL INPUT"
                afterLabel={`CUTOUT (${activeBackdrop().toUpperCase()})`}
                beforeContent={
                  <img
                    src={originalUri()}
                    alt="Original Input Frame"
                    class="w-full h-full object-contain pointer-events-none"
                  />
                }
                afterContent={
                  <img
                    src={segmentedUri()}
                    alt="Segmented Foreground Cutout Frame"
                    class="w-full h-full object-contain pointer-events-none"
                  />
                }
              />
            </Show>

            {/* View Mode: Cutout Only */}
            <Show when={viewMode() === "cutout_only"}>
              <img
                src={segmentedUri()}
                alt="Segmented Cutout PNG"
                class="w-full h-full object-contain pointer-events-none"
              />
            </Show>

            {/* View Mode: 8-Bit Alpha Mask */}
            <Show when={viewMode() === "alpha_mask"}>
              <img
                src={alphaMaskUri()}
                alt="8-bit Alpha Mask"
                class="w-full h-full object-contain pointer-events-none bg-slate-950"
              />
            </Show>

            {/* View Mode: Quick Mask (Ruby Tint Overlay) */}
            <Show when={viewMode() === "quick_mask"}>
              <div class="relative w-full h-full flex items-center justify-center">
                <img
                  src={originalUri()}
                  alt="Original RGB Frame"
                  class="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
                {/* Ruby Red Filter over masked regions */}
                <div
                  class="absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply"
                  style={{
                    "background-color": `rgba(239, 68, 68, ${quickMaskOpacity()})`,
                    "-webkit-mask-image": `url(${alphaMaskUri()})`,
                    "mask-image": `url(${alphaMaskUri()})`,
                    "-webkit-mask-size": "contain",
                    "mask-size": "contain",
                    "-webkit-mask-repeat": "no-repeat",
                    "mask-repeat": "no-repeat",
                    "-webkit-mask-position": "center",
                    "mask-position": "center",
                  }}
                />
              </div>
            </Show>
          </div>

          {/* Floating Viewport Controls HUD */}
          <ViewportControls
            zoom={zoom()}
            onZoomChange={setZoom}
            onReset={handleResetZoomPan}
            isPanActive={isPanActive()}
            onTogglePan={() => setIsPanActive((prev) => !prev)}
            class="absolute top-2.5 right-2.5"
          />

          {/* Interactive Pixel & Alpha Sampling Probe HUD */}
          <PixelProbeOverlay
            active={probeActive() && !isDraggingCanvas()}
            x={probePos().x}
            y={probePos().y}
            imgWidth={1024}
            imgHeight={1024}
            mode="alpha_matte"
            rgba={probeRgba()}
          />

          {/* Floating Source & Weight Tier Tag */}
          <div class="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-background/85 dark:bg-card/85 text-muted-foreground border border-border/80 backdrop-blur-sm font-mono text-[10px] pointer-events-none shadow-xs">
            {imgSourceLabel().slice(0, 24)} • {weightTier().toUpperCase()}
          </div>
        </div>
      </Show>
    </div>
  );
}
