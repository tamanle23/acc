import { For, Show, createSignal } from "solid-js";
import { Tabs } from "@ark-ui/solid";
import { Search, Terminal, Trash2 } from "lucide-solid";

interface ConsoleSectionProps {
  activeService: string;
  onSelectService: (service: string) => void;
  logs: readonly string[];
  filter: string;
  onFilterChange: (val: string) => void;
}

export function ConsoleSection(props: ConsoleSectionProps) {
  const [cleared, setCleared] = createSignal<boolean>(false);

  const services = [
    { id: "supervisor", label: "supervisor" },
    { id: "python-backend", label: "python-backend" },
    { id: "worker", label: "worker" },
    { id: "studio", label: "studio" },
  ];

  const filteredLogs = () => {
    if (cleared()) return [];
    return props.logs;
  };

  const lineClass = (line: string) => {
    const l = line.toLowerCase();
    if (l.includes("error") || l.includes("fatal") || l.includes("fail")) {
      return "text-rose-400 bg-rose-950/20";
    }
    if (l.includes("warn") || l.includes("warning")) {
      return "text-amber-300";
    }
    if (l.includes("ready") || l.includes("listening") || l.includes("started") || l.includes("healthy")) {
      return "text-emerald-400";
    }
    return "text-[var(--text-primary)]";
  };

  return (
    <div
      class="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden my-6 transition-all"
      style={{
        "box-shadow": "var(--card-shadow)",
        "backdrop-filter": "var(--surface-backdrop)",
        "-webkit-backdrop-filter": "var(--surface-backdrop)",
      }}
    >
      <Tabs.Root
        value={props.activeService}
        onValueChange={(details) => {
          setCleared(false);
          props.onSelectService(details.value);
        }}
      >
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 border-b border-[var(--border-subtle)] gap-3 bg-[var(--bg-canvas)]/40 transition-colors">
          <Tabs.List class="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <For each={services}>
              {(svc) => (
                <Tabs.Trigger
                  value={svc.id}
                  class={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    props.activeService === svc.id
                      ? "bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--border-focus)]/40 font-semibold"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]"
                  }`}
                >
                  {svc.label}
                </Tabs.Trigger>
              )}
            </For>
          </Tabs.List>

          <div class="flex items-center gap-2">
            <div class="relative flex-1 sm:w-64">
              <Search class="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={props.filter}
                onInput={(e) => props.onFilterChange(e.currentTarget.value)}
                class="w-full pl-8 pr-3 py-1 rounded-lg bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <button
              onClick={() => setCleared(true)}
              title="Clear current view"
              class="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)] transition-colors cursor-pointer"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div class="p-4 bg-[var(--bg-canvas)] font-mono text-xs text-[var(--text-primary)] h-72 overflow-y-auto leading-relaxed select-text transition-colors">
          <Show
            when={filteredLogs().length > 0}
            fallback={
              <div class="h-full flex flex-col items-center justify-center text-[var(--text-muted)] gap-2">
                <Terminal class="w-6 h-6 opacity-40" />
                <span>No logs recorded for {props.activeService}</span>
              </div>
            }
          >
            <For each={filteredLogs()}>
              {(line) => (
                <div class={`px-1 py-0.5 rounded break-all whitespace-pre-wrap ${lineClass(line)}`}>
                  {line}
                </div>
              )}
            </For>
          </Show>
        </div>
      </Tabs.Root>
    </div>
  );
}
