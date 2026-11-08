import { Show, type JSX } from 'solid-js';
import {
  Sliders,
  Settings,
  Layers,
  Film,
  Plus,
  ChevronRight,
  Search,
  Eye,
  EyeOff,
} from 'lucide-solid';
import { Button } from '../ui/button';
import { IRStateManager } from '../../lib/ir/irState';
import type { IRTrack, IRSequence } from '@acc/ir';

export interface InspectorHeaderProps {
  currentMode: 'timeline' | 'track' | 'sequence';
  onModeChange: (mode: 'timeline' | 'track' | 'sequence') => void;
  projectTitle: string;
  effectiveTrack: IRTrack | null;
  selectedSeq: IRSequence | null;
  canAddEffect: boolean;
  isAddEffectDisabled: boolean;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  isBypassAllActive: boolean;
  onToggleBypassAll: () => void;
  onOpenAddPicker?: () => void;
  addEffectSlot?: JSX.Element;
  children?: JSX.Element;
}

const MODALITY_COLOR_MAP: Record<string, string> = {
  video: 'bg-indigo-500',
  audio: 'bg-emerald-500',
  timed_text: 'bg-violet-500',
  data: 'bg-amber-500',
};

/**
 * InspectorHeader:
 * Multi-tier responsive breadcrumb navigation and action toolbar for the Studio Inspector.
 */
export function InspectorHeader(props: InspectorHeaderProps) {
  const modalityColor = () =>
    MODALITY_COLOR_MAP[props.effectiveTrack?.type || 'video'] || 'bg-accent-theme';

  return (
    <div class="p-2.5 border-b border-glass-border bg-glass-surface/40 flex flex-col gap-2">
      {/* Title & Global Action Bar */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 min-w-0">
          <Sliders class="w-4 h-4 text-accent-theme shrink-0" />
          <span class="text-[11px] font-bold uppercase tracking-wider text-foreground">
            Inspector
          </span>
        </div>

        <div class="flex items-center gap-1">
          {/* Property Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={props.onToggleSearch}
            class={`h-6 w-6 cursor-pointer ${
              props.isSearchOpen
                ? 'text-accent-theme bg-accent-theme/15'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle property filter"
            aria-label="Toggle property search filter"
          >
            <Search class="w-3.5 h-3.5" />
          </Button>

          {/* Master A/B Bypass All Effects */}
          <Show when={props.selectedSeq}>
            <Button
              variant="ghost"
              size="icon"
              onClick={props.onToggleBypassAll}
              class={`h-6 w-6 cursor-pointer ${
                props.isBypassAllActive
                  ? 'text-amber-500 bg-amber-500/15'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={
                props.isBypassAllActive
                  ? 'Bypass active (auditioning raw footage)'
                  : 'Bypass all modifiers (A/B audition)'
              }
              aria-label="Bypass all modifiers"
            >
              <Show when={props.isBypassAllActive} fallback={<Eye class="w-3.5 h-3.5" />}>
                <EyeOff class="w-3.5 h-3.5" />
              </Show>
            </Button>
          </Show>

          {/* Add Effect Launcher */}
          <Show when={props.canAddEffect}>
            {props.children ?? props.addEffectSlot ?? (
              <Button
                variant="outline"
                size="sm"
                disabled={props.isAddEffectDisabled}
                onClick={props.onOpenAddPicker}
                class="h-6 text-[10px] gap-1 px-1.5 border-accent-theme/40 text-accent-theme bg-accent-theme/10 hover:bg-accent-theme/20 cursor-pointer disabled:cursor-not-allowed"
                title="Add effect or modifier"
                aria-label="Add effect or modifier"
              >
                <Plus class="w-3 h-3" />
                Add Effect
              </Button>
            )}
          </Show>
        </div>
      </div>

      {/* Multi-Tier Interactive Breadcrumbs & Quick Mode Switcher */}
      <nav
        aria-label="Inspector Hierarchy"
        class="flex items-center gap-1 overflow-x-auto text-[10px] font-mono scrollbar-none py-0.5"
      >
        {/* Project Tier */}
        <button
          type="button"
          aria-current={props.currentMode === 'timeline' ? 'page' : undefined}
          onClick={() => {
            IRStateManager.getInstance().setSelectedSequenceId(null);
            props.onModeChange('timeline');
          }}
          class={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1 truncate max-w-[95px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            props.currentMode === 'timeline'
              ? 'bg-accent-theme text-primary-foreground shadow-2xs'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
          }`}
          title="Inspect Timeline Master Settings"
        >
          <Settings class="w-2.5 h-2.5 shrink-0" />
          <span class="truncate">{props.projectTitle || 'Timeline'}</span>
        </button>

        <ChevronRight class="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />

        {/* Track Tier */}
        <button
          type="button"
          disabled={!props.effectiveTrack}
          aria-current={props.currentMode === 'track' ? 'page' : undefined}
          onClick={() => {
            if (props.effectiveTrack) {
              IRStateManager.getInstance().setSelectedSequenceId(null);
              IRStateManager.getInstance().setSelectedTrackId(props.effectiveTrack.id);
              props.onModeChange('track');
            }
          }}
          class={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1.5 truncate max-w-[105px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            !props.effectiveTrack
              ? 'opacity-40 cursor-not-allowed text-muted-foreground'
              : props.currentMode === 'track'
                ? 'bg-accent-theme text-primary-foreground shadow-2xs cursor-pointer'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer'
          }`}
          title={
            props.effectiveTrack
              ? `Inspect Track ${props.effectiveTrack.name || props.effectiveTrack.id}`
              : 'No track selected'
          }
        >
          <div class="flex items-center gap-1 truncate">
            <span class={`w-1.5 h-1.5 rounded-full ${modalityColor()} shrink-0`} />
            <Layers class="w-2.5 h-2.5 shrink-0" />
            <span class="truncate">
              {props.effectiveTrack?.name || props.effectiveTrack?.id || 'Track'}
            </span>
          </div>
        </button>

        {/* Sequence Tier */}
        <Show when={props.selectedSeq}>
          <ChevronRight class="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
          <button
            type="button"
            aria-current={props.currentMode === 'sequence' ? 'page' : undefined}
            onClick={() => {
              IRStateManager.getInstance().setSelectedSequenceId(props.selectedSeq!.id);
              props.onModeChange('sequence');
            }}
            class={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1 truncate max-w-[110px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              props.currentMode === 'sequence'
                ? 'bg-accent-theme text-primary-foreground shadow-2xs'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
            }`}
            title={`Inspect Sequence ${props.selectedSeq!.id}`}
          >
            <Film class="w-2.5 h-2.5 shrink-0" />
            <span class="truncate">{props.selectedSeq!.id}</span>
          </button>
        </Show>
      </nav>
    </div>
  );
}
