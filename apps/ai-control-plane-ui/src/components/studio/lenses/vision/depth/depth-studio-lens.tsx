import { createSignal, createMemo, createEffect, Show, For, onMount, onCleanup } from "solid-js";
import {
  Layers,
  Download,
  Copy,
  Check,
  Eye,
  Sliders,
  Box,
  Palette,
  Maximize2,
  Gauge,
  SunMedium,
  Image as ImageIcon,
} from "lucide-solid";
import { DraggableSplitWipe } from "../shared/draggable-split-wipe";
import { ViewportControls } from "../shared/viewport-controls";
import { PixelProbeOverlay } from "../shared/pixel-probe-overlay";
import { Depth3DReliefCanvas } from "./depth-3d-relief-canvas";
import {
  renderProcessedDepthDataUri,
  createProceduralDepthField,
  createProceduralSourceDataUri,
} from "./depth-colormap-processor";

export interface DepthStudioLensProps {
  output: {
    depth_data_uri?: string;
    image_data_uri?: string;
    original_image_data_uri?: string;
    image_source?: string;
    colormap?: string;
    near_clip?: number;
    far_clip?: number;
    metric_depth_mode?: boolean;
    weight_tier?: string;
  };
  liveInputText?: string;
  liveParams?: Record<string, any>;
  activeWeightTier?: string;
  onChangeParam?: (key: string, val: any) => void;
}

