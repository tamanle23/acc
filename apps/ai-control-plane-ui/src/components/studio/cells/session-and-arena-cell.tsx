import { createMemo, Show, For, Switch, Match } from 'solid-js';
import type {
  ModelCatalogEntry,
  DagPresetBlueprint,
  DagNodeSpec,
  DagExecutionResponse,
  DagStageExecutionResult,
  ServerArenaComparisonResponse,
  ArenaComparisonResult,
} from '@ai-monorepo/ai-control-plane-sdk';
import {
  Workflow,
  GitCompare,
  History,
  Layers,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Play,
  Radio,
  Trash2,
  Download,
  Eye,
  BarChart3,
  Volume2,
  X,
  Check,
} from 'lucide-solid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPipelineStudioStyle } from '@/components/studio/bespoke-pipeline-studios';
import { DagPipelineCanvas } from '@/components/studio/surfaces/dag-pipeline-canvas';
import { DagStageInspector } from '@/components/studio/surfaces/dag-stage-inspector';
import type { Cell4Mode, UnifiedSessionRunRecord } from '@/types/studio';

export interface SessionAndArenaCellProps {
  spanClass: string;
  cell4Mode: Cell4Mode;
  setCell4Mode: (mode: Cell4Mode) => void;
  dagPresets: DagPresetBlueprint[];
  selectedDagPresetId: string;
  handleSelectDagPreset: (presetId: string) => void;
  dagInitialInput: string;
  setDagInitialInput: (val: string) => void;
  dagNodes: DagNodeSpec[];
  dagEnableCache: boolean;
  setDagEnableCache: (val: boolean) => void;
  dagAddEngineId: string;
  setDagAddEngineId: (val: string) => void;
  catalogModels: ModelCatalogEntry[];
  handleAddNodeToDag: () => void;
  handleRemoveDagNode: (index: number) => void;
  handleMoveDagNode: (index: number, direction: -1 | 1) => void;
  handleUpdateDagNodeParam?: (index: number, paramKey: string, val: any) => void;
  dagRunning: boolean;
  handleExecuteVisualDag: () => Promise<void>;
  handleStreamVisualDag: () => Promise<void>;
  dagResult: DagExecutionResponse | null;
  activeStreamingDagNodeId: string | null;
  liveDagStages: DagStageExecutionResult[];
  selectedDagStageIndex: number | null;
  setSelectedDagStageIndex: (val: number | null) => void;
  arenaLeftId: string;
  setArenaLeftId: (id: string) => void;
  arenaRightId: string;
  setArenaRightId: (id: string) => void;
  arenaRunning: boolean;
  handleRunArenaComparison: () => Promise<void>;
  serverArenaResult: ServerArenaComparisonResponse | null;
  arenaResult: ArenaComparisonResult | null;
  arenaVoteWinnerId: string | null;
  handleVoteArenaWinner: (preferredEngineId: string) => Promise<void>;
  runs: UnifiedSessionRunRecord[];
  activeRunId: string | null;
  setActiveRunId: (id: string) => void;
  clearRuns: () => Promise<void>;
  setActiveEngineId: (engineId: string) => void;
  setModelInputsMap?: any;
  setModelParamsMap?: any;
  setLiveStreamOutput: (val: any) => void;
}

