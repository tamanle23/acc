import React, { useState } from 'react';
import {
  Sliders,
  Settings,
  Layers,
  Film,
  Plus,
  Check,
  ChevronRight,
  Sparkles,
  Move,
  Volume2,
  Type,
  FolderPlus,
  Galaxy
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './ui/dropdown-menu';
import type { IRSequence, IRTrack, ModifierNode } from '@acc/ir';
import { ModifierPluginRegistry } from '@acc/ir';
import { IRStateManager } from '../lib/ir/irState';
import { useIRState } from '../lib/ir/useStudioStore';
import { ProjectInspector } from './inspector/ProjectInspector';
import { TrackInspector } from './inspector/TrackInspector';
import { SequenceInspector } from './inspector/SequenceInspector';
import {
  getAvailableModifiersFromRegistry,
  getSectionIdForModifierType,
  type AvailableModifierDef,
  type ModifierCategory,
  type ModifierIconComponent,
} from './inspector/modifierCatalog';

export * from './inspector/modifierCatalog';
export * from './inspector/ParameterControls';
export { ProjectInspector } from './inspector/ProjectInspector';
export { TrackInspector } from './inspector/TrackInspector';
export { SequenceInspector } from './inspector/SequenceInspector';
export { DynamicModifierInspector } from './inspector/DynamicModifierInspector';

const CATEGORY_CONFIG: Record<ModifierCategory, { label: string; icon: ModifierIconComponent }> = {
  motion: { label: 'Motion & Spatial', icon: Move },
  time_space: { label: 'Spatio-Temporal ', icon: Galaxy },
  vfx: { label: 'Visual Effects (VFX)', icon: Sparkles },
  transitions: { label: 'Transitions', icon: Film },
  audio: { label: 'Audio & DSP', icon: Volume2 },
  text: { label: 'Typography & Shapes', icon: Type },
  custom: { label: 'Extensions & Custom', icon: FolderPlus },
};
const CATEGORY_KEYS = Object.keys(CATEGORY_CONFIG) as ModifierCategory[];

export function RightSidebar() {
  const irState = useIRState();
  const [openSections, setOpenSections] = useState<string[]>([
    'transform',
    'motion_gsap',
    'relighting',
    'camera',
    'particles',
    'hologram_hud',
    'typography',
    'color',
    'audio',
    'procedural_sfx',
    'transitions',
  ]);
  const [isSequenceLocked, setIsSequenceLocked] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const selectedSeqId = irState.selectedSequenceId;
  const selectedTrackId = irState.selectedTrackId;

  // Resolve selected track & sequence
  let selectedTrack: IRTrack | null = null;
  let selectedSeq: IRSequence | null = null;

  for (const track of irState.doc.tracks) {
    if (track.id === selectedTrackId) {
      selectedTrack = track;
    }
    const found = track.sequences.find((s) => s.id === selectedSeqId);
    if (found) {
      selectedSeq = found;
      if (!selectedTrack) selectedTrack = track;
    }
  }

  const fps = irState.doc.meta?.globalFps || 30;
  const currentMode =
    irState.inspectorMode ||
    (selectedSeq ? 'sequence' : selectedTrack ? 'track' : 'timeline');

  const trackType = (selectedTrack?.type || 'video') as
    | 'video'
    | 'audio'
    | 'timed_text'
    | 'data';
  const availableModifiers = getAvailableModifiersFromRegistry();
  const registry = ModifierPluginRegistry.getInstance();

  const hasStandaloneGenerator = Boolean(
    selectedSeq?.modifiers?.some((m) => registry.get(m.type)?.targetScope === 'standalone')
  );
  const existingModifierTypes = selectedSeq?.modifiers?.map((m) => m.type) || [];

  const relevantModifiers = availableModifiers.filter((mod) => {
    if (currentMode === 'sequence' && selectedSeq) {
      if (selectedTrack && !mod.supportedTrackTypes.includes(trackType)) return false;
      return registry.isModifierAllowedOnEntity(mod.type, {
        type: 'sequence',
        sequenceType: selectedSeq.type,
        hasStandaloneGenerator,
        existingModifierTypes,
      }).allowed;
    }
    if (currentMode === 'track' && selectedTrack) {
      if (!mod.supportedTrackTypes.includes(selectedTrack.type)) return false;
      return registry.isModifierAllowedOnEntity(mod.type, {
        type: 'track',
      }).allowed;
    }
    if (currentMode === 'timeline') {
      return registry.isModifierAllowedOnEntity(mod.type, {
        type: 'timeline',
      }).allowed;
    }
    return false;
  });

  const activeEntityModifiers: ModifierNode[] =
    currentMode === 'sequence' && selectedSeq
      ? selectedSeq.modifiers || []
      : currentMode === 'track' && selectedTrack
      ? selectedTrack.modifiers || []
      : currentMode === 'timeline'
      ? irState.doc.modifiers || []
      : [];

  const canAddEffect =
    (currentMode === 'sequence' && Boolean(selectedSeq)) ||
    (currentMode === 'track' && Boolean(selectedTrack)) ||
    currentMode === 'timeline';
  const isAddEffectDisabled = currentMode === 'sequence' ? isSequenceLocked : false;

  const handleAddEffect = (mod: AvailableModifierDef) => {
    if (currentMode === 'sequence' && selectedSeq) {
      if (isSequenceLocked) return;
      IRStateManager.getInstance().addModifier(selectedSeq.id, {
        type: mod.type,
        params: { ...mod.defaultParams },
        target: selectedSeq.type,
      });
      const sectionId = getSectionIdForModifierType(mod.type);
      setOpenSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
    } else if (currentMode === 'track' && selectedTrack) {
      IRStateManager.getInstance().addModifier(selectedTrack.id, {
        type: mod.type,
        params: { ...mod.defaultParams },
        target: selectedTrack.type === 'timed_text' ? 'text' : 'video',
      });
    } else if (currentMode === 'timeline') {
      IRStateManager.getInstance().addModifier('timeline', {
        type: mod.type,
        params: { ...mod.defaultParams },
        target: 'video',
      });
    }
  };

  return (
    <aside className="w-full glass-panel border-l border-glass-border flex flex-col h-full select-none shadow-xs z-10">
      {/* 1. Multi-Tier Interactive Breadcrumbs & Header */}
      <div className="p-2.5 border-b border-glass-border bg-glass-surface/40 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sliders className="w-4 h-4 text-accent-theme shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
              Inspector
            </span>
          </div>

          {canAddEffect && (
            <DropdownMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isAddEffectDisabled}
                  className="h-6 text-[10px] gap-1 px-1.5 border-accent-theme/40 text-accent-theme bg-accent-theme/10 hover:bg-accent-theme/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                  Add Effect
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
                {relevantModifiers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No effects available for this {currentMode}.
                  </div>
                ) : (
                  CATEGORY_KEYS.map((catKey) => {
                    const groupModifiers = relevantModifiers.filter(
                      (m) => (m.category || 'custom') === catKey
                    );
                    if (groupModifiers.length === 0) return null;
                    const catMeta = CATEGORY_CONFIG[catKey];
                    const CatIcon = catMeta.icon;

                    return (
                      <DropdownMenuSub key={catKey}>
                        <DropdownMenuSubTrigger className="cursor-pointer py-1.5 text-xs flex items-center gap-2">
                          <CatIcon className="w-3.5 h-3.5 text-accent-theme shrink-0" />
                          <span className="font-medium">{catMeta.label}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto pr-1">
                            {groupModifiers.length}
                          </span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-56">
                          {groupModifiers.map((mod) => {
                            const isAttached = activeEntityModifiers.some(
                              (m: ModifierNode) => m.type === mod.type
                            );
                            const Icon = mod.icon;
                            return (
                              <DropdownMenuItem
                                key={mod.type}
                                disabled={isAttached || isAddEffectDisabled}
                                onSelect={() => handleAddEffect(mod)}
                                onClick={() => handleAddEffect(mod)}
                                className="flex items-center justify-between cursor-pointer py-1.5 text-xs"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Icon className="w-3.5 h-3.5 text-accent-theme shrink-0" />
                                  <span className="truncate">{mod.name}</span>
                                </div>
                                {isAttached && (
                                  <Check className="w-3.5 h-3.5 text-accent-theme shrink-0" />
                                )}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Persistent Breadcrumb Navigation Bar: [Project] > [Track] > [Sequence] */}
        <nav aria-label="Inspector Hierarchy" className="flex items-center gap-1 overflow-x-auto text-[10px] font-mono scrollbar-none py-0.5">
          {/* Project Tier Pill */}
          <button
            type="button"
            aria-current={currentMode === 'timeline' ? 'page' : undefined}
            onClick={() => IRStateManager.getInstance().setInspectorMode('timeline')}
            className={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1 truncate max-w-[90px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${currentMode === 'timeline'
              ? 'bg-accent-theme text-primary-foreground shadow-2xs'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            title="Inspect Timeline Master Settings"
          >
            <Settings className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{irState.doc.meta?.contentId || 'Timeline'}</span>
          </button>

          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />

          {/* Track Tier Pill */}
          <button
            type="button"
            disabled={!selectedTrack}
            aria-current={currentMode === 'track' ? 'page' : undefined}
            onClick={() => {
              if (selectedTrack) {
                IRStateManager.getInstance().setSelectedTrackId(selectedTrack.id);
                IRStateManager.getInstance().setInspectorMode('track');
              }
            }}
            className={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1 truncate max-w-[100px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!selectedTrack
              ? 'opacity-40 cursor-not-allowed text-muted-foreground'
              : currentMode === 'track'
                ? 'bg-accent-theme text-primary-foreground shadow-2xs cursor-pointer'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer'
              }`}
            title={selectedTrack ? `Inspect Track ${selectedTrack.id}` : 'No track selected'}
          >
            <Layers className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">
              {selectedTrack?.name || selectedTrack?.id || 'Track'}
            </span>
          </button>

          {selectedSeq && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />

              {/* Sequence Tier Pill */}
              <button
                type="button"
                aria-current={currentMode === 'sequence' ? 'page' : undefined}
                onClick={() => {
                  IRStateManager.getInstance().setSelectedSequenceId(selectedSeq.id);
                  IRStateManager.getInstance().setInspectorMode('sequence');
                }}
                className={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1 truncate max-w-[105px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${currentMode === 'sequence'
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

      {/* 2. Main Content Area */}
      <div className="flex-1 p-3 overflow-y-auto">
        {currentMode === 'track' && selectedTrack ? (
          <TrackInspector selectedTrack={selectedTrack} irState={irState} />
        ) : currentMode === 'timeline' || !selectedSeq ? (
          <ProjectInspector irState={irState} />
        ) : (
          <SequenceInspector
            selectedSeq={selectedSeq}
            selectedTrack={selectedTrack}
            irState={irState}
            fps={fps}
            isLocked={isSequenceLocked}
            onToggleLock={setIsSequenceLocked}
            openSections={openSections}
            onOpenSectionsChange={setOpenSections}
            onAddEffectClick={() => setIsAddMenuOpen(true)}
          />
        )}
      </div>
    </aside>
  );
}
