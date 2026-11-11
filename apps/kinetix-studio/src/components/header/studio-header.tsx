import { createSignal, onMount, onCleanup, Show, For, Component } from 'solid-js';
import { Layers, Check, ChevronDown, SlidersHorizontal, Monitor } from 'lucide-solid';
import { Badge } from '@/components/ui/badge';
import { useStudio } from '@/context/studio-context';
import { ArchetypeBar } from './archetype-bar';
import { QuickActionBar, type QuickActionBarProps } from './quick-action-bar';
import { ThemeSelector } from './theme-selector';
import { useAdaptiveLod, type LodDensityMode } from '@/hooks/use-adaptive-lod';
import { cn } from '@/lib/utils';

export interface StudioHeaderProps extends QuickActionBarProps {
  onOpenThemeModal?: () => void;
}

const DENSITY_OPTIONS: Array<{
  id: LodDensityMode;
  label: string;
  lodLabel: string;
  description: string;
}> = [
  {
    id: 'auto',
    label: 'Auto (Adaptive)',
    lodLabel: 'Auto',
    description: 'Dynamically responds to container width',
  },
  {
    id: 'full',
    label: 'Full Detail (LOD 0)',
    lodLabel: 'LOD 0',
    description: 'Expanded archetypes with badges & scroll nav',
  },
  {
    id: 'standard',
    label: 'Standard Pro (LOD 1)',
    lodLabel: 'LOD 1',
    description: 'Streamlined archetype pills & smooth scroll',
  },
  {
    id: 'compact',
    label: 'Compact Swatches (LOD 2)',
    lodLabel: 'LOD 2',
    description: 'Active pill + interactive miniature color swatches',
  },
  {
    id: 'minimal',
    label: 'Minimalist (LOD 3)',
    lodLabel: 'LOD 3',
    description: 'Single compact popover selector button',
  },
];

