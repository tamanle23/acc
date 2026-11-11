import { Component, createMemo, For, Show } from "solid-js";
import {
  Terminal,
  Boxes,
  Code2,
  RefreshCw,
  Play,
  AlertCircle,
  Zap,
} from "lucide-solid";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export interface UvOrchestratorCellProps {
  spanClass?: string;
  envId: string;
  setEnvId: (val: string) => void;
  packages: string;
  setPackages: (val: string) => void;
  enableGpu: boolean;
  setEnableGpu: (val: boolean) => void;
  envLoading: boolean;
  handleProvisionEnv: () => Promise<void>;
  uvEnvs: Array<{
    env_id: string;
    python_executable: string;
    enable_gpu?: boolean;
    cuda_available?: boolean;
    device_name?: string | null;
    torch_version?: string | null;
    created_at?: number;
  }>;
  selectedInspectEnvId: string | null;
  setSelectedInspectEnvId: (val: string | null) => void;
  handleInspectEnvironment: (targetEnvId: string) => Promise<void>;
  inspectedPackages: Array<{ name: string; version: string }>;
  inspectLoading: boolean;
  pkgSearchQuery: string;
  setPkgSearchQuery: (val: string) => void;
  envError: string | null;
  workerCode: string;
  setWorkerCode: (val: string) => void;
  workerRunning: boolean;
  handleRunIsolatedTask: () => Promise<void>;
  workerOutput: Record<string, unknown> | null;
}

