import { createMemo, Show, For } from "solid-js";
import { SlidersHorizontal, RefreshCw, Info } from "lucide-solid";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type {
  ModelCatalogEntry,
  ParameterSchemaField,
  VoicePreset,
} from "@acc/ai-control-plane-sdk";
import { VOICE_SPEAKER_CARDS } from "./pipeline-styles";
import { Mic } from "lucide-solid";

export interface DynamicParameterDeckProps {
  manifest?: ModelCatalogEntry | null;
  params: Record<string, any>;
  onChangeParam: (key: string, val: any) => void;
  onResetDefaults?: () => void;
  voices?: VoicePreset[];
  isLoading?: boolean;
  onOpenVoiceCloning?: () => void;
}

export function DynamicParameterDeck(props: DynamicParameterDeckProps) {
  // Pure single-source-of-truth schema derived directly from backend manifest
  const schema = createMemo<ParameterSchemaField[]>(() => {
    return props.manifest?.parameters_schema ?? [];
  });

  const getParamValue = (field: ParameterSchemaField) => {
    if (props.params[field.key] !== undefined) {
      return props.params[field.key];
    }
    return field.default;
  };

  return (
    <Show
      when={!props.isLoading && props.manifest}
      fallback={
        /* Coordinated Studio Skeleton State */
        <div class="space-y-3 p-3.5 rounded-xl border border-border/70 bg-surface/75 animate-pulse">
          <div class="flex items-center justify-between">
            <div class="h-4 w-44 bg-muted/60 rounded"></div>
            <div class="h-4 w-20 bg-muted/40 rounded"></div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <div class="p-3 rounded-lg bg-card/50 border border-border/50 h-24 flex flex-col justify-between">
              <div class="h-3 w-24 bg-muted/60 rounded"></div>
              <div class="h-2 w-full bg-muted/40 rounded"></div>
            </div>
            <div class="p-3 rounded-lg bg-card/50 border border-border/50 h-24 flex flex-col justify-between">
              <div class="h-3 w-28 bg-muted/60 rounded"></div>
              <div class="h-7 w-full bg-muted/40 rounded"></div>
            </div>
            <div class="p-3 rounded-lg bg-card/50 border border-border/50 h-24 flex flex-col justify-between">
              <div class="h-3 w-20 bg-muted/60 rounded"></div>
              <div class="h-2 w-full bg-muted/40 rounded"></div>
            </div>
          </div>
        </div>
      }
    >
      <Show
        when={schema().length > 0}
        fallback={
          /* Clean Empty State when model exposes no configurable parameters */
          <div class="space-y-3 p-3.5 rounded-xl border border-border bg-surface/75">
            <div class="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <SlidersHorizontal class="w-4 h-4 text-muted-foreground" />
              <span>Dynamic Parameter Deck</span>
            </div>
            <div class="p-4 rounded-xl border border-dashed border-border/70 bg-card/40 flex items-center gap-3 text-muted-foreground text-xs">
              <Info class="w-4 h-4 text-primary shrink-0" />
              <span>No configurable inference parameters declared for this model by the backend control plane.</span>
            </div>
          </div>
        }
      >
        <div class="space-y-3 p-3.5 rounded-xl border border-border bg-surface/75">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal class="w-4 h-4 text-primary" />
                <span>Dynamic Parameter Deck ({schema().length} parameters)</span>
              </span>
              <Show when={props.manifest?.runtime_backend && props.manifest.runtime_backend !== 'torch'}>
                <Badge variant="outline" class="text-[9px] font-mono border-purple-500/40 text-purple-400 bg-purple-500/10">
                  {props.manifest?.runtime_backend === 'onnxruntime'
                    ? 'ORT DirectML'
                    : props.manifest?.runtime_backend === 'llama_cpp'
                    ? 'GGUF llama.cpp'
                    : 'vLLM PagedAttn'}
                </Badge>
              </Show>
            </div>

            <Show when={props.onResetDefaults}>
              <button
                type="button"
                onClick={() => props.onResetDefaults?.()}
                class="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-card hover:bg-surface text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
              >
                <RefreshCw class="w-2.5 h-2.5" />
                <span>Reset Defaults</span>
              </button>
            </Show>
          </div>

          <Show when={props.manifest?.runtime_backend === 'paged_attention'}>
            <div class="p-2 rounded-lg bg-purple-500/5 border border-purple-500/20 text-[10px] font-mono text-purple-300 flex items-center justify-between">
              <span>⚡ PagedAttention Virtual KV-Cache Active</span>
              <span class="text-muted-foreground">Block size: 16 • 0% external fragmentation • Radix prefix cache</span>
            </div>
          </Show>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <For each={schema()}>
              {(field) => {
                const currentVal = () => getParamValue(field);

                return (
                  <div class="p-2.5 rounded-lg bg-card/70 border border-border/70 flex flex-col justify-between space-y-2">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-[11px] font-medium text-foreground truncate" title={field.description || field.label}>
                        {field.label}
                      </span>
                      <Show when={field.type === "slider"}>
                        <Badge variant="outline" class="text-[10px] font-mono py-0 px-1.5 bg-background">
                          {typeof currentVal() === "number"
                            ? Number(currentVal()).toFixed(field.step && field.step < 1 ? 2 : 0)
                            : String(currentVal())}{" "}
                          {field.unit ?? ""}
                        </Badge>
                      </Show>
                    </div>

                    <Show when={field.type === "slider"}>
                      <input
                        type="range"
                        min={field.min ?? 0}
                        max={field.max ?? 100}
                        step={field.step ?? 1}
                        value={Number(currentVal())}
                        aria-label={field.label}
                        onInput={(e) => {
                          const num = parseFloat(e.currentTarget.value);
                          props.onChangeParam(field.key, isNaN(num) ? e.currentTarget.value : num);
                        }}
                        class="studio-slider w-full"
                      />
                    </Show>

                    <Show when={field.type === "select"}>
                      <div class="flex items-center gap-1.5">
                        <select
                          value={String(currentVal() ?? field.default)}
                          onChange={(e) => props.onChangeParam(field.key, e.currentTarget.value)}
                          aria-label={field.label}
                          class="h-7 flex-1 min-w-0 rounded border border-border bg-background px-2 text-[11px] font-mono text-foreground"
                        >
                          <For each={
                            field.key === "voice" && props.voices && props.voices.length > 0
                              ? props.voices.map((v) => ({ label: v.label, value: v.voice_id }))
                              : (field.options || [])
                          }>
                            {(opt) => (
                              <option value={opt.value}>
                                {opt.label}
                                {VOICE_SPEAKER_CARDS[opt.value] ? ` • ${VOICE_SPEAKER_CARDS[opt.value].freq}` : ""}
                              </option>
                            )}
                          </For>
                        </select>
                        <Show when={field.key === "voice" && props.onOpenVoiceCloning}>
                          <button
                            type="button"
                            onClick={props.onOpenVoiceCloning}
                            class="h-7 px-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-mono font-semibold flex items-center gap-1 shrink-0 transition"
                            title="Open Studio Voice Cloning & Mic Capture Suite"
                          >
                            <Mic class="w-3 h-3 text-primary" />
                            <span>+ Clone</span>
                          </button>
                        </Show>
                      </div>
                    </Show>

                    <Show when={field.type === "toggle"}>
                      <div class="flex items-center justify-between pt-1">
                        <span class="text-[10px] font-mono text-muted-foreground">Enabled</span>
                        <button
                          type="button"
                          onClick={() => props.onChangeParam(field.key, !currentVal())}
                          class={`px-2.5 py-0.5 rounded text-[10px] font-mono border transition ${
                            currentVal()
                              ? "bg-primary text-primary-foreground border-primary font-bold"
                              : "bg-surface text-muted-foreground border-border"
                          }`}
                        >
                          {currentVal() ? "ON" : "OFF"}
                        </button>
                      </div>
                    </Show>

                    <Show when={field.type === "text"}>
                      <Input
                        value={String(currentVal() ?? "")}
                        onInput={(e) => props.onChangeParam(field.key, e.currentTarget.value)}
                        placeholder={field.label}
                        class="h-7 text-xs font-mono"
                      />
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>
    </Show>
  );
}