export const StudioHeader: Component<StudioHeaderProps> = (props) => {
  const { state } = useStudio();
  const lodState = useAdaptiveLod();
  const [densityMenuOpen, setDensityMenuOpen] = createSignal(false);
  let densityMenuRef: HTMLDivElement | undefined;

  // Close density menu on click outside or Escape
  onMount(() => {
    const handleDown = (e: MouseEvent) => {
      if (
        densityMenuOpen() &&
        densityMenuRef &&
        !densityMenuRef.contains(e.target as Node)
      ) {
        setDensityMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDensityMenuOpen(false);
    };
    document.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    });
  });

  return (
    <header
      ref={lodState.containerRef}
      class="h-13 px-3 border-b border-border bg-background/95 text-foreground flex items-center justify-between gap-2 shrink-0 z-20 relative select-none"
    >
      {/* Left Region: Brand Logo + Adaptive Archetype Command Bar */}
      <div class="flex items-center gap-2 min-w-0 flex-1">
        {/* Brand Logo & Version (Adapts by LOD) */}
        <div class="flex items-center gap-1.5 shrink-0">
          {/* Glowing Beacon */}
          <div class="relative flex items-center justify-center">
            <div class="w-2.5 h-2.5 rounded-full bg-primary shadow-xs" />
            <div class="absolute w-4 h-4 rounded-full bg-primary/20 animate-ping pointer-events-none" />
          </div>

          {/* Brand Name Typography */}
          <Show
            when={lodState.lod !== 3}
            fallback={
              <span
                class="font-mono font-black tracking-widest text-xs text-foreground px-1 py-0.5 rounded bg-card border border-border"
                title="Kinetix Studio v4.0"
              >
                KX
              </span>
            }
          >
            <span class="font-mono font-bold tracking-wider text-sm text-foreground flex items-center gap-1">
              KINETIX
              <Show when={lodState.lod === 0}>
                <span class="text-xs text-muted-foreground font-normal">
                  STUDIO
                </span>
              </Show>
            </span>
          </Show>

          {/* Version Badge (Hidden on LOD 3) */}
          <Show when={lodState.lod <= 1}>
            <Badge variant="lime">v4.0</Badge>
          </Show>

          {/* LOD 0 Format Badge */}
          <Show when={lodState.lod === 0}>
            <span class="hidden 2xl:flex items-center gap-1 px-1.5 py-0.5 rounded bg-card border border-border text-xs font-mono text-muted-foreground">
              <Monitor class="w-2.5 h-2.5 text-muted-foreground" />
              <span>{state.aspectRatio}</span>
              <span class="opacity-50">•</span>
              <span>{state.fps} FPS</span>
            </span>
          </Show>
        </div>

        <div class="h-4 w-px bg-border shrink-0" />

        {/* Adaptive Archetype Command Bar */}
        <ArchetypeBar lod={lodState.lod} />
      </div>

      {/* Right Region: Adaptive LOD Switcher + Quick Action Bar */}
      <div class="flex items-center gap-1.5 shrink-0">
        {/* Adaptive LOD Density Mode Switcher */}
        <div class="relative" ref={densityMenuRef}>
          <button
            type="button"
            onClick={() => setDensityMenuOpen((prev) => !prev)}
            aria-expanded={densityMenuOpen()}
            aria-haspopup="menu"
            title={`Adaptive LOD: ${(lodState.densityMode ?? 'auto').toUpperCase()} (LOD ${lodState.lod}) - Container: ${Math.round(
              lodState.width
            )}px`}
            class={cn(
              'h-7 rounded-md font-mono text-xs transition-all flex items-center gap-1.5 border cursor-pointer select-none',
              lodState.lod === 0 ? 'px-2' : 'px-1.5',
              lodState.densityMode !== 'auto'
                ? 'bg-primary/15 border-primary/50 text-primary font-bold'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <Show
              when={lodState.lod === 0}
              fallback={
                <>
                  <Layers class="w-3 h-3" />
                  <span class="hidden sm:inline font-semibold">
                    L{lodState.lod}
                  </span>
                </>
              }
            >
              <SlidersHorizontal class="w-3 h-3 text-primary" />
              <span class="font-semibold">
                LOD: {(lodState.densityMode ?? 'auto').toUpperCase()}
              </span>
              <span class="text-xs text-muted-foreground">
                ({lodState.lod})
              </span>
              <ChevronDown class="w-2.5 h-2.5 text-muted-foreground" />
            </Show>
          </button>

          {/* Density Mode Dropdown Menu */}
          <Show when={densityMenuOpen()}>
            <div
              role="menu"
              class="absolute right-0 top-full mt-1.5 w-64 bg-popover border border-border rounded-lg shadow-2xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 text-popover-foreground"
            >
              <div class="px-2 py-1.5 text-xs font-mono uppercase tracking-wider font-semibold text-muted-foreground border-b border-border flex items-center justify-between">
                <span>DENSITY & DETAIL LEVEL</span>
                <span class="text-muted-foreground">
                  {Math.round(lodState.width)}px
                </span>
              </div>

              <For each={DENSITY_OPTIONS}>
                {(opt) => {
                  const isSelected = () => lodState.densityMode === opt.id;
                  return (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        lodState.setDensityMode(opt.id);
                        setDensityMenuOpen(false);
                      }}
                      class={cn(
                        'w-full text-left px-2 py-1.5 rounded-md font-mono text-xs flex items-start justify-between gap-2 transition-colors cursor-pointer',
                        isSelected()
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'text-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                    >
                      <div class="flex flex-col">
                        <span class="flex items-center gap-1.5">{opt.label}</span>
                        <span class="text-[11px] text-muted-foreground font-normal">
                          {opt.description}
                        </span>
                      </div>
                      <Show when={isSelected()}>
                        <Check class="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        <div class="h-4 w-px bg-border shrink-0" />

        {/* Studio Chrome Theme Selector */}
        <ThemeSelector onOpenThemeModal={props.onOpenThemeModal} />

        <div class="h-4 w-px bg-border shrink-0" />

        {/* Studio Quick Action Bar */}
        <QuickActionBar
          onOpenVault={props.onOpenVault}
          onOpenMediaVault={props.onOpenMediaVault}
          onOpenLottieHub={props.onOpenLottieHub}
          onOpenMatrixTest={props.onOpenMatrixTest}
          onOpenShare={props.onOpenShare}
          onOpenPresenter={props.onOpenPresenter}
          onOpenCopilot={props.onOpenCopilot}
          onOpenVjRig={props.onOpenVjRig}
          onExportSnapshot={props.onExportSnapshot}
          onExportSvg={props.onExportSvg}
          onRecordVideo={props.onRecordVideo}
          onExportMp4={props.onExportMp4}
          onExportGif={props.onExportGif}
          isRecording={props.isRecording}
          recordProgress={props.recordProgress}
          matrixTestOpen={props.matrixTestOpen}
          batchCycleActive={props.batchCycleActive}
        />
      </div>
    </header>
  );
};
