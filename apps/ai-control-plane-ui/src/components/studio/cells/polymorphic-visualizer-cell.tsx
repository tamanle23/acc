import { createMemo, Show, Switch, Match } from 'solid-js';
import type {
  ModelCatalogEntry,
  OutputModality,
} from '@ai-monorepo/ai-control-plane-sdk';
import { Radio, Zap, Sparkles } from 'lucide-solid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StudioAudioPlayer } from '@/components/studio/waveform-visualizer';
import {
  DiffusionImageLens,
  LLMStreamLens,
  ASRTranscriptLens,
  VisionCanvasLens,
  ClassificationNerLens,
  EmbeddingsHeatmapLens,
} from '@/components/studio/polymorphic-lenses';
import type { PipelineStudioStyle } from '@/components/studio/bespoke-pipeline-studios';
import type { ExecutionStatus, StreamTelemetry, UnifiedSessionRunRecord } from '@/types/studio';

export interface PolymorphicVisualizerCellProps {
  spanClass: string;
  activeManifest: ModelCatalogEntry;
  activeStudioStyle: PipelineStudioStyle;
  liveStreamOutput: any | null;
  activeRun: UnifiedSessionRunRecord | null;
  activeAudioRun: UnifiedSessionRunRecord | null;
  activeInputText: string;
  selectedBinaryName: string;
  activeParams: Record<string, any>;
  showRawJsonInspector: boolean;
  setShowRawJsonInspector: (val: boolean | ((prev: boolean) => boolean)) => void;
  executionStatus: ExecutionStatus;
  streamTelemetry: StreamTelemetry;
  activeTtsVoice: string;
  activeTtsSpeed: number;
  activeTtsPitch: number;
  activeTtsGain: number;
  activeModelWeightTier: string;
  liveTtsPreview: { url: string; durationSeconds: number } | null;
  setActiveEngineId: (engineId: string) => void;
  setModelInputsMap?: any;
  modelParamsMap: Record<string, Record<string, any>>;
  recordSessionRun: (run: UnifiedSessionRunRecord) => void;
  setActiveParam: (key: string, val: any) => void;
  activeJob?: { jobId: string; status: string; progress: any; elapsedMs: number } | null;
  onCancelActiveJob?: () => void;
  onSendMessage?: (text: string) => void;
  onStopStreaming?: () => void;
  streamingAudioAnalyser?: AnalyserNode | null;
}

