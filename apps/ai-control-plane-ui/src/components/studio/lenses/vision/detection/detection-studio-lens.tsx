import { createSignal, createMemo, Show, For } from "solid-js";
import { Filter } from "lucide-solid";
import { deterministicHashBytes } from "../../lens-utils";

export interface VisionDetection {
  id: string;
  label: string;
  category: string;
  confidence: number;
  iou_overlap?: number;
  box: { x: number; y: number; w: number; h: number };
  color: string;
  mask_polygon?: number[][];
}

export interface DetectionStudioLensProps {
  output: {
    image_source?: string;
    weight_tier?: string;
    iou_threshold?: number;
    depth_map_grid?: number[][];
    detections?: VisionDetection[];
  };
  liveInputText?: string;
  liveParams?: Record<string, any>;
  activeWeightTier?: string;
  liveConfidenceThreshold: number;
  onChangeConfidenceThreshold: (val: number) => void;
  liveClassFilter: string;
  onChangeClassFilter: (val: string) => void;
  showSegmentationMasks: boolean;
}

export function DetectionStudioLens(props: DetectionStudioLensProps) {
  const [hoveredId, setHoveredId] = createSignal<string | null>(null);
  const [depthOverlayOpacity, setDepthOverlayOpacity] = createSignal<number>(0.25);

  const imgSourceLabel = createMemo(() =>
    (props.liveInputText && props.liveInputText.trim()) ||
    props.output?.image_source ||
    "portrait_fine_hair_4k.png"
  );

  const weightTier = createMemo(() =>
    props.activeWeightTier || props.output?.weight_tier || "balanced_fp16"
  );

  const liveIouThreshold = createMemo(() =>
    Number(props.liveParams?.iou_threshold ?? props.output?.iou_threshold ?? 0.45)
  );

  // Scene Detections
  const sceneDetections = createMemo<VisionDetection[]>(() => {
    if (props.output?.detections && props.output.detections.length > 0) {
      return props.output.detections;
    }
    const low = imgSourceLabel().toLowerCase();
    const tier = weightTier();
    const tierConfMod = tier.includes("int4")
      ? -0.025
      : tier.includes("ultra")
      ? 0.005
      : 0;

    if (low.includes("datacenter") || low.includes("rack")) {
      return [
        {
          id: "det-dc-1",
          label: "h100_nvlink_server_blade",
          category: "hardware",
          confidence: Math.min(0.999, 0.994 + tierConfMod),
          iou_overlap: 0.18,
          box: { x: 0.08, y: 0.12, w: 0.46, h: 0.76 },
          color: "#10b981",
          mask_polygon: [
            [0.08, 0.12],
            [0.54, 0.12],
            [0.54, 0.88],
            [0.08, 0.88],
          ],
        },
        {
          id: "det-dc-2",
          label: "qsfp_optical_transceiver",
          category: "hardware",
          confidence: Math.min(0.999, 0.971 + tierConfMod),
          iou_overlap: 0.28,
          box: { x: 0.58, y: 0.22, w: 0.34, h: 0.28 },
          color: "#38bdf8",
          mask_polygon: [
            [0.58, 0.22],
            [0.92, 0.22],
            [0.92, 0.5],
            [0.58, 0.5],
          ],
        },
        {
          id: "det-dc-3",
          label: "power_distribution_unit",
          category: "hardware",
          confidence: Math.max(0.1, 0.892 + tierConfMod),
          iou_overlap: 0.48,
          box: { x: 0.58, y: 0.54, w: 0.36, h: 0.34 },
          color: "#f59e0b",
          mask_polygon: [
            [0.58, 0.54],
            [0.94, 0.54],
            [0.94, 0.88],
            [0.58, 0.88],
          ],
        },
      ];
    }

    return [
      {
        id: "det-1",
        label: "voice_actor_primary",
        category: "person",
        confidence: Math.min(0.999, 0.992 + tierConfMod),
        iou_overlap: 0.16,
        box: { x: 0.16, y: 0.1, w: 0.54, h: 0.82 },
        color: "#10b981",
        mask_polygon: [
          [0.2, 0.12],
          [0.66, 0.12],
          [0.7, 0.9],
          [0.16, 0.9],
        ],
      },
      {
        id: "det-2",
        label: "studio_condenser_mic",
        category: "hardware",
        confidence: Math.min(0.999, 0.964 + tierConfMod),
        iou_overlap: 0.36,
        box: { x: 0.54, y: 0.34, w: 0.24, h: 0.52 },
        color: "#38bdf8",
        mask_polygon: [
          [0.56, 0.36],
          [0.76, 0.36],
          [0.78, 0.84],
          [0.54, 0.84],
        ],
      },
      {
        id: "det-3",
        label: "acoustic_monitor_panel",
        category: "hardware",
        confidence: Math.max(0.1, 0.875 + tierConfMod),
        iou_overlap: 0.54,
        box: { x: 0.06, y: 0.18, w: 0.26, h: 0.38 },
        color: "#f59e0b",
        mask_polygon: [
          [0.06, 0.18],
          [0.32, 0.18],
          [0.32, 0.56],
          [0.06, 0.56],
        ],
      },
      {
        id: "det-4",
        label: "cable_routing_anomaly",
        category: "defect",
        confidence: Math.max(0.1, 0.42 + tierConfMod),
        iou_overlap: 0.74,
        box: { x: 0.72, y: 0.68, w: 0.21, h: 0.22 },
        color: "#ef4444",
        mask_polygon: [
          [0.72, 0.68],
          [0.93, 0.68],
          [0.93, 0.9],
          [0.72, 0.9],
        ],
      },
    ];
  });

  const visibleDetections = createMemo(() => {
    const all = sceneDetections();
    const conf = props.liveConfidenceThreshold;
    const iou = liveIouThreshold();
    const filter = props.liveClassFilter;

    return all.filter((d) => {
      const passConf = d.confidence >= conf;
      const passIou = (d.iou_overlap ?? 0.2) <= Math.max(0.2, iou + 0.15);
      const passClass =
        !filter ||
        filter === "all" ||
        d.category.toLowerCase() === filter.toLowerCase() ||
        d.label.toLowerCase().includes(filter.toLowerCase());
      return passConf && passIou && passClass;
    });
  });

  return (
    <div class="space-y-3.5">
      <div class="p-3 rounded-xl border border-border bg-surface/70 space-y-2.5">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-semibold text-foreground flex items-center gap-1.5">
            <Filter class="w-3.5 h-3.5 text-primary" />
            <span>
              60 FPS Confidence ≥{(props.liveConfidenceThreshold * 100).toFixed(0)}% • NMS IoU ≤
              {(liveIouThreshold() * 100).toFixed(0)}% ({weightTier().toUpperCase()})
            </span>
          </span>
          <span class="font-mono text-primary font-bold tabular-nums">
            {visibleDetections().length}/{sceneDetections().length} boxes active
          </span>
        </div>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.05}
          value={props.liveConfidenceThreshold}
          onInput={(e) => props.onChangeConfidenceThreshold(parseFloat(e.currentTarget.value))}
          aria-label="Live 60 FPS Confidence Threshold"
          class="studio-slider w-full"
        />

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div class="flex flex-wrap items-center gap-1">
            <For each={["all", "hardware", "person", "defect"]}>
              {(cls) => (
                <button
                  type="button"
                  onClick={() => props.onChangeClassFilter(cls)}
                  class={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition border ${
                    props.liveClassFilter === cls
                      ? "bg-primary text-primary-foreground border-primary font-semibold"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {cls}
                </button>
              )}
            </For>
          </div>

          <div class="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <span>Depth Overlay:</span>
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.05}
              value={depthOverlayOpacity()}
              onInput={(e) => setDepthOverlayOpacity(parseFloat(e.currentTarget.value))}
              class="studio-slider w-20"
              aria-label="Depth Map Opacity"
            />
          </div>
        </div>
      </div>

      <div class="relative w-full h-56 rounded-xl border border-border overflow-hidden bg-surface select-none">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          class="w-full h-full"
          aria-label="2D Computer Vision Detection Canvas"
        >
          <defs>
            <pattern id="vision-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="rgba(148, 163, 184, 0.12)"
                stroke-width="0.4"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#vision-grid)" />

          <Show when={depthOverlayOpacity() > 0 && props.output?.depth_map_grid}>
            <For each={props.output.depth_map_grid}>
              {(row, rIdx) => (
                <For each={row}>
                  {(val, cIdx) => (
                    <rect
                      x={cIdx() * 12.5}
                      y={rIdx() * 12.5}
                      width={12.5}
                      height={12.5}
                      fill={`rgba(56, 189, 248, ${(val * depthOverlayOpacity()).toFixed(2)})`}
                    />
                  )}
                </For>
              )}
            </For>
          </Show>

          <For each={visibleDetections()}>
            {(det) => {
              const isHovered = () => hoveredId() === det.id;
              const bx = () => det.box.x * 100;
              const by = () => det.box.y * 100;
              const bw = () => det.box.w * 100;
              const bh = () => det.box.h * 100;
              const pointsStr = () => (det.mask_polygon ?? []).map(([px, py]) => `${px * 100},${py * 100}`).join(" ");

              return (
                <g
                  onMouseEnter={() => setHoveredId(det.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  class="cursor-pointer"
                >
                  <Show when={props.showSegmentationMasks && pointsStr()}>
                    <polygon
                      points={pointsStr()}
                      fill={det.color}
                      fill-opacity={isHovered() ? 0.38 : 0.2}
                      stroke={det.color}
                      stroke-width={isHovered() ? 0.9 : 0.4}
                      stroke-dasharray="1.5,1"
                    />
                  </Show>
                  <rect
                    x={bx()}
                    y={by()}
                    width={bw()}
                    height={bh()}
                    fill="none"
                    stroke={det.color}
                    stroke-width={isHovered() ? 1.2 : 0.7}
                    rx="1"
                  />
                  <rect
                    x={bx()}
                    y={Math.max(0, by() - 6.5)}
                    width={Math.min(100 - bx(), Math.max(26, det.label.length * 2.1))}
                    height="6.2"
                    fill={det.color}
                    rx="0.8"
                  />
                  <text
                    x={bx() + 1.2}
                    y={Math.max(4.5, by() - 1.8)}
                    fill="#020617"
                    font-size="3.4"
                    font-weight="bold"
                    font-family="monospace"
                  >
                    {det.label} {(det.confidence * 100).toFixed(0)}%
                  </text>
                </g>
              );
            }}
          </For>
        </svg>

        <div class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-background/90 text-foreground border border-border backdrop-blur-sm font-mono text-[10px]">
          {imgSourceLabel().slice(0, 28)} • RT-DETR-v2 ({weightTier().toUpperCase()})
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <For each={visibleDetections()}>
          {(det) => (
            <span
              onMouseEnter={() => setHoveredId(det.id)}
              onMouseLeave={() => setHoveredId(null)}
              class="text-[10px] font-mono px-2 py-0.5 rounded-md border border-border bg-surface/80 flex items-center gap-1.5 cursor-pointer hover:border-primary"
            >
              <span class="w-2 h-2 rounded-full" style={{ "background-color": det.color }} />
              <span class="text-foreground font-medium">{det.label}</span>
              <span class="text-primary font-semibold">
                {(det.confidence * 100).toFixed(1)}%
              </span>
            </span>
          )}
        </For>
      </div>
    </div>
  );
}
