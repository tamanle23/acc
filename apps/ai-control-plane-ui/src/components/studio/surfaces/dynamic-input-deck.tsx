import { createSignal, createMemo, Show, For } from "solid-js";
import {
  FileText,
  Mic,
  MicOff,
  Image as ImageIcon,
  Upload,
  X,
  Sparkles,
  Plus,
  Volume2,
  Table,
  Layers,
  Wand2,
} from "lucide-solid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ModelCatalogEntry } from "@ai-monorepo/ai-control-plane-sdk";
import { getPipelineStudioStyle } from "./pipeline-styles";

export interface DynamicInputDeckProps {
  manifest: ModelCatalogEntry;
  inputText: string;
  onChangeInputText: (val: string) => void;
  params: Record<string, any>;
  onChangeParam: (key: string, val: any) => void;
  selectedBinaryName: string;
  onSelectBinaryFile: (file: File | Blob | null, name: string) => void;
  isRecordingMic: boolean;
  onToggleMicCapture: () => void;
  showZeroShot: boolean;
  onToggleZeroShot: () => void;
  refAudioPath: string;
  onChangeRefAudioPath: (val: string) => void;
}

export function DynamicInputDeck(props: DynamicInputDeckProps) {
  const [newChip, setNewChip] = createSignal("");
  const style = () => getPipelineStudioStyle(props.manifest.pipeline_type);

  const inputSlots = createMemo(() => props.manifest.input_slots || []);

  const promptSlot = createMemo(() => inputSlots().find((s) => s.role === "prompt"));
  const sourceMediaSlot = createMemo(() => inputSlots().find((s) => s.role === "source_media"));
  const refMediaSlot = createMemo(() => inputSlots().find((s) => s.role === "reference_media"));
  const targetLabelsSlot = createMemo(() => inputSlots().find((s) => s.role === "target_labels"));

  const isTextLike = () => Boolean(promptSlot()) || props.manifest.input_modality === "text" || props.manifest.input_modality === "multimodal";
  const isAudioLike = () => sourceMediaSlot()?.data_type === "audio" || props.manifest.input_modality === "audio";
  const isImageLike = () => sourceMediaSlot()?.data_type === "image" || props.manifest.input_modality === "image" || props.manifest.input_modality === "multimodal";
  const hasRefAudio = () => Boolean(refMediaSlot());
  const hasTargetLabels = () => Boolean(targetLabelsSlot()) || props.manifest.pipeline_type.includes("zero-shot");

  const wordCount = createMemo(() => {
    const text = props.inputText.trim();
    return text ? text.split(/\s+/).length : 0;
  });

  const candidateLabels = () => {
    const raw = props.params.candidate_labels;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") return raw.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  };

  const handleAddCandidate = () => {
    const chip = newChip().trim();
    if (!chip) return;
    const current = [...candidateLabels()];
    if (!current.includes(chip)) {
      current.push(chip);
      props.onChangeParam("candidate_labels", current);
    }
    setNewChip("");
  };

  const handleRemoveCandidate = (label: string) => {
    const filtered = candidateLabels().filter((l) => l !== label);
    props.onChangeParam("candidate_labels", filtered);
  };

  const handleFileInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      props.onSelectBinaryFile(file, file.name);
    }
  };

  return (
    <div class="space-y-3.5">
      {/* Deck Header */}
      <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border bg-surface text-[10px] font-mono">
        <div class="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" class="font-bold uppercase tracking-wider text-xs bg-card">
            MODALITY: {(props.manifest.input_modality || "text").toUpperCase()}
          </Badge>
          <span class="text-muted-foreground">•</span>
          <span class="text-muted-foreground">
            Pipeline: <strong class="text-foreground">{props.manifest.pipeline_type}</strong>
          </span>
          <Show when={props.selectedBinaryName}>
            <span class="text-muted-foreground">•</span>
            <span class="text-primary font-semibold truncate max-w-[200px]">
              Asset: {props.selectedBinaryName}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-2 text-muted-foreground">
          <span>{wordCount()} words</span>
          <span>•</span>
          <span>{props.inputText.length} chars</span>
        </div>
      </div>

      {/* Primary Text/Prompt Input (if applicable) */}
      <Show when={isTextLike()}>
        <div class="p-3.5 rounded-xl border border-border bg-surface space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-bold text-foreground flex items-center gap-1.5">
              <FileText class="w-4 h-4 text-primary" />
              <span>Input Text & Prompt Composer</span>
            </span>

            {/* Quick Sample Presets */}
            <Show when={props.manifest.sample_prompts && props.manifest.sample_prompts.length > 0}>
              <div class="flex flex-wrap items-center gap-1">
                <For each={props.manifest.sample_prompts}>
                  {(preset) => (
                    <button
                      type="button"
                      onClick={() => props.onChangeInputText(preset.text)}
                      class={`text-[10px] font-mono px-2 py-0.5 rounded border transition truncate max-w-[180px] ${
                        props.inputText.trim() === preset.text.trim()
                          ? "border-primary bg-primary/15 text-foreground font-semibold shadow-xs"
                          : "border-border bg-card/70 text-muted-foreground hover:text-foreground"
                      }`}
                      title={preset.text}
                    >
                      {preset.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <Textarea
            value={props.inputText}
            onInput={(e) => props.onChangeInputText(e.currentTarget.value)}
            rows={props.manifest.input_modality === "multimodal" || isImageLike() ? 2 : 4}
            placeholder={
              promptSlot()?.placeholder ||
              (props.manifest.pipeline_type === "text-to-image"
                ? "Describe your image scene, subject, lighting, framing, and mood..."
                : props.manifest.pipeline_type === "text-to-speech"
                ? "Enter Vietnamese or English text with optional [pause:0.5s] or prosody tags..."
                : `Enter inputs for ${props.manifest.display_name}...`)
            }
            class="font-sans text-sm leading-relaxed border-border bg-background"
          />

          {/* Candidate Labels / Target Classes (for zero-shot or classifier models) */}
          <Show when={hasTargetLabels()}>
            <div class="pt-2 border-t border-border/60 space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[11px] font-mono font-semibold text-muted-foreground">
                  Target Candidate Labels:
                </span>
                <div class="flex items-center gap-1.5">
                  <Input
                    value={newChip()}
                    onInput={(e) => setNewChip(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCandidate();
                      }
                    }}
                    placeholder="Add candidate label..."
                    class="h-6 text-[10px] font-mono w-40"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddCandidate}
                    class="h-6 px-2 text-[10px] font-mono"
                  >
                    <Plus class="w-3 h-3 mr-0.5" /> Add
                  </Button>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 min-h-[28px]">
                <For each={candidateLabels()}>
                  {(label) => (
                    <Badge variant="outline" class="text-xs font-mono gap-1 pl-2 pr-1 py-0.5 bg-card">
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCandidate(label)}
                        class="hover:text-destructive p-0.5"
                      >
                        <X class="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                </For>
                <Show when={candidateLabels().length === 0}>
                  <span class="text-[11px] font-mono text-muted-foreground/60 italic">
                    No candidate labels defined (add labels to classify against)
                  </span>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Audio Capture & Reference Deck (if applicable) */}
      <Show when={isAudioLike()}>
        <div class="p-3.5 rounded-xl border border-border bg-surface space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Volume2 class="w-4 h-4 text-primary" />
              <span>Audio Input & Acoustic Calibration</span>
            </span>

            <div class="flex items-center gap-2">
              <Button
                size="sm"
                variant={props.isRecordingMic ? "destructive" : "outline"}
                onClick={props.onToggleMicCapture}
                class="h-7 px-3 text-xs font-mono gap-1.5"
              >
                <Show when={props.isRecordingMic} fallback={<Mic class="w-3.5 h-3.5" />}>
                  <MicOff class="w-3.5 h-3.5 animate-pulse" />
                </Show>
                <span>{props.isRecordingMic ? "Stop Recording" : "Record Mic"}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={props.onToggleZeroShot}
                class="h-7 px-3 text-xs font-mono gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                title="Open Studio Voice Cloning & Mic Capture Suite"
              >
                <Sparkles class="w-3.5 h-3.5 text-primary" />
                <span>Clone Voice</span>
              </Button>
            </div>
          </div>

          {/* Reference Audio / Zero-Shot Speaker Conditioning */}
          <Show when={hasRefAudio() || props.showZeroShot}>
            <div class="p-2.5 rounded-lg border border-border/80 bg-card/60 space-y-2">
              <div class="flex items-center justify-between text-xs font-mono">
                <span class="text-muted-foreground">Zero-Shot Reference Audio Clip:</span>
                <button
                  type="button"
                  onClick={props.onToggleZeroShot}
                  class="text-[10px] text-primary hover:underline"
                >
                  {props.showZeroShot ? "Hide Advanced" : "Show Advanced"}
                </button>
              </div>
              <Show when={props.showZeroShot}>
                <Input
                  value={props.refAudioPath}
                  onInput={(e) => props.onChangeRefAudioPath(e.currentTarget.value)}
                  placeholder="Path or URI to 3-5s clean reference voice WAV/FLAC..."
                  class="h-7 text-xs font-mono"
                />
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      {/* Visual / Image Upload Dropzone (if applicable) */}
      <Show when={isImageLike()}>
        <div class="p-3.5 rounded-xl border border-border bg-surface space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-bold text-foreground flex items-center gap-1.5">
              <ImageIcon class="w-4 h-4 text-primary" />
              <span>Image Asset & Visual Modality Input</span>
            </span>

            <Show when={props.selectedBinaryName}>
              <div class="flex items-center gap-1.5 font-mono text-xs">
                <Badge variant="outline" class="gap-1 pl-2 pr-1 bg-card">
                  <span class="truncate max-w-[200px]">{props.selectedBinaryName}</span>
                  <button
                    type="button"
                    onClick={() => props.onSelectBinaryFile(null, "")}
                    class="hover:text-destructive p-0.5"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            </Show>
          </div>

          <label class="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/60 bg-card/40 hover:bg-card/70 transition">
            <Upload class="w-6 h-6 text-muted-foreground mb-1" />
            <span class="text-xs font-medium text-foreground">
              Drop image file here or click to browse
            </span>
            <span class="text-[10px] font-mono text-muted-foreground mt-0.5">
              Supports PNG, JPG, JPEG, WEBP • Max 25 MB
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              class="hidden"
            />
          </label>
        </div>
      </Show>
    </div>
  );
}