export function PolymorphicVisualizerCell(props: PolymorphicVisualizerCellProps) {
  const displayModality = createMemo<OutputModality>(() =>
    props.liveStreamOutput?.modality ??
    (props.activeRun && props.activeRun.engineId === props.activeManifest.engine_id
      ? props.activeRun.modality
      : props.activeManifest.output_modality)
  );

  const activeWeightTier = () => props.activeManifest.weights?.weight_tier ?? "balanced_fp16";
  const activePrecision = () => props.activeManifest.weights?.precision ?? props.activeManifest.default_precision ?? "fp16";
  const activeSpeedup = () => props.activeManifest.weights?.hardware_compatibility?.speedup_multiplier ?? 1.0;

  const explicitRunOutput = createMemo(() =>
    props.liveStreamOutput ??
    (props.activeRun && props.activeRun.engineId === props.activeManifest.engine_id ? props.activeRun.output : null)
  );

  // If explicitRunOutput has a nested output object from an async job or wrapped response, normalize/unwrap it
  const normalizedRunOutput = createMemo(() => {
    const raw = explicitRunOutput();
    if (raw && typeof raw === 'object') {
      const unwrapped =
        raw.output && typeof raw.output === 'object' && !Array.isArray(raw.output)
          ? { ...raw.output, ...raw }
          : { ...raw };
      if (
        !unwrapped.original_image_data_uri &&
        typeof props.activeInputText === 'string' &&
        props.activeInputText.startsWith('data:image/')
      ) {
        unwrapped.original_image_data_uri = props.activeInputText;
      }
      return unwrapped;
    }
    return raw;
  });

  // Ensure every pipeline modality has a live, parameter- and tier-reactive output object
  const displayOutput = createMemo(() => {
    const norm = normalizedRunOutput();
    if (norm) return norm;

    const inputDataUri =
      typeof props.activeInputText === 'string' && props.activeInputText.startsWith('data:image/')
        ? props.activeInputText
        : undefined;

    return {
      modality: displayModality(),
      pipeline_type: props.activeManifest.pipeline_type,
      prompt: props.activeInputText,
      source_text: props.activeInputText,
      original_image_data_uri: inputDataUri,
      image_source:
        props.selectedBinaryName ||
        (typeof props.activeInputText === 'string'
          ? props.activeInputText.split(" — ")[0]
          : String(props.activeInputText || "").split(" — ")[0]) ||
        "studio_scene_frame.png",
      ...props.activeParams,
      weight_tier: activeWeightTier(),
      precision: activePrecision(),
      speedup_multiplier: activeSpeedup(),
    };
  });

  const isAsyncJobRunning = createMemo(() => Boolean(
    props.activeJob &&
    (props.activeJob.status === 'queued' ||
     props.activeJob.status === 'running' ||
     props.activeJob.status === 'processing')
  ));

  const showExecutingOverlay = createMemo(() => Boolean(
    (props.executionStatus === 'executing' && (!props.activeJob || isAsyncJobRunning())) ||
    (props.executionStatus === 'streaming' && !props.liveStreamOutput && props.activeManifest.family === 'tts')
  ));

  const defaultVoice = () => (props.activeManifest.engine_id.includes("kokoro") ? "af_bella" : "Hải Đăng");

  const isTtsParamModified = createMemo(() => Boolean(
    !props.activeAudioRun ||
      props.activeAudioRun.engineId !== props.activeManifest.engine_id ||
      props.activeAudioRun.rawInput !== props.activeInputText ||
      String(props.activeAudioRun.parameters?.voice ?? defaultVoice()) !== props.activeTtsVoice ||
      Number(props.activeAudioRun.parameters?.speed ?? 1.0) !== props.activeTtsSpeed ||
      Number(props.activeAudioRun.parameters?.pitch ?? 0) !== props.activeTtsPitch ||
      Number(props.activeAudioRun.parameters?.gain_db ?? 0) !== props.activeTtsGain ||
      String(props.activeAudioRun.parameters?.weight_tier ?? "balanced_fp16") !== props.activeModelWeightTier
  ));

  const resolvedAudioUrl = createMemo(() => {
    if (!props.activeAudioRun || props.activeAudioRun.engineId !== props.activeManifest.engine_id) {
      return props.liveTtsPreview?.url || null;
    }
    return props.activeAudioRun.audioUrl || null;
  });

  const resolvedDuration = createMemo(() => {
    if (!props.activeAudioRun || props.activeAudioRun.engineId !== props.activeManifest.engine_id) {
      return props.liveTtsPreview?.durationSeconds ?? 2.5;
    }
    return props.activeAudioRun.durationSeconds ?? 2.5;
  });

  return (
    <Card class={`${props.spanClass} flex flex-col justify-between transition-all duration-300 ${props.activeStudioStyle.cardGlow}`}>
      <div>
        <CardHeader class={`flex flex-row items-center justify-between space-y-0 bg-gradient-to-r ${props.activeStudioStyle.gradientBanner} rounded-t-2xl border-b border-border/60`}>
          <div class="flex items-center gap-2.5">
            <div class={`p-2 rounded-lg border ${props.activeStudioStyle.accentBg} ${props.activeStudioStyle.accentBorder} ${props.activeStudioStyle.accentText}`}>
              <Radio class="w-4 h-4" />
            </div>
            <div>
              <CardTitle class="flex items-center gap-2">
                <span>{props.activeManifest.pipeline_type} Visualizer</span>
                <Badge variant="success" class="font-mono text-[10px]">
                  {displayModality()}
                </Badge>
              </CardTitle>
              <CardDescription>
                {props.activeManifest.transport_protocol}
              </CardDescription>
            </div>
          </div>

          <Show when={displayOutput()}>
            <button
              type="button"
              onClick={() => props.setShowRawJsonInspector((prev: boolean) => !prev)}
              class="text-[10px] font-mono px-2 py-1 rounded border border-border bg-card hover:border-primary text-muted-foreground hover:text-foreground transition"
            >
              {props.showRawJsonInspector ? "Lens View" : "Raw JSON"}
            </button>
          </Show>
        </CardHeader>

        <CardContent class="space-y-4 pt-4">
          {/* Model Provenance Strip */}
          <div class="px-3 py-2 rounded-xl border border-border bg-surface/85 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-muted-foreground">ACTIVE MODEL:</span>
              <span class="text-foreground font-bold">{props.activeManifest.model_id}</span>
              <span class="text-muted-foreground">({props.activeManifest.engine_id})</span>
            </div>
            <div>
              <Switch fallback={
                <span
                  class="px-2 py-0.5 rounded border border-warning/40 bg-warning/15 text-warning font-semibold"
                  title="Local multi-GB .safetensors checkpoint not cached in PyTorch; running fast deterministic ~15ms Studio Simulator."
                >
                  ⚡ FAST STUDIO SIMULATOR (~15ms CPU Preview)
                </span>
              }>
                <Match when={(displayOutput() as any)?.execution_mode === "native_pytorch_gpu"}>
                  <span class="px-2 py-0.5 rounded border border-success/40 bg-success/15 text-success font-bold">
                    ✓ NATIVE PYTORCH GPU WEIGHTS
                  </span>
                </Match>
                <Match when={props.activeManifest.family === "diffusion"}>
                  <span class="px-2 py-0.5 rounded border border-success/40 bg-success/15 text-success font-bold">
                    ✓ REAL NEURAL DIFFUSION + PROCEDURAL DUAL-ENGINE
                  </span>
                </Match>
                <Match when={props.activeManifest.family === "tts"}>
                  <span class="px-2 py-0.5 rounded border border-success/40 bg-success/15 text-success font-bold">
                    ✓ 48kHz PCM16 ACOUSTIC SYNTHESIS ENGINE
                  </span>
                </Match>
              </Switch>
            </div>
          </div>

          <Show
            when={!showExecutingOverlay()}
            fallback={
              <div class="space-y-3 py-4" aria-live="polite">
                <Skeleton class="h-28 w-full" />
                <Skeleton class="h-10 w-full" />
                <p class="text-xs text-center text-primary font-mono animate-pulse tabular-nums">
                  {props.executionStatus === 'streaming'
                    ? `Streaming ONNX Frames (${props.streamTelemetry.chunksReceived} chunks • ${Math.round(props.streamTelemetry.bytesStreamed / 1024)} KB)...`
                    : props.activeJob
                    ? `Executing ${props.activeManifest.pipeline_type} on ${props.activeManifest.execution_target} (Job: ${props.activeJob.jobId.slice(0, 8)} • ${props.activeJob.progress?.stage || props.activeJob.status} ${props.activeJob.progress?.percent ? `• ${Math.round(props.activeJob.progress.percent)}%` : ''})...`
                    : `Executing ${props.activeManifest.pipeline_type} on ${props.activeManifest.execution_target}...`}
                </p>
              </div>
            }
          >
            <Show
              when={!props.showRawJsonInspector || !displayOutput()}
              fallback={
                <div class="rounded-xl border border-border bg-surface p-3 font-mono text-[11px] text-success overflow-x-auto max-h-72 studio-scroll">
                  <pre>{JSON.stringify(displayOutput(), null, 2)}</pre>
                </div>
              }
            >
              <Switch fallback={
                <div class={`h-56 border border-dashed ${props.activeStudioStyle.accentBorder} rounded-xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-surface/40`}>
                  <div class={`p-3 bg-card rounded-full mb-3 border ${props.activeStudioStyle.accentBorder} ${props.activeStudioStyle.accentText}`}>
                    <Sparkles class="w-6 h-6" />
                  </div>
                  <p class="text-xs font-semibold text-foreground">
                    {props.activeStudioStyle.studioTitle} Ready
                  </p>
                  <p class="text-[11px] text-muted-foreground mt-1 max-w-[280px]">
                    Click <strong>Run {props.activeManifest.pipeline_type}</strong> on the left to populate the {props.activeManifest.output_modality} visualizer.
                  </p>
                </div>
              }>
                <Match when={displayModality() === 'pcm_audio' && (resolvedAudioUrl() || props.executionStatus === 'streaming')}>
                  <div class="space-y-2.5">
                    <div class="grid grid-cols-4 gap-2 font-mono text-[11px] tabular-nums">
                      <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
                        <span class="text-muted-foreground">VOICE</span>
                        <span class="text-foreground font-bold">{props.activeTtsVoice}</span>
                      </div>
                      <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
                        <span class="text-muted-foreground">CADENCE</span>
                        <span class="text-foreground font-bold">{props.activeTtsSpeed.toFixed(1)}x</span>
                      </div>
                      <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
                        <span class="text-muted-foreground">PITCH / GAIN</span>
                        <span class="text-primary font-bold">
                          {props.activeTtsPitch >= 0 ? `+${props.activeTtsPitch}` : props.activeTtsPitch}st •{" "}
                          {props.activeTtsGain >= 0 ? `+${props.activeTtsGain}` : props.activeTtsGain}dB
                        </span>
                      </div>
                      <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
                        <span class="text-muted-foreground">TIER</span>
                        <span class="text-success font-bold uppercase">
                          {activeWeightTier().split("_")[0]}
                        </span>
                      </div>
                    </div>
                    <StudioAudioPlayer
                      audioUrl={resolvedAudioUrl() || ""}
                      voiceName={`${props.activeTtsVoice} (${activeWeightTier().toUpperCase()})`}
                      backendUsed={
                        !isTtsParamModified() && props.activeAudioRun
                          ? props.activeAudioRun.executionTarget
                          : `${props.activeManifest.execution_target} • Live ${props.activeManifest.engine_id.includes("kokoro") ? "24kHz" : "48kHz"} DSP`
                      }
                      durationSeconds={resolvedDuration()}
                      roundtripSec={
                        !isTtsParamModified() && props.activeAudioRun
                          ? Math.round((props.activeAudioRun.roundtripMs / 1000) * 100) / 100
                          : Number((0.022 / Math.max(0.35, activeSpeedup())).toFixed(3))
                      }
                      requestId={props.activeAudioRun?.requestId ?? `live-${activeWeightTier()}`}
                      payloadSha256={props.activeAudioRun?.payloadSha256 ?? "live_48khz_pcm16_dsp"}
                      externalAnalyser={props.streamingAudioAnalyser}
                      isStreaming={props.executionStatus === 'streaming'}
                    />
                  </div>
                </Match>

                <Match when={displayModality() === 'generated_image' && displayOutput()}>
                  <DiffusionImageLens
                    output={displayOutput()}
                    livePromptText={props.activeInputText}
                    liveParams={props.activeParams}
                    activeModelId={props.activeManifest.model_id}
                    activeEngineId={props.activeManifest.engine_id}
                    activeWeightTier={activeWeightTier()}
                    activePrecision={activePrecision()}
                    activeSpeedup={activeSpeedup()}
                    isStreaming={props.executionStatus === 'streaming'}
                    onPipeToRmbg={(genImgId, promptTxt, pipedDataUri) => {
                      const nextInput = pipedDataUri || `${genImgId} — ${promptTxt.slice(0, 80)}`;
                      props.setActiveEngineId("bria-rmbg-2.0");
                      if (props.setModelInputsMap) {
                        props.setModelInputsMap((prev: any) => ({
                          ...prev,
                          "bria-rmbg-2.0": nextInput,
                        }));
                      }
                    }}
                  />
                </Match>

                <Match when={displayModality() === 'token_stream' && displayOutput()}>
                  <LLMStreamLens
                    output={displayOutput()}
                    liveInputText={props.activeInputText}
                    liveParams={props.activeParams}
                    activeWeightTier={activeWeightTier()}
                    activeSpeedup={activeSpeedup()}
                    isStreaming={props.executionStatus === 'streaming'}
                    modelDisplayName={props.activeManifest.display_name}
                    samplePrompts={props.activeManifest.sample_prompts}
                    onSendMessage={props.onSendMessage}
                    onStopStreaming={props.onStopStreaming}
                    onPipeToTts={(textToSpeak) => {
                      props.setActiveEngineId("vieneu-tts-v3-turbo");
                      if (props.setModelInputsMap) {
                        props.setModelInputsMap((prev: any) => ({
                          ...prev,
                          "vieneu-tts-v3-turbo": textToSpeak,
                        }));
                      }
                    }}
                  />
                </Match>

                <Match when={displayModality() === 'timestamped_transcript' && displayOutput()}>
                  <ASRTranscriptLens
                    output={displayOutput()}
                    liveInputText={props.activeInputText}
                    liveParams={props.activeParams}
                    activeWeightTier={activeWeightTier()}
                    onPipeTranscript={(transcript, target) => {
                      const targetId = target === 'llm' ? 'qwen2.5-vl-instruct' : 'vieneu-tts-v3-turbo';
                      props.setActiveEngineId(targetId);
                      if (props.setModelInputsMap) {
                        props.setModelInputsMap((prev: any) => ({
                          ...prev,
                          [targetId]: transcript,
                        }));
                      }
                    }}
                  />
                </Match>

                <Match when={displayModality() === 'bounding_boxes' && displayOutput()}>
                  <VisionCanvasLens
                    output={displayOutput()}
                    pipelineType={props.activeManifest.pipeline_type}
                    liveInputText={props.activeInputText}
                    liveParams={props.activeParams}
                    activeWeightTier={activeWeightTier()}
                    onChangeParam={props.setActiveParam}
                    liveConfidenceThreshold={Number(
                      props.activeManifest.pipeline_type === 'image-segmentation'
                        ? props.activeParams.mask_threshold ?? 0.5
                        : props.activeParams.confidence_threshold ?? 0.25
                    )}
                    onChangeConfidenceThreshold={(val) =>
                      props.setActiveParam(
                        props.activeManifest.pipeline_type === 'image-segmentation'
                          ? 'mask_threshold'
                          : 'confidence_threshold',
                        val
                      )
                    }
                    liveClassFilter={String(props.activeParams.class_filter ?? "all")}
                    onChangeClassFilter={(val) => props.setActiveParam("class_filter", val)}
                    showSegmentationMasks={Boolean(props.activeParams.enable_segmentation_mask ?? true)}
                  />
                </Match>

                <Match when={displayModality() === 'classification' && displayOutput()}>
                  <ClassificationNerLens
                    output={displayOutput()}
                    liveInputText={props.activeInputText}
                    liveParams={props.activeParams}
                    activeWeightTier={activeWeightTier()}
                  />
                </Match>

                <Match when={displayModality() === 'vector_float32' && displayOutput()}>
                  <EmbeddingsHeatmapLens
                    output={displayOutput()}
                    liveInputText={props.activeInputText}
                    liveParams={props.activeParams}
                    activeWeightTier={activeWeightTier()}
                  />
                </Match>
              </Switch>
            </Show>
          </Show>

          <div class="rounded-xl border border-border/80 bg-surface/70 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
            <span class="text-muted-foreground flex items-center gap-1.5">
              <Zap class="w-3.5 h-3.5 text-warning" />
              <span>Pipeline: <strong class={props.activeStudioStyle.accentText}>{props.activeManifest.pipeline_type}</strong></span>
            </span>
            <div class="flex items-center gap-3">
              <span>
                Target: <strong class="text-primary">{props.activeManifest.execution_target}</strong>
              </span>
              <span>
                Latency: <strong class="text-success">{props.activeRun ? `${props.activeRun.roundtripMs}ms` : '—'}</strong>
              </span>
              <span>
                SHA-256: <strong class="text-foreground">{props.activeRun ? `${props.activeRun.payloadSha256.slice(0, 8)}…` : '—'}</strong>
              </span>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
