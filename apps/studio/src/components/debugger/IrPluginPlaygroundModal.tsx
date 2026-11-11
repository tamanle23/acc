import { createSignal, onMount, onCleanup, Show, Switch as MatchSwitch, Match } from 'solid-js';
import {
  Sparkles,
  LayoutGrid,
  Maximize2,
  Code2,
  X,
  PlusCircle,
  HelpCircle,
  Layers,
} from 'lucide-solid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../ui/resizable';
import { usePlaygroundEngine, type ViewMode } from './playground/usePlaygroundEngine';
import { PlaygroundViewport } from './playground/PlaygroundViewport';
import { PlaygroundCatalog } from './playground/PlaygroundCatalog';
import { PlaygroundInspector } from './playground/PlaygroundInspector';

export interface IrPluginPlaygroundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPluginType?: string;
}

export function IrPluginPlaygroundModal(props: IrPluginPlaygroundModalProps) {
  const engine = usePlaygroundEngine(props.initialPluginType || 'overlay/canvas_particles');
  const [applyFeedback, setApplyFeedback] = createSignal<string | null>(null);

  // Keyboard navigation inside modal
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!props.open) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        engine.togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        engine.seek(engine.state.currentFrame - step);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        engine.seek(engine.state.currentFrame + step);
      } else if (e.code === 'Home') {
        e.preventDefault();
        engine.seek(0);
      } else if (e.code === 'End') {
        e.preventDefault();
        engine.seek(engine.state.totalFrames - 1);
      } else if (e.key === '1') {
        engine.setViewMode('trio');
      } else if (e.key === '2') {
        engine.setViewMode('focus');
      } else if (e.key === '3') {
        engine.setViewMode('code');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  const handleApplyToStudio = () => {
    const res = engine.applyToActiveSequence();
    setApplyFeedback(res.message);
    setTimeout(() => setApplyFeedback(null), 3000);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        data-testid="ir-plugin-playground-modal"
        class="sm:max-w-none max-w-7xl w-[96vw] h-[90vh] flex flex-col glass-panel border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] p-0 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Modal Header */}
        <DialogHeader class="flex flex-row items-center justify-between px-5 py-2.5 border-b border-glass-border shrink-0 bg-glass-surface/80 backdrop-blur-md">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-accent-theme/15 text-accent-theme border border-accent-theme/30 flex items-center justify-center shadow-accent-glow">
              <Sparkles class="w-4 h-4" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <DialogTitle class="text-sm font-bold text-foreground">
                  IR Modifier & Plugin Visual Playground
                </DialogTitle>
                <Badge
                  variant="outline"
                  class="font-mono text-[10px] border-accent-theme/30 text-accent-theme bg-accent-theme/10"
                >
                  60 FPS Hardware Render
                </Badge>
              </div>
              <p class="text-[11px] text-muted-foreground font-mono">
                Interactive real-time parameter tweaking, live Shiki JSON sync & Studio timeline bridge
              </p>
            </div>
          </div>

          {/* Right Header Toolbar */}
          <div class="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div class="flex items-center rounded-lg bg-black/20 p-0.5 border border-white/10 text-xs font-mono">
              <button
                type="button"
                title="Trio Mode (1): Catalog + Canvas + Inspector"
                class={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  engine.state.viewMode === 'trio'
                    ? 'bg-accent-theme/20 text-accent-theme font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => engine.setViewMode('trio')}
              >
                <LayoutGrid class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Trio</span>
              </button>

              <button
                type="button"
                title="Canvas Focus Mode (2): Maximized Canvas Viewport"
                class={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  engine.state.viewMode === 'focus'
                    ? 'bg-accent-theme/20 text-accent-theme font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => engine.setViewMode('focus')}
              >
                <Maximize2 class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Focus</span>
              </button>

              <button
                type="button"
                title="Code Split Mode (3): Canvas + Shiki JSON Inspector"
                class={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  engine.state.viewMode === 'code'
                    ? 'bg-accent-theme/20 text-accent-theme font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => engine.setViewMode('code')}
              >
                <Code2 class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Code</span>
              </button>
            </div>

            {/* Apply Button */}
            <Button
              variant="default"
              size="sm"
              class="h-8 px-3 text-xs font-mono bg-accent-theme hover:bg-accent-theme/90 text-white font-bold gap-1.5 shadow-accent-glow"
              onClick={handleApplyToStudio}
            >
              <PlusCircle class="w-3.5 h-3.5" />
              <span>Apply to Sequence</span>
            </Button>

            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              class="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => props.onOpenChange(false)}
            >
              <X class="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Feedback Alert Bar */}
        <Show when={applyFeedback()}>
          {(msg) => (
            <div class="px-4 py-1.5 bg-accent-theme/15 border-b border-accent-theme/30 text-accent-theme text-xs font-mono text-center shrink-0">
              {msg()}
            </div>
          )}
        </Show>

        {/* Dynamic Resizable Layout */}
        <div class="flex-1 min-h-0 min-w-0 overflow-hidden">
          <MatchSwitch>
            {/* 1. Trio Mode (Default) */}
            <Match when={engine.state.viewMode === 'trio'}>
              <ResizablePanelGroup orientation="horizontal" class="h-full w-full">
                <ResizablePanel defaultSize="260px" minSize="200px" maxSize="360px">
                  <PlaygroundCatalog engine={engine} />
                </ResizablePanel>

                <ResizableHandle class="w-1 bg-glass-border/40 hover:bg-accent-theme/50 transition-colors cursor-col-resize" />

                <ResizablePanel minSize="350px">
                  <PlaygroundViewport engine={engine} />
                </ResizablePanel>

                <ResizableHandle class="w-1 bg-glass-border/40 hover:bg-accent-theme/50 transition-colors cursor-col-resize" />

                <ResizablePanel defaultSize="340px" minSize="260px" maxSize="450px">
                  <PlaygroundInspector engine={engine} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </Match>

            {/* 2. Focus Mode */}
            <Match when={engine.state.viewMode === 'focus'}>
              <ResizablePanelGroup orientation="horizontal" class="h-full w-full">
                <ResizablePanel defaultSize="180px" minSize="140px" maxSize="240px">
                  <PlaygroundCatalog engine={engine} />
                </ResizablePanel>

                <ResizableHandle class="w-1 bg-glass-border/40 hover:bg-accent-theme/50 transition-colors cursor-col-resize" />

                <ResizablePanel minSize="400px">
                  <PlaygroundViewport engine={engine} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </Match>

            {/* 3. Code Split Mode */}
            <Match when={engine.state.viewMode === 'code'}>
              <ResizablePanelGroup orientation="horizontal" class="h-full w-full">
                <ResizablePanel minSize="350px">
                  <PlaygroundViewport engine={engine} />
                </ResizablePanel>

                <ResizableHandle class="w-1 bg-glass-border/40 hover:bg-accent-theme/50 transition-colors cursor-col-resize" />

                <ResizablePanel defaultSize="420px" minSize="300px" maxSize="600px">
                  <PlaygroundInspector engine={engine} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </Match>
          </MatchSwitch>
        </div>
      </DialogContent>
    </Dialog>
  );
}
