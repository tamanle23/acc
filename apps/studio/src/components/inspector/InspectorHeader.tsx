import React from 'react';
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
} from 'lucide-react';
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
  addEffectSlot?: React.ReactNode;
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
export const InspectorHeader: React.FC<InspectorHeaderProps> = ({
  currentMode,
  onModeChange,
  projectTitle,
  effectiveTrack,
  selectedSeq,
  canAddEffect,
  isAddEffectDisabled,
  isSearchOpen,
  onToggleSearch,
  isBypassAllActive,
  onToggleBypassAll,
  onOpenAddPicker,
  addEffectSlot,
}) => {
  const modalityColor =
    MODALITY_COLOR_MAP[effectiveTrack?.type || 'video'] || 'bg-accent-theme';

  return (
    <div className="p-2.5 border-b border-glass-border bg-glass-surface/40 flex flex-col gap-2">
      {/* Title & Global Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sliders className="w-4 h-4 text-accent-theme shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            Inspector
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Property Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSearch}
            className={`h-6 w-6 cursor-pointer ${
              isSearchOpen
                ? 'text-accent-theme bg-accent-theme/15'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle property filter"
            aria-label="Toggle property search filter"
          >
            <Search className="w-3.5 h-3.5" />
          </Button>

          {/* Master A/B Bypass All Effects */}
          {selectedSeq && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleBypassAll}
              className={`h-6 w-6 cursor-pointer ${
                isBypassAllActive
                  ? 'text-amber-500 bg-amber-500/15'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={
                isBypassAllActive
                  ? 'Bypass active (auditioning raw footage)'
                  : 'Bypass all modifiers (A/B audition)'
              }
              aria-label="Bypass all modifiers"
            >
              {isBypassAllActive ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </Button>
          )}

          {/* Add Effect Launcher */}
          {canAddEffect &&
            (addEffectSlot ? (
              addEffectSlot
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={isAddEffectDisabled}
                onClick={onOpenAddPicker}
                className="h-6 text-[10px] gap-1 px-1.5 border-accent-theme/40 text-accent-theme bg-accent-theme/10 hover:bg-accent-theme/20 cursor-pointer disabled:cursor-not-allowed"
                title="Add effect or modifier"
                aria-label="Add effect or modifier"
              >
                <Plus className="w-3 h-3" />
                Add Effect
              </Button>
            ))}
        </div>
      </div>

      {/* Multi-Tier Interactive Breadcrumbs & Quick Mode Switcher */}
      <nav
        aria-label="Inspector Hierarchy"
        className="flex items-center gap-1 overflow-x-auto text-[10px] font-mono scrollbar-none py-0.5"
      >
        {/* Project Tier */}
        <button
          type="button"
          aria-current={currentMode === 'timeline' ? 'page' : undefined}
          onClick={() => {
            IRStateManager.getInstance().setSelectedSequenceId(null);
            onModeChange('timeline');
          }}
          className={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1 truncate max-w-[95px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            currentMode === 'timeline'
              ? 'bg-accent-theme text-primary-foreground shadow-2xs'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
          }`}
          title="Inspect Timeline Master Settings"
        >
          <Settings className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{projectTitle || 'Timeline'}</span>
        </button>

        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />

        {/* Track Tier */}
        <button
          type="button"
          disabled={!effectiveTrack}
          aria-current={currentMode === 'track' ? 'page' : undefined}
          onClick={() => {
            if (effectiveTrack) {
              IRStateManager.getInstance().setSelectedSequenceId(null);
              IRStateManager.getInstance().setSelectedTrackId(effectiveTrack.id);
              onModeChange('track');
            }
          }}
          className={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1.5 truncate max-w-[105px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            !effectiveTrack
              ? 'opacity-40 cursor-not-allowed text-muted-foreground'
              : currentMode === 'track'
              ? 'bg-accent-theme text-primary-foreground shadow-2xs cursor-pointer'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer'
          }`}
          title={
            effectiveTrack
              ? `Inspect Track ${effectiveTrack.name || effectiveTrack.id}`
              : 'No track selected'
          }
        >
          <div className="flex items-center gap-1 truncate">
            <span className={`w-1.5 h-1.5 rounded-full ${modalityColor} shrink-0`} />
            <Layers className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">
              {effectiveTrack?.name || effectiveTrack?.id || 'Track'}
            </span>
          </div>
        </button>

        {/* Sequence Tier */}
        {selectedSeq && (
          <>
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <button
              type="button"
              aria-current={currentMode === 'sequence' ? 'page' : undefined}
              onClick={() => {
                IRStateManager.getInstance().setSelectedSequenceId(selectedSeq.id);
                onModeChange('sequence');
              }}
              className={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1 truncate max-w-[110px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                currentMode === 'sequence'
                  ? 'bg-accent-theme text-primary-foreground shadow-2xs'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
              title={`Inspect Sequence ${selectedSeq.id}`}
            >
              <Film className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{selectedSeq.id}</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
};
