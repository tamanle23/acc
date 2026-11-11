import { createSignal, Show, type Component } from 'solid-js';
import {
  ShieldCheck,
  Volume2,
  Activity,
  Code2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Badge } from '@/components/ui/badge';
import { PipelineQaCard } from './pipeline-qa-card';
import { LiveBpmStrip } from './live-bpm-strip';
import { ChoreographyTelemetry } from './choreography-telemetry';
import { DeclarativeSchemaViewer } from './declarative-schema-viewer';

export interface TelemetrySidebarProps {
  width?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const TelemetrySidebar: Component<TelemetrySidebarProps> = (props) => {
  const studio = useStudio();

  // Accordion open states
  const [qaOpen, setQaOpen] = createSignal(true);
  const [audioOpen, setAudioOpen] = createSignal(true);
  const [choreoOpen, setChoreoOpen] = createSignal(false);
  const [schemaOpen, setSchemaOpen] = createSignal(true);

  return (
    <Show
      when={!props.collapsed}
      fallback={
        <aside class="w-11 min-w-11 max-w-11 shrink-0 flex-none border-l border-border bg-card text-card-foreground hidden lg:flex flex-col items-center py-2 gap-2 select-none z-10">
          <button
            type="button"
            onClick={props.onToggleCollapse}
            title="Expand Telemetry Sidebar (Hotkey: ])"
            class="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <div class="w-6 h-px bg-border my-1" />
          <button
            type="button"
            onClick={() => {
              setQaOpen(true);
              props.onToggleCollapse?.();
            }}
            title="Open QA Pipeline Audit"
            class="p-2 rounded-md hover:bg-accent text-emerald-500 cursor-pointer transition-colors"
          >
            <ShieldCheck class="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setAudioOpen(true);
              props.onToggleCollapse?.();
            }}
            title="Open Audio & BPM Strip"
            class="p-2 rounded-md hover:bg-accent text-primary cursor-pointer transition-colors"
          >
            <Volume2 class="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setChoreoOpen(true);
              props.onToggleCollapse?.();
            }}
            title="Open Choreography Envelope"
            class="p-2 rounded-md hover:bg-accent text-cyan-400 cursor-pointer transition-colors"
          >
            <Activity class="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSchemaOpen(true);
              props.onToggleCollapse?.();
            }}
            title="Open Declarative Schema JSON"
            class="p-2 rounded-md hover:bg-accent text-amber-400 cursor-pointer transition-colors"
          >
            <Code2 class="w-4 h-4" />
          </button>
        </aside>
      }
    >
      <aside
        style={{ width: `${props.width ?? 320}px` }}
        class="shrink-0 flex-none border-l border-border bg-card text-card-foreground hidden lg:flex flex-col overflow-hidden select-none transition-[width] duration-75"
      >
        {/* Top Header with Collapse Toggle */}
        <div class="h-10 px-3 border-b border-border bg-muted/60 flex items-center justify-between shrink-0">
          <span class="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity class="w-3.5 h-3.5 text-primary" />
            Studio Telemetry & QA
          </span>

          <Show when={props.onToggleCollapse}>
            <button
              type="button"
              onClick={props.onToggleCollapse}
              title="Collapse Telemetry Sidebar (Hotkey: ])"
              class="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronRight class="w-3.5 h-3.5" />
            </button>
          </Show>
        </div>

        {/* Scrollable Accordion Body */}
        <div class="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-border/60">
          {/* ACCORDION 1: QA Pipeline Audit */}
          <div class="flex flex-col">
            <button
              type="button"
              onClick={() => setQaOpen((prev) => !prev)}
              class="w-full px-3 py-2 flex items-center justify-between text-xs font-mono font-bold text-foreground bg-card hover:bg-accent/40 transition-colors cursor-pointer text-left"
            >
              <span class="flex items-center gap-1.5 text-muted-foreground">
                <ShieldCheck class="w-3.5 h-3.5 text-emerald-500" />
                QA Pipeline Audit
              </span>
              <div class="flex items-center gap-1.5">
                <Badge variant={studio.wcagContrast >= 4.5 ? 'lime' : 'amber'}>
                  {studio.wcagContrast}:1 AA
                </Badge>
                {qaOpen() ? (
                  <ChevronDown class="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight class="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </button>
            <Show when={qaOpen()}>
              <div class="p-3 bg-muted/10 border-t border-border/40">
                <PipelineQaCard />
              </div>
            </Show>
          </div>

          {/* ACCORDION 2: Audio & Master BPM Strip */}
          <div class="flex flex-col">
            <button
              type="button"
              onClick={() => setAudioOpen((prev) => !prev)}
              class="w-full px-3 py-2 flex items-center justify-between text-xs font-mono font-bold text-foreground bg-card hover:bg-accent/40 transition-colors cursor-pointer text-left"
            >
              <span class="flex items-center gap-1.5 text-muted-foreground">
                <Volume2 class="w-3.5 h-3.5 text-primary" />
                Audio & Master BPM Strip
              </span>
              <div class="flex items-center gap-1.5">
                <Badge variant="cyan">{studio.state.bpm} BPM</Badge>
                {audioOpen() ? (
                  <ChevronDown class="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight class="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </button>
            <Show when={audioOpen()}>
              <div class="p-3 bg-muted/10 border-t border-border/40">
                <LiveBpmStrip />
              </div>
            </Show>
          </div>

          {/* ACCORDION 3: Choreography Envelope */}
          <div class="flex flex-col">
            <button
              type="button"
              onClick={() => setChoreoOpen((prev) => !prev)}
              class="w-full px-3 py-2 flex items-center justify-between text-xs font-mono font-bold text-foreground bg-card hover:bg-accent/40 transition-colors cursor-pointer text-left"
            >
              <span class="flex items-center gap-1.5 text-muted-foreground">
                <Activity class="w-3.5 h-3.5 text-cyan-400" />
                Choreography Envelope
              </span>
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] font-mono font-medium text-muted-foreground">
                  {studio.choreo.phaseName}
                </span>
                {choreoOpen() ? (
                  <ChevronDown class="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight class="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </button>
            <Show when={choreoOpen()}>
              <div class="bg-muted/10 border-t border-border/40">
                <ChoreographyTelemetry />
              </div>
            </Show>
          </div>

          {/* ACCORDION 4: Declarative JSON Schema Contract */}
          <div class="flex flex-col flex-1 min-h-[160px]">
            <button
              type="button"
              onClick={() => setSchemaOpen((prev) => !prev)}
              class="w-full px-3 py-2 flex items-center justify-between text-xs font-mono font-bold text-foreground bg-card hover:bg-accent/40 transition-colors cursor-pointer text-left"
            >
              <span class="flex items-center gap-1.5 text-muted-foreground">
                <Code2 class="w-3.5 h-3.5 text-amber-400" />
                Declarative JSON Contract
              </span>
              <div class="flex items-center gap-1.5">
                <Badge variant="outline">v4.1</Badge>
                {schemaOpen() ? (
                  <ChevronDown class="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight class="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </button>
            <Show when={schemaOpen()}>
              <div class="flex-1 flex flex-col bg-muted/10 border-t border-border/40 overflow-hidden min-h-[220px]">
                <DeclarativeSchemaViewer />
              </div>
            </Show>
          </div>
        </div>
      </aside>
    </Show>
  );
};
