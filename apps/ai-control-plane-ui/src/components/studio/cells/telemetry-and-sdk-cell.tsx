import { Show, For, createMemo } from 'solid-js';
import type { SqliteTelemetryLedgerResponse } from '@acc/ai-control-plane-sdk';
import { Database, FileCode, Check, RefreshCw, Download } from 'lucide-solid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface TelemetryAndSdkCellProps {
  spanClass: string;
  sqliteLedger?: SqliteTelemetryLedgerResponse | null;
  sqlSummary?: any;
  runs: any[];
  circuitState: string;
  activeEngineId: string;
  onResetCircuitBreaker: (engineId: string) => Promise<unknown>;
  onRefreshTelemetry: () => Promise<void> | void;
  exportBusy: boolean;
  handleExportDataset: (format: 'jsonl' | 'csv') => Promise<void>;
  copySdkSnippet: () => void;
  copied: boolean;
  p50Ms: number;
  p95Ms: number;
  queueDepth: number;
  maxQueueSize: number;
}

export function TelemetryAndSdkCell(props: TelemetryAndSdkCellProps) {
  const totalPersistedRuns = createMemo(() => props.sqlSummary?.total_runs ?? props.runs?.length ?? 0);
  const totalDagRuns = createMemo(() => props.sqlSummary?.total_dag_runs ?? 0);
  const totalArenaRuns = createMemo(() => props.sqlSummary?.total_arena_runs ?? 0);
  const totalCostUsd = createMemo(() => props.sqlSummary?.total_estimated_cost_usd ?? 0.0);
  const cachedArtifactsCount = createMemo(() => props.sqlSummary?.cached_dag_artifacts ?? 0);
  const pipelineBreakdown = createMemo(() => (props.sqlSummary?.by_pipeline_type ?? []).slice(0, 4));

  return (
    <div class={`${props.spanClass} flex flex-col gap-4`}>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-primary/15 border border-primary/30 text-primary">
              <Database class="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Persistent SQLite WAL Telemetry & Dataset Exporter</CardTitle>
              <CardDescription>
                `sqlite3-wal` run ledger • p50/p95/p99 SLA percentiles • 1-Click JSONL/CSV Export
              </CardDescription>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <Badge variant={props.circuitState === 'CLOSED' ? 'success' : 'warning'}>
              Circuit: {props.circuitState}
            </Badge>
            <Show when={props.circuitState !== 'CLOSED'}>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await props.onResetCircuitBreaker(props.activeEngineId);
                    await props.onRefreshTelemetry();
                  } catch {
                    // ignore offline
                  }
                }}
                class="h-6 px-2 text-[10px]"
                title="Reset tripped engine circuit breaker to CLOSED"
              >
                <RefreshCw class="w-2.5 h-2.5" />
                <span>Reset</span>
              </Button>
            </Show>
          </div>
        </CardHeader>

        <CardContent class="space-y-3">
          <div class="grid grid-cols-3 gap-2 font-mono tabular-nums">
            <div class="p-2.5 rounded-xl bg-surface/80 border border-border">
              <span class="text-[10px] text-muted-foreground block">p50 / p95 SLA</span>
              <span class="text-xs font-bold text-primary">
                {props.p50Ms} / {props.p95Ms} ms
              </span>
            </div>
            <div class="p-2.5 rounded-xl bg-surface/80 border border-border">
              <span class="text-[10px] text-muted-foreground block">SQLITE WAL RUNS</span>
              <span class="text-xs font-bold text-success">
                {totalPersistedRuns()} ({totalDagRuns()} DAG / {totalArenaRuns()} A/B)
              </span>
            </div>
            <div class="p-2.5 rounded-xl bg-surface/80 border border-border">
              <span class="text-[10px] text-muted-foreground block">EST. COMPUTE COST</span>
              <span class="text-xs font-bold text-foreground">
                ${totalCostUsd().toFixed(5)}
              </span>
            </div>
          </div>

          <Show when={pipelineBreakdown().length > 0}>
            <div class="p-2.5 rounded-xl border border-border bg-surface/60 space-y-1.5">
              <div class="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>PERSISTED PIPELINE BREAKDOWN</span>
                <span>AVG LATENCY</span>
              </div>
              <For each={pipelineBreakdown()}>
                {(item: any) => (
                  <div class="flex items-center justify-between text-[11px] font-mono">
                    <span class="text-foreground">
                      {item.pipeline_type} <span class="text-muted-foreground">({item.runs_count}x)</span>
                    </span>
                    <span class="text-success font-semibold">{item.avg_latency_ms} ms</span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
            <span class="text-[10px] font-mono text-muted-foreground">
              Queue: {props.queueDepth}/{props.maxQueueSize} • Cached Nodes: {cachedArtifactsCount()}
            </span>
            <div class="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={props.exportBusy}
                onClick={() => void props.handleExportDataset("jsonl")}
                class="h-7 px-2 text-[10px]"
              >
                <Download class="w-3 h-3 text-primary" />
                <span>Export JSONL</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={props.exportBusy}
                onClick={() => void props.handleExportDataset("csv")}
                class="h-7 px-2 text-[10px]"
              >
                <Download class="w-3 h-3 text-success" />
                <span>Export CSV</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="flex-1 flex flex-col justify-between">
        <div>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="p-2 rounded-lg bg-primary/15 border border-primary/30 text-primary">
                <FileCode class="w-4 h-4" />
              </div>
              <div>
                <CardTitle>WinterTC (ECMA-429) Transport & Hardware SDK</CardTitle>
                <CardDescription>5-Tier Hardware Profiler + Live NDJSON DAG + A/B Arena</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={props.copySdkSnippet} class="h-8 text-xs">
              <Show when={props.copied} fallback={<FileCode class="w-3.5 h-3.5" />}>
                <Check class="w-3.5 h-3.5 text-success" />
              </Show>
              <span>{props.copied ? "Copied" : "Copy SDK"}</span>
            </Button>
          </CardHeader>

          <CardContent>
            <div class="rounded-xl border border-border bg-surface p-3 font-mono text-[10px] text-primary overflow-x-auto max-h-44 studio-scroll leading-relaxed">
              <pre>{`// Studio v32: Switch Hardware Power Tier & Auto-Adapt All Models
await client.selectHardwareProfile({
  profile_id: "tier_2_consumer_8gb",
  auto_adapt_models: true
});
await client.setModelWeightTier("flux-1-schnell", {
  tier_id: "nano_int4",
  offload_strategy: "cpu_ram_offload"
});`}</pre>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