export const UvOrchestratorCell: Component<UvOrchestratorCellProps> = (props) => {
  const filteredPackages = createMemo(() =>
    props.inspectedPackages.filter((pkg) =>
      pkg.name.toLowerCase().includes(props.pkgSearchQuery.trim().toLowerCase())
    )
  );

  return (
    <Card class={`${props.spanClass || ""} flex flex-col justify-between`}>
      <div>
        <CardHeader class="flex flex-row items-center justify-between space-y-0">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-primary/15 border border-primary/30 text-primary">
              <Terminal class="w-4 h-4" />
            </div>
            <div>
              <CardTitle>In-App `uv` Virtual Environment Sandbox Orchestrator</CardTitle>
              <CardDescription>
                Provision isolated `~/.acc/.uv_isolated_envs/&lt;env_id&gt;` workers (`diffusers`, `kornia`, `torchvision`, `onnxruntime`) and execute sandboxed Python tasks
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" class="font-mono">
            {props.uvEnvs.length} Sandboxes
          </Badge>
        </CardHeader>

        <CardContent class="space-y-4">
          <Show when={props.envError}>
            <Alert variant="destructive">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span>{props.envError}</span>
            </Alert>
          </Show>

          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div class="sm:col-span-3">
              <label class="block text-[11px] font-medium text-muted-foreground mb-1">
                Environment Profile ID
              </label>
              <Input
                value={props.envId}
                onInput={(e) => props.setEnvId(e.currentTarget.value)}
                class="font-mono h-9 text-xs"
                placeholder="vision-worker"
              />
            </div>
            <div class="sm:col-span-4">
              <label class="block text-[11px] font-medium text-muted-foreground mb-1">
                Isolated Packages (Comma-separated)
              </label>
              <Input
                value={props.packages}
                onInput={(e) => props.setPackages(e.currentTarget.value)}
                class="font-mono h-9 text-xs"
                placeholder="diffusers, torch, torchvision, pillow, kornia, transformers"
              />
            </div>
            <div class="sm:col-span-2 flex items-end">
              <button
                type="button"
                onClick={() => props.setEnableGpu(!props.enableGpu)}
                class={`w-full h-9 px-2.5 rounded-md border text-[11px] font-mono font-semibold flex items-center justify-center gap-1.5 transition ${
                  props.enableGpu
                    ? "border-success/50 bg-success/15 text-success"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
                title="When enabled, installs PyTorch CUDA 12.4 wheels and verifies RTX 4070 Ti tensor math"
              >
                <Zap class={`w-3.5 h-3.5 ${props.enableGpu ? "text-success" : "text-muted-foreground"}`} />
                <span>{props.enableGpu ? "GPU (CUDA 12.4)" : "CPU Only"}</span>
              </button>
            </div>
            <div class="sm:col-span-3 flex items-end">
              <Button
                onClick={props.handleProvisionEnv}
                disabled={props.envLoading || !props.envId.trim()}
                class="w-full h-9 text-xs"
              >
                <Show
                  when={props.envLoading}
                  fallback={<Zap class="w-3.5 h-3.5" />}
                >
                  <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                </Show>
                <span>{props.envLoading ? "Provisioning..." : "Provision uv"}</span>
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
            <div class="rounded-xl border border-border bg-surface/60 p-3 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Boxes class="w-3.5 h-3.5 text-primary" />
                  <span>Provisioned Sandboxes ({props.uvEnvs.length})</span>
                </span>
                <Show when={props.selectedInspectEnvId}>
                  <Badge variant="success" class="font-mono text-[10px]">
                    {props.selectedInspectEnvId} ({props.inspectedPackages.length} pkgs)
                  </Badge>
                </Show>
              </div>

              <Show when={props.uvEnvs.length > 0}>
                <div class="flex flex-wrap gap-1.5">
                  <For each={props.uvEnvs}>
                    {(env) => (
                      <button
                        type="button"
                        onClick={() => void props.handleInspectEnvironment(env.env_id)}
                        class={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition flex items-center gap-1.5 ${
                          props.selectedInspectEnvId === env.env_id
                            ? "border-primary bg-primary/15 text-primary font-semibold"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span>{env.env_id}</span>
                        <span
                          class={`text-[9px] px-1 py-0.2 rounded ${
                            env.cuda_available || env.enable_gpu
                              ? "bg-success/20 text-success border border-success/40"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {env.cuda_available || env.enable_gpu ? "CUDA" : "CPU"}
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              <Input
                value={props.pkgSearchQuery}
                onInput={(e) => props.setPkgSearchQuery(e.currentTarget.value)}
                placeholder="Filter installed packages..."
                class="h-7 text-xs font-mono"
              />

              <div class="max-h-32 overflow-y-auto studio-scroll divide-y divide-border/50 text-[11px] font-mono">
                <Show
                  when={!props.inspectLoading}
                  fallback={<Skeleton class="h-16 w-full" />}
                >
                  <Show
                    when={filteredPackages().length > 0}
                    fallback={
                      <p class="text-muted-foreground py-3 text-center">
                        Click "Provision uv" to create and inspect an isolated worker environment.
                      </p>
                    }
                  >
                    <For each={filteredPackages()}>
                      {(pkg) => (
                        <div class="py-1 px-1.5 flex justify-between">
                          <span class="text-foreground">{pkg.name}</span>
                          <span class="text-primary">=={pkg.version}</span>
                        </div>
                      )}
                    </For>
                  </Show>
                </Show>
              </div>
            </div>

            <div class="rounded-xl border border-border bg-surface/60 p-3 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Code2 class="w-3.5 h-3.5 text-success" />
                  <span>Isolated Subprocess Runner</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={props.handleRunIsolatedTask}
                  disabled={props.workerRunning}
                  class="h-7 px-2.5 text-[11px]"
                >
                  <Show
                    when={props.workerRunning}
                    fallback={<Play class="w-3.5 h-3.5 fill-current text-success" />}
                  >
                    <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                  </Show>
                  <span>Run in `{props.selectedInspectEnvId || props.envId}`</span>
                </Button>
              </div>

              <Textarea
                value={props.workerCode}
                onInput={(e) => props.setWorkerCode(e.currentTarget.value)}
                rows={4}
                class="font-mono text-[11px] leading-relaxed"
              />

              <Show when={props.workerOutput}>
                <pre class="p-2 rounded-lg bg-card border border-border font-mono text-[10px] text-success overflow-x-auto max-h-24 studio-scroll">
                  {JSON.stringify(props.workerOutput, null, 2)}
                </pre>
              </Show>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};