export function SessionAndArenaCell(props: SessionAndArenaCellProps) {
  const activeRun = createMemo(() => (props.runs || []).find((r) => r.id === props.activeRunId) ?? (props.runs || [])[0] ?? null);
  const displayedStages = createMemo(() => (props.liveDagStages && props.liveDagStages.length > 0) ? props.liveDagStages : (props.dagResult?.stages ?? []));
  const inspectedStage = createMemo(() => {
    const stages = displayedStages();
    if (props.selectedDagStageIndex !== null && props.selectedDagStageIndex !== undefined) {
      return stages[props.selectedDagStageIndex] ?? stages[stages.length - 1];
    }
    return stages[stages.length - 1];
  });

  return (
    <Card class={`${props.spanClass} flex flex-col justify-between`}>
      <div>
        <CardHeader class="flex flex-wrap items-center justify-between gap-2 space-y-0">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-primary/15 border border-primary/30 text-primary">
              <Workflow class="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Live Streaming Multi-Modal DAG Composer & A/B Arena</CardTitle>
              <CardDescription>
                Node-by-node NDJSON DAG streaming (`FLUX.1` → `RMBG-2.0` → `Qwen2.5-VL` → `VieNeu-TTS 48kHz`) & Server-Side A/B Scorecard
              </CardDescription>
            </div>
          </div>

          <div class="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            <button
              type="button"
              onClick={() => props.setCell4Mode('dag')}
              class={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                props.cell4Mode === 'dag'
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Workflow class="w-3.5 h-3.5" />
              <span>Visual DAG ({props.dagNodes.length} Nodes)</span>
            </button>
            <button
              type="button"
              onClick={() => props.setCell4Mode('arena')}
              class={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                props.cell4Mode === 'arena'
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitCompare class="w-3.5 h-3.5" />
              <span>A/B Benchmark</span>
            </button>
            <button
              type="button"
              onClick={() => props.setCell4Mode('ledger')}
              class={`px-2.5 py-1 rounded text-xs font-medium transition ${
                props.cell4Mode === 'ledger'
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Run Ledger ({props.runs.length})
            </button>
          </div>
        </CardHeader>

        <CardContent class="space-y-4">
          <Switch>
            <Match when={props.cell4Mode === 'dag'}>
              <div class="space-y-4">
                <DagPipelineCanvas
                  dagPresets={props.dagPresets}
                  selectedDagPresetId={props.selectedDagPresetId}
                  onSelectPreset={props.handleSelectDagPreset}
                  dagInitialInput={props.dagInitialInput}
                  onSetInitialInput={props.setDagInitialInput}
                  dagNodes={props.dagNodes}
                  dagEnableCache={props.dagEnableCache}
                  onSetEnableCache={props.setDagEnableCache}
                  dagAddEngineId={props.dagAddEngineId}
                  onSetAddEngineId={props.setDagAddEngineId}
                  catalogModels={props.catalogModels}
                  onAddNode={props.handleAddNodeToDag}
                  onRemoveNode={props.handleRemoveDagNode}
                  onMoveNode={props.handleMoveDagNode}
                  onUpdateNodeParam={props.handleUpdateDagNodeParam}
                  dagRunning={props.dagRunning}
                  activeStreamingDagNodeId={props.activeStreamingDagNodeId}
                  executedStages={displayedStages()}
                  onExecuteDag={props.handleExecuteVisualDag}
                  onStreamDag={props.handleStreamVisualDag}
                />

                <Show when={displayedStages().length > 0}>
                  <DagStageInspector
                    stage={inspectedStage()}
                    allStages={displayedStages()}
                    selectedIndex={props.selectedDagStageIndex}
                    onSelectIndex={(idx) => props.setSelectedDagStageIndex(idx)}
                    onOpenInLens={(st) => {
                      props.setActiveEngineId(st.engine_id);
                      props.setLiveStreamOutput(st.output);
                    }}
                  />
                </Show>
              </div>
            </Match>

            <Match when={props.cell4Mode === 'arena'}>
              <div class="space-y-3.5">
                <div class="p-3 rounded-xl border border-border bg-surface/70 flex flex-wrap items-center justify-between gap-2">
                  <div class="flex flex-wrap items-center gap-2 flex-1">
                    <select
                      value={props.arenaLeftId}
                      onChange={(e) => props.setArenaLeftId(e.currentTarget.value)}
                      aria-label="Arena Contender A"
                      class="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-mono text-foreground flex-1 min-w-[160px]"
                    >
                      <For each={props.catalogModels}>
                        {(m) => (
                          <option value={m.engine_id}>
                            A: {m.display_name} ({m.pipeline_type})
                          </option>
                        )}
                      </For>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const prevLeft = props.arenaLeftId;
                        props.setArenaLeftId(props.arenaRightId);
                        props.setArenaRightId(prevLeft);
                      }}
                      class="px-2 py-1 rounded border border-border bg-card hover:border-primary/50 text-[10px] font-mono text-primary font-bold transition"
                      title="Swap Contender A and Contender B"
                    >
                      ⇄ VS
                    </button>
                    <select
                      value={props.arenaRightId}
                      onChange={(e) => props.setArenaRightId(e.currentTarget.value)}
                      aria-label="Arena Contender B"
                      class="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-mono text-foreground flex-1 min-w-[160px]"
                    >
                      <For each={props.catalogModels}>
                        {(m) => (
                          <option value={m.engine_id}>
                            B: {m.display_name} ({m.pipeline_type})
                          </option>
                        )}
                      </For>
                    </select>
                  </div>

                  <Button size="sm" onClick={props.handleRunArenaComparison} disabled={props.arenaRunning}>
                    <Show when={props.arenaRunning} fallback={<GitCompare class="w-3.5 h-3.5" />}>
                      <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                    </Show>
                    <span>{props.arenaRunning ? "Benchmarking..." : "Run A/B Benchmark"}</span>
                  </Button>
                </div>

                <Show
                  when={props.serverArenaResult}
                  fallback={
                    <Show
                      when={props.arenaResult}
                      fallback={
                        <div class="h-40 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center p-4 text-muted-foreground bg-surface/40 text-xs">
                          Select two engines (e.g., FLUX.1-schnell vs BRIA RMBG-2.0, or VieNeu-TTS vs Kokoro-82M) and click <strong>Run A/B Benchmark</strong>.
                        </div>
                      }
                    >
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <For
                          each={[
                            { side: "Contender A", data: props.arenaResult!.left },
                            { side: "Contender B", data: props.arenaResult!.right },
                          ]}
                        >
                          {({ side, data }) => (
                            <div class="p-3.5 rounded-xl border border-border bg-surface/65 space-y-2">
                              <div class="flex items-center justify-between border-b border-border/60 pb-2">
                                <div>
                                  <span class="text-[10px] font-mono uppercase text-primary font-bold">
                                    {side}
                                  </span>
                                  <h4 class="text-xs font-semibold text-foreground">{data.engineId}</h4>
                                </div>
                                <Badge variant="success" class="font-mono text-[10px]">
                                  {data.roundtripMs} ms
                                </Badge>
                              </div>

                              <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px] text-muted-foreground">
                                <span>Target: <strong class="text-foreground">{data.executionTarget}</strong></span>
                                <span>SHA-256: <strong class="text-foreground">{data.payloadSha256.slice(0, 10)}</strong></span>
                              </div>

                              <Show
                                when={data.audioUrl}
                                fallback={
                                  <pre class="p-2 rounded bg-card border border-border font-mono text-[10px] text-foreground overflow-x-auto max-h-32 studio-scroll">
                                    {JSON.stringify(data.output, null, 2)}
                                  </pre>
                                }
                              >
                                <audio controls src={data.audioUrl} class="w-full h-8 mt-1" />
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  }
                >
                  <div class="space-y-3">
                    <div class="p-3 rounded-xl border border-primary/40 bg-primary/10 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                      <div class="flex flex-wrap items-center gap-2">
                        <Badge variant="success" class="text-[10px]">
                          Latency Winner: {props.serverArenaResult!.scorecard.latency_winner === "left" ? props.serverArenaResult!.left.display_name : props.serverArenaResult!.right.display_name} (+{props.serverArenaResult!.scorecard.speedup_pct}% faster)
                        </Badge>
                        <Badge variant="outline" class="text-[10px]">
                          VRAM Delta: {props.serverArenaResult!.scorecard.vram_delta_mb} MB
                        </Badge>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-muted-foreground">
                          Wall-Clock: <strong class="text-foreground">{props.serverArenaResult!.wall_clock_ms} ms</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(JSON.stringify(props.serverArenaResult!.scorecard, null, 2));
                          }}
                          class="px-2 py-0.5 rounded border border-border bg-card text-muted-foreground hover:text-foreground transition text-[10px] font-mono"
                          title="Copy A/B Arena Benchmark Scorecard as JSON"
                        >
                          Copy Scorecard
                        </button>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <For
                        each={[
                          { side: "Contender A", data: props.serverArenaResult!.left },
                          { side: "Contender B", data: props.serverArenaResult!.right },
                        ]}
                      >
                        {({ side, data }) => {
                          const isVoted = () => props.arenaVoteWinnerId === data.engine_id;
                          return (
                            <div
                              class={`p-3.5 rounded-xl border space-y-2 transition ${
                                isVoted()
                                  ? "border-primary bg-primary/15 shadow-xs"
                                  : "border-border bg-surface/65"
                              }`}
                            >
                              <div class="flex items-center justify-between border-b border-border/60 pb-2">
                                <div>
                                  <span class="text-[10px] font-mono uppercase text-primary font-bold">
                                    {side} • {data.pipeline_type}
                                  </span>
                                  <h4 class="text-xs font-semibold text-foreground">{data.display_name}</h4>
                                </div>
                                <Badge variant="success" class="font-mono text-[10px]">
                                  {data.latency_ms} ms
                                </Badge>
                              </div>

                              <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px] text-muted-foreground">
                                <span>VRAM: <strong class="text-foreground">{data.vram_mb} MB ({data.precision})</strong></span>
                                <span>SHA-256: <strong class="text-foreground">{data.payload_sha256.slice(0, 8)}</strong></span>
                              </div>

                              <p class="text-xs text-foreground/90 font-medium">{data.summary}</p>

                              <Show
                                when={data.audioUrl}
                                fallback={
                                  <pre class="p-2 rounded bg-card border border-border font-mono text-[10px] text-foreground overflow-x-auto max-h-24 studio-scroll">
                                    {JSON.stringify(data.output, null, 2)}
                                  </pre>
                                }
                              >
                                <audio controls src={data.audioUrl} class="w-full h-8 mt-1" />
                              </Show>

                              <div class="pt-1 flex justify-end">
                                <Button
                                  size="sm"
                                  variant={isVoted() ? "default" : "outline"}
                                  onClick={() => void props.handleVoteArenaWinner(data.engine_id)}
                                  class="h-7 px-2.5 text-[10px]"
                                >
                                  <Check class="w-3 h-3" />
                                  <span>{isVoted() ? "Voted Preferred Winner" : "Vote Preferred Model"}</span>
                                </Button>
                              </div>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </Match>

            <Match when={props.cell4Mode === 'ledger'}>
              <Show
                when={props.runs.length > 0}
                fallback={
                  <div class="h-52 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-surface/40">
                    <History class="w-6 h-6 text-muted-foreground mb-2 opacity-60" />
                    <p class="text-xs font-medium text-foreground">No Session Runs Yet</p>
                    <p class="text-[11px] text-muted-foreground mt-1 max-w-sm">
                      Every inference run, A/B Arena benchmark, and DAG execution is logged here and persisted to SQLite WAL storage.
                    </p>
                  </div>
                }
              >
                <div class="space-y-2">
                  <div class="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => void props.clearRuns()} class="h-7 px-2 text-xs">
                      <Trash2 class="w-3.5 h-3.5" /> Clear Ledger
                    </Button>
                  </div>
                  <div class="rounded-xl border border-border overflow-hidden bg-surface/50">
                    <div class="max-h-60 overflow-y-auto studio-scroll">
                      <table class="w-full text-left border-collapse text-xs">
                        <thead class="bg-card border-b border-border sticky top-0 font-mono text-[10px] uppercase text-muted-foreground">
                          <tr>
                            <th class="py-2.5 px-3">Run</th>
                            <th class="py-2.5 px-3">Engine & Pipeline</th>
                            <th class="py-2.5 px-3 hidden sm:table-cell">Input Snippet</th>
                            <th class="py-2.5 px-3">Target</th>
                            <th class="py-2.5 px-3 text-right">Latency</th>
                            <th class="py-2.5 px-3 text-right">Artifact</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-border/60">
                          <For each={props.runs}>
                            {(run, idx) => {
                              const isSelected = () => run.id === (activeRun()?.id ?? '');
                              const pStyle = () => getPipelineStudioStyle(run.pipelineType);
                              return (
                                <tr
                                  onClick={() => {
                                    props.setActiveRunId(run.id);
                                    props.setActiveEngineId(run.engineId);
                                  }}
                                  class={`cursor-pointer transition ${
                                    isSelected() ? 'bg-primary/10' : 'hover:bg-secondary/40'
                                  }`}
                                >
                                  <td class="py-2 px-3 font-mono text-[11px] tabular-nums">
                                    <span class="font-semibold text-primary">#{props.runs.length - idx()}</span>
                                    <span class="block text-[10px] text-muted-foreground">{run.timestamp}</span>
                                  </td>
                                  <td class="py-2 px-3">
                                    <span class="font-medium text-foreground block truncate max-w-[160px]">
                                      {run.displayName}
                                    </span>
                                    <span class={`font-mono text-[10px] ${pStyle().accentText}`}>
                                      {run.pipelineType}
                                    </span>
                                  </td>
                                  <td class="py-2 px-3 hidden sm:table-cell max-w-[200px] truncate text-muted-foreground">
                                    {run.inputSnippet}
                                  </td>
                                  <td class="py-2 px-3 font-mono text-[10px] text-foreground">
                                    {run.executionTarget}
                                  </td>
                                  <td class="py-2 px-3 text-right font-mono text-[11px] tabular-nums text-success font-semibold">
                                    {run.roundtripMs}ms
                                  </td>
                                  <td class="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                                    <Show
                                      when={run.audioUrl}
                                      fallback={
                                        <span class="font-mono text-[10px] text-muted-foreground">
                                          {run.payloadSha256.slice(0, 8)}
                                        </span>
                                      }
                                    >
                                      <a
                                        href={run.audioUrl}
                                        download={`vieneu_${run.id.slice(0, 6)}.wav`}
                                        class="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-card hover:border-primary/50 text-[10px] font-mono text-foreground transition"
                                      >
                                        <Download class="w-3 h-3 text-primary" />
                                        <span>WAV</span>
                                      </a>
                                    </Show>
                                  </td>
                                </tr>
                              );
                            }}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Show>
            </Match>
          </Switch>
        </CardContent>
      </div>
    </Card>
  );
}