export function DepthStudioLens(props: DepthStudioLensProps) {
  // View mode
  const [viewMode, setViewMode] = createSignal<
    "split_wipe" | "depth_only" | "rgb_overlay" | "mesh_3d" | "side_by_side"
  >("split_wipe");

  // Wipe percentage
  const [splitWipePct, setSplitWipePct] = createSignal<number>(50);

  // RGB Overlay opacity
  const [overlayOpacity, setOverlayOpacity] = createSignal<number>(0.65);

  // 3D Mesh controls
  const [displacementScale, setDisplacementScale] = createSignal<number>(0.42);
  const [wireframeMode, setWireframeMode] = createSignal<boolean>(false);
  const [meshTextureMode, setMeshTextureMode] = createSignal<"depth_colormap" | "rgb_texture">("depth_colormap");

  // Pan & Zoom (2D Viewports)
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

  // Pixel Probe State
  const [probeActive, setProbeActive] = createSignal<boolean>(false);
  const [probePos, setProbePos] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });
  const [probeDepthZ, setProbeDepthZ] = createSignal<number>(0.5);

  // Copy Feedback
  const [copiedUri, setCopiedUri] = createSignal<boolean>(false);

  // Offscreen sampling canvas for depth readout
  let samplingCanvas: HTMLCanvasElement | undefined;
  let samplingCtx: CanvasRenderingContext2D | null = null;
  let cachedSamplingImg: HTMLImageElement | null = null;
  let samplingImgUri: string = "";

  // Resolved parameters (reactive to liveParams, output, and fallback defaults)
  const activeColormap = createMemo(() =>
    String(props.liveParams?.colormap ?? props.output?.colormap ?? "turbo")
  );
  const nearClip = createMemo(() =>
    Number(props.liveParams?.near_clip ?? props.output?.near_clip ?? 0.1)
  );
  const farClip = createMemo(() =>
    Number(props.liveParams?.far_clip ?? props.output?.far_clip ?? 0.95)
  );
  const metricDepthMode = createMemo(() =>
    Boolean(props.liveParams?.metric_depth_mode ?? props.output?.metric_depth_mode ?? true)
  );
  const weightTier = createMemo(() =>
    props.activeWeightTier || props.output?.weight_tier || "balanced_fp16"
  );
  const imgSourceLabel = createMemo(() =>
    (props.liveInputText && props.liveInputText.trim()) ||
    props.output?.image_source ||
    "datacenter_rack_thermal.png"
  );

  // Procedural depth and source fallback generator
  const proceduralDepthField = createMemo(() =>
    createProceduralDepthField(640, 480, imgSourceLabel())
  );
  const proceduralSourceUri = createMemo(() =>
    createProceduralSourceDataUri(640, 480, imgSourceLabel())
  );

  // Effective original image URI (real binary or high-detail studio procedural frame)
  const effectiveOriginalUri = createMemo(() => {
    if (
      props.output?.original_image_data_uri &&
      props.output.original_image_data_uri.startsWith("data:image/")
    ) {
      return props.output.original_image_data_uri;
    }
    if (
      props.output?.image_data_uri &&
      props.output.image_data_uri.startsWith("data:image/") &&
      !props.output?.depth_data_uri
    ) {
      return props.output.image_data_uri;
    }
    return proceduralSourceUri();
  });

  // Cached decoded HTMLImageElement for backend depth map
  let backendDepthImg: HTMLImageElement | null = null;
  let backendDepthSourceUri: string = "";

  // Dynamic live colorized depth URI
  const [liveDepthUri, setLiveDepthUri] = createSignal<string>("");

  createEffect(() => {
    const colormap = activeColormap();
    const nClip = nearClip();
    const fClip = farClip();
    const rawBackendUri = props.output?.depth_data_uri || props.output?.image_data_uri || "";

    if (rawBackendUri && rawBackendUri.startsWith("data:image/")) {
      if (backendDepthSourceUri === rawBackendUri && backendDepthImg && backendDepthImg.complete) {
        // Fast path: cached image already decoded, recolor in <3ms
        const recolored = renderProcessedDepthDataUri(
          backendDepthImg,
          640,
          480,
          nClip,
          fClip,
          colormap
        );
        setLiveDepthUri(recolored);
      } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = rawBackendUri;
        img.onload = () => {
          backendDepthImg = img;
          backendDepthSourceUri = rawBackendUri;
          const recolored = renderProcessedDepthDataUri(
            img,
            640,
            480,
            nClip,
            fClip,
            colormap
          );
          setLiveDepthUri(recolored);
        };
      }
    } else {
      // Fallback: render procedural scene with current parameters
      const recolored = renderProcessedDepthDataUri(
        proceduralDepthField(),
        640,
        480,
        nClip,
        fClip,
        colormap
      );
      setLiveDepthUri(recolored);
    }
  });

  // Telemetry estimations
  const depthScale = () => (metricDepthMode() ? 4.5 : 1.0);
  const minZ = () => Number((nearClip() * depthScale()).toFixed(2));
  const maxZ = () => Number((farClip() * depthScale()).toFixed(2));
  const meanZ = () => Number((((nearClip() + farClip()) / 2) * depthScale()).toFixed(2));

  // Reset Zoom & Pan
  const handleResetZoomPan = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Canvas pointer move for sampling depth value
  const handleCanvasPointerMove = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const pixelX = Math.round(normX * 640);
    const pixelY = Math.round(normY * 480);
    setProbePos({ x: pixelX, y: pixelY });

    const uri = liveDepthUri();
    if (!uri) return;

    if (!samplingCanvas) {
      samplingCanvas = document.createElement("canvas");
      samplingCanvas.width = 640;
      samplingCanvas.height = 480;
      samplingCtx = samplingCanvas.getContext("2d", { willReadFrequently: true });
    }

    if (samplingImgUri !== uri || !cachedSamplingImg) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = uri;
      img.onload = () => {
        cachedSamplingImg = img;
        samplingImgUri = uri;
        samplingCtx?.drawImage(img, 0, 0, 640, 480);
        sampleDepthAtPixel(pixelX, pixelY);
      };
    } else {
      sampleDepthAtPixel(pixelX, pixelY);
    }
  };

  const sampleDepthAtPixel = (px: number, py: number) => {
    if (!samplingCtx) return;
    try {
      const pixel = samplingCtx.getImageData(px, py, 1, 1).data;
      // Convert RGB / Grayscale to depth metric
      const rawBrightness = (pixel[0] * 0.299 + pixel[1] * 0.587 + pixel[2] * 0.114) / 255.0;
      const computedZ = metricDepthMode()
        ? rawBrightness * depthScale()
        : rawBrightness;
      setProbeDepthZ(computedZ);
      setProbeActive(true);
    } catch {}
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

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || isPanActive()) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoom((z) => Math.max(0.25, Math.min(4.0, Number((z + delta).toFixed(2)))));
    }
  };

  // Copy Depth Map Data URI
  const handleCopyDepthUri = async () => {
    const uri = liveDepthUri();
    if (!uri) return;
    await navigator.clipboard.writeText(uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  return (
    <div class="space-y-3.5">
      {/* 1. Depth Perception Telemetry Strip */}
      <div class="grid grid-cols-5 gap-2 font-mono text-[11px] tabular-nums">
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">NEAR MIN</span>
          <span class="text-primary font-bold">
            {minZ()}{metricDepthMode() ? "m" : ""}
          </span>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">MEAN Z</span>
          <span class="text-success font-bold">
            {meanZ()}{metricDepthMode() ? "m" : ""}
          </span>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">FAR MAX</span>
          <span class="text-primary font-bold">
            {maxZ()}{metricDepthMode() ? "m" : ""}
          </span>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">SCALE</span>
          <button
            type="button"
            onClick={() => props.onChangeParam?.("metric_depth_mode", !metricDepthMode())}
            class={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition border ${
              metricDepthMode()
                ? "bg-primary/20 text-primary border-primary/50"
                : "bg-muted text-muted-foreground border-border hover:text-foreground"
            }`}
            title="Toggle Metric Meters / Normalized Depth"
          >
            {metricDepthMode() ? "Metric (m)" : "Norm [0..1]"}
          </button>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">TIER</span>
          <span class="text-foreground font-bold uppercase">
            {weightTier().split("_")[0]}
          </span>
        </div>
      </div>

      {/* 2. Interactive Controls & Mode Selector */}
      <div class="p-3 rounded-xl border border-border bg-surface/70 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <Layers class="w-3.5 h-3.5 text-primary" />
            <span>Depth-Anything-V2 Studio ({metricDepthMode() ? "Metric Meters" : "Normalized"})</span>
          </span>

          {/* Mode Selector Chips */}
          <div class="flex flex-wrap items-center gap-1" role="tablist" aria-label="Depth View Modes">
            <For
              each={[
                { id: "split_wipe", label: "Split Wipe" },
                { id: "depth_only", label: "Depth Heatmap" },
                { id: "rgb_overlay", label: "RGB Overlay" },
                { id: "mesh_3d", label: "3D Spatial Mesh" },
                { id: "side_by_side", label: "2-Up Compare" },
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

        {/* Colormap & Clipping Palette Bar */}
        <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
          {/* Colormap Selector */}
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
              <Palette class="w-3 h-3 text-primary" />
              <span>Colormap:</span>
            </span>
            <div class="flex flex-wrap items-center gap-1">
              <For each={["turbo", "magma", "viridis", "grayscale"]}>
                {(pal) => (
                  <button
                    type="button"
                    onClick={() => props.onChangeParam?.("colormap", pal)}
                    class={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border transition ${
                      activeColormap() === pal
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {pal}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Near & Far Clipping Sliders */}
          <div class="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            <div class="flex items-center gap-1.5">
              <span>Near:</span>
              <input
                type="range"
                min={0.0}
                max={0.6}
                step={0.02}
                value={nearClip()}
                onInput={(e) => props.onChangeParam?.("near_clip", parseFloat(e.currentTarget.value))}
                class="studio-slider w-16"
                aria-label="Near Clipping Plane"
              />
              <span class="tabular-nums font-semibold text-foreground">
                {nearClip().toFixed(2)}m
              </span>
            </div>

            <div class="flex items-center gap-1.5">
              <span>Far:</span>
              <input
                type="range"
                min={0.4}
                max={1.0}
                step={0.02}
                value={farClip()}
                onInput={(e) => props.onChangeParam?.("far_clip", parseFloat(e.currentTarget.value))}
                class="studio-slider w-16"
                aria-label="Far Horizon Plane"
              />
              <span class="tabular-nums font-semibold text-foreground">
                {farClip().toFixed(2)}m
              </span>
            </div>
          </div>

          {/* 3D Mesh Specific Controls */}
          <Show when={viewMode() === "mesh_3d"}>
            <div class="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <div class="flex items-center gap-1">
                <span>Extrude:</span>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={displacementScale()}
                  onInput={(e) => setDisplacementScale(parseFloat(e.currentTarget.value))}
                  class="studio-slider w-14"
                  aria-label="3D Depth Displacement Scale"
                />
                <span class="tabular-nums font-semibold text-foreground">{displacementScale().toFixed(2)}x</span>
              </div>

              {/* Texture Mode Toggle */}
              <button
                type="button"
                onClick={() =>
                  setMeshTextureMode((prev) =>
                    prev === "depth_colormap" ? "rgb_texture" : "depth_colormap"
                  )
                }
                class={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                  meshTextureMode() === "rgb_texture"
                    ? "bg-primary text-primary-foreground border-primary font-semibold"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
                title="Toggle between Colormap vs Photo Texture"
              >
                <ImageIcon class="w-3 h-3" />
                <span>{meshTextureMode() === "rgb_texture" ? "Photo" : "Colormap"}</span>
              </button>

              <button
                type="button"
                onClick={() => setWireframeMode((prev) => !prev)}
                class={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                  wireframeMode()
                    ? "bg-primary text-primary-foreground border-primary font-semibold"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
                title="Toggle 3D Wireframe Mesh"
              >
                <Box class="w-3 h-3" />
                <span>{wireframeMode() ? "Wire" : "Solid"}</span>
              </button>
            </div>
          </Show>

          {/* RGB Overlay Opacity Slider */}
          <Show when={viewMode() === "rgb_overlay"}>
            <div class="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span>Heatmap Blend:</span>
              <input
                type="range"
                min={0.1}
                max={0.95}
                step={0.05}
                value={overlayOpacity()}
                onInput={(e) => setOverlayOpacity(parseFloat(e.currentTarget.value))}
                class="studio-slider w-20"
                aria-label="Depth Heatmap Blend Opacity"
              />
              <span class="tabular-nums font-semibold text-foreground">{Math.round(overlayOpacity() * 100)}%</span>
            </div>
          </Show>

          {/* Action Buttons: Copy & Download */}
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyDepthUri}
              class="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1 transition shadow-xs"
              title="Copy Depth Map URI"
            >
              <Show when={copiedUri()} fallback={<Copy class="w-3 h-3 text-muted-foreground" />}>
                <Check class="w-3 h-3 text-success" />
              </Show>
              <span>{copiedUri() ? "Copied!" : "Copy URI"}</span>
            </button>

            <Show when={liveDepthUri()}>
              <a
                href={liveDepthUri()}
                download="depth_anything_heatmap.png"
                class="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-card hover:bg-primary hover:text-primary-foreground text-foreground flex items-center gap-1 transition shadow-xs"
                title="Download Colorized Depth Map PNG"
              >
                <Download class="w-3 h-3" />
                <span>Depth PNG</span>
              </a>
            </Show>
          </div>
        </div>
      </div>

      {/* 3. Main Viewport Canvas */}
      <Show
        when={viewMode() !== "mesh_3d"}
        fallback={
          /* WebGL 2.5D Interactive Spatial Relief Canvas */
          <div class="relative w-full h-80 rounded-2xl border border-border overflow-hidden bg-slate-950 shadow-lg">
            <Depth3DReliefCanvas
              depthMapUri={liveDepthUri()}
              textureUri={effectiveOriginalUri()}
              displacementScale={displacementScale()}
              wireframe={wireframeMode()}
              nearClip={nearClip()}
              farClip={farClip()}
              colormap={activeColormap()}
              textureMode={meshTextureMode()}
            />
          </div>
        }
      >
        <Show
          when={viewMode() !== "side_by_side"}
          fallback={
            /* 2-Up Side-by-Side View */
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded-xl border border-border overflow-hidden bg-muted/20 flex flex-col">
                <div class="px-2.5 py-1 bg-surface border-b border-border font-mono text-[10px] text-foreground font-semibold flex items-center justify-between">
                  <span>1. Original RGB Input</span>
                  <span class="text-muted-foreground font-normal">Source</span>
                </div>
                <img
                  src={effectiveOriginalUri()}
                  alt="Original RGB Frame"
                  class="w-full h-64 object-contain bg-slate-950/40"
                />
              </div>
              <div class="rounded-xl border border-border overflow-hidden bg-muted/20 flex flex-col">
                <div class="px-2.5 py-1 bg-surface border-b border-border font-mono text-[10px] text-foreground font-semibold flex items-center justify-between">
                  <span>2. Neural Depth Heatmap</span>
                  <span class="text-primary font-normal uppercase">{activeColormap()}</span>
                </div>
                <img
                  src={liveDepthUri()}
                  alt="Depth Map Frame"
                  class="w-full h-64 object-contain bg-slate-950"
                />
              </div>
            </div>
          }
        >
          <div
            class={`relative w-full h-80 rounded-2xl border border-border overflow-hidden bg-slate-950 shadow-lg select-none ${
              isPanActive() ? (isDraggingCanvas() ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair"
            }`}
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
                  afterLabel={`DEPTH (${activeColormap().toUpperCase()})`}
                  beforeContent={
                    <img
                      src={effectiveOriginalUri()}
                      alt="Original Input Frame"
                      class="w-full h-full object-contain pointer-events-none"
                    />
                  }
                  afterContent={
                    <img
                      src={liveDepthUri()}
                      alt="Depth Heatmap Frame"
                      class="w-full h-full object-contain pointer-events-none"
                    />
                  }
                />
              </Show>

              {/* View Mode: Depth Map Only */}
              <Show when={viewMode() === "depth_only"}>
                <img
                  src={liveDepthUri()}
                  alt="Depth Map"
                  class="w-full h-full object-contain pointer-events-none"
                />
              </Show>

              {/* View Mode: RGB Overlay */}
              <Show when={viewMode() === "rgb_overlay"}>
                <div class="relative w-full h-full flex items-center justify-center">
                  <img
                    src={effectiveOriginalUri()}
                    alt="Original Input Frame"
                    class="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                  <img
                    src={liveDepthUri()}
                    alt="Depth Heatmap Overlay"
                    class="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{ opacity: overlayOpacity() }}
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

            {/* Interactive Depth Sampling Probe HUD */}
            <PixelProbeOverlay
              active={probeActive() && !isDraggingCanvas()}
              x={probePos().x}
              y={probePos().y}
              imgWidth={640}
              imgHeight={480}
              mode="depth"
              depthValue={probeDepthZ()}
              isMetric={metricDepthMode()}
            />

            {/* Floating Source Tag */}
            <div class="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-background/85 dark:bg-card/85 text-muted-foreground border border-border/80 backdrop-blur-sm font-mono text-[10px] pointer-events-none shadow-xs">
              {imgSourceLabel().slice(0, 24)} • Depth-Anything-V2 ({activeColormap().toUpperCase()})
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
