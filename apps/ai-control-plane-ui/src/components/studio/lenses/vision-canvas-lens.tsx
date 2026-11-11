import { createMemo, Switch, Match } from "solid-js";
import { SegmentationStudioLens } from "./vision/segmentation/segmentation-studio-lens";
import { DepthStudioLens } from "./vision/depth/depth-studio-lens";
import {
  DetectionStudioLens,
  type VisionDetection,
} from "./vision/detection/detection-studio-lens";

export type { VisionDetection };

export interface VisionVisualizerProps {
  output: {
    vision_submode?: "alpha_matte_segmentation" | "monocular_depth" | "object_detection";
    pipeline_type?: string;
    image_source?: string;
    original_image_data_uri?: string;
    segmented_image_data_uri?: string;
    alpha_mask_data_uri?: string;
    image_data_uri?: string;
    confidence_threshold?: number;
    iou_threshold?: number;
    class_filter?: string;
    mask_threshold?: number;
    edge_feather_px?: number;
    background_mode?: string;
    output_resolution?: string;
    refine_hair_foreground?: boolean;
    weight_tier?: string;
    foreground_coverage_pct?: number;
    hair_edge_snr_db?: number;
    alpha_matte_grid?: number[][];
    colormap?: string;
    near_clip?: number;
    far_clip?: number;
    metric_depth_mode?: boolean;
    detections?: VisionDetection[];
    depth_map_grid?: number[][];
  };
  pipelineType?: string;
  liveInputText?: string;
  liveParams?: Record<string, any>;
  activeWeightTier?: string;
  onChangeParam?: (key: string, val: any) => void;
  liveConfidenceThreshold: number;
  onChangeConfidenceThreshold: (val: number) => void;
  liveClassFilter: string;
  onChangeClassFilter: (val: string) => void;
  showSegmentationMasks: boolean;
}

export function VisionCanvasLens(props: VisionVisualizerProps) {
  const resolvedSubmode = createMemo(() =>
    props.output?.vision_submode ??
    (props.pipelineType === "image-segmentation" || props.output?.pipeline_type === "image-segmentation"
      ? "alpha_matte_segmentation"
      : props.pipelineType === "depth-estimation" || props.output?.pipeline_type === "depth-estimation"
      ? "monocular_depth"
      : "object_detection")
  );

  return (
    <Switch>
      {/* 1. Studio-Grade Alpha Matte & Cutout Segmentation Workspace */}
      <Match when={resolvedSubmode() === "alpha_matte_segmentation"}>
        <SegmentationStudioLens
          output={props.output}
          liveInputText={props.liveInputText}
          liveParams={props.liveParams}
          activeWeightTier={props.activeWeightTier}
          onChangeParam={props.onChangeParam}
          liveConfidenceThreshold={props.liveConfidenceThreshold}
        />
      </Match>

      {/* 2. Studio-Grade Monocular 3D Depth Perception & WebGL Mesh Workspace */}
      <Match when={resolvedSubmode() === "monocular_depth"}>
        <DepthStudioLens
          output={props.output}
          liveInputText={props.liveInputText}
          liveParams={props.liveParams}
          activeWeightTier={props.activeWeightTier}
          onChangeParam={props.onChangeParam}
        />
      </Match>

      {/* 3. Real-Time Object Detection & Bounding Box Workspace */}
      <Match when={true}>
        <DetectionStudioLens
          output={props.output}
          liveInputText={props.liveInputText}
          liveParams={props.liveParams}
          activeWeightTier={props.activeWeightTier}
          liveConfidenceThreshold={props.liveConfidenceThreshold}
          onChangeConfidenceThreshold={props.onChangeConfidenceThreshold}
          liveClassFilter={props.liveClassFilter}
          onChangeClassFilter={props.onChangeClassFilter}
          showSegmentationMasks={props.showSegmentationMasks}
        />
      </Match>
    </Switch>
  );
}
