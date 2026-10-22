import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Settings,
  Layers,
  Film,
  Plus,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Button } from './ui/button';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
} from './ui/dropdown-menu';
import { IRStateManager } from '../lib/ir/irState';
import { ProjectInspector } from './inspector/ProjectInspector';
import { TrackInspector } from './inspector/TrackInspector';
import { SequenceInspector } from './inspector/SequenceInspector';
import {
  getAvailableModifiersFromRegistry,
  type AvailableModifierDef,
} from './inspector/modifierCatalog';

// Re-export all catalog definitions and helper controls for 100% backward compatibility
export * from './inspector/modifierCatalog';
export * from './inspector/ParameterControls';
export { ProjectInspector } from './inspector/ProjectInspector';
export { TrackInspector } from './inspector/TrackInspector';
export { SequenceInspector } from './inspector/SequenceInspector';
export { DynamicModifierInspector } from './inspector/DynamicModifierInspector';

export function RightSidebar() {
  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());
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

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const selectedSeqId = irState.selectedSequenceId;
  const selectedTrackId = irState.selectedTrackId;

  // Resolve selected track & sequence
  let selectedTrack: any = null;
  let selectedSeq: any = null;

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
    (selectedSeq ? 'sequence' : selectedTrack ? 'track' : 'project');

  const trackType = (selectedTrack?.type || 'video') as
    | 'video'
    | 'audio'
    | 'timed_text'
    | 'data';
  const availableModifiers = getAvailableModifiersFromRegistry();
  const relevantModifiers = availableModifiers.filter((mod) =>
    mod.supportedTrackTypes.includes(trackType)
  );

  const modifiers: any[] = selectedSeq?.modifiers || [];

  const handleAddEffect = (mod: AvailableModifierDef) => {
    if (!selectedSeqId || isSequenceLocked) return;
    IRStateManager.getInstance().addModifier(selectedSeqId, {
      type: mod.type,
      params: { ...mod.defaultParams },
    });
    const sectionId = getSectionIdForModifierType(mod.type);
    setOpenSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
  };

  const inspectorScrollRef = React.useRef<HTMLDivElement | null>(null);

  const inspectorSections = React.useMemo(() => {
    if (currentMode === 'track' && selectedTrack) {
      return [{ id: `track-${selectedTrack.id}`, type: 'track' }];
    }
    if (currentMode === 'project' || !selectedSeq) {
      return [{ id: 'project-inspector', type: 'project' }];
    }
    return [{ id: `sequence-${selectedSeq.id}`, type: 'sequence' }];
  }, [currentMode, selectedTrack, selectedSeq]);

  const inspectorVirtualizer = useVirtualizer({
    count: inspectorSections.length,
    getScrollElement: () => inspectorScrollRef.current,
    estimateSize: () => 500,
    overscan: 2,
  });

  return (
    <aside className="w-[336px] glass-panel border-l border-glass-border flex flex-col h-full select-none shadow-xs z-10 shrink-0">
      {/* 1. Multi-Tier Interactive Breadcrumbs & Header */}
      <div className="p-2.5 border-b border-glass-border bg-glass-surface/40 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sliders className="w-4 h-4 text-accent-theme shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
              Inspector
            </span>
          </div>

          {currentMode === 'sequence' && selectedSeq && (
            <DropdownMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSequenceLocked}
                  className="h-6 text-[10px] gap-1 px-1.5 border-accent-theme/40 text-accent-theme bg-accent-theme/10 hover:bg-accent-theme/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                  Add Effect
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  {relevantModifiers.map((mod) => {
                    const isAttached = modifiers.some((m: any) => m.type === mod.type);
                    const Icon = mod.icon;
                    return (
                      <DropdownMenuItem
                        key={mod.type}
                        disabled={isAttached || isSequenceLocked}
                        onSelect={() => handleAddEffect(mod)}
                        onClick={() => handleAddEffect(mod)}
                        className="flex items-center justify-between cursor-pointer py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-accent-theme" />
                          <span>{mod.name}</span>
                        </div>
                        {isAttached && <Check className="w-3.5 h-3.5 text-accent-theme" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Persistent Breadcrumb Navigation Bar: [Project] > [Track] > [Sequence] */}
        <nav aria-label="Inspector Hierarchy" className="flex items-center gap-1 overflow-x-auto text-[10px] font-mono scrollbar-none py-0.5">
          {/* Project Tier Pill */}
          <button
            type="button"
            aria-current={currentMode === 'project' ? 'page' : undefined}
            onClick={() => IRStateManager.getInstance().setInspectorMode('project')}
            className={`px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-1 truncate max-w-[90px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${currentMode === 'project'
              ? 'bg-accent-theme text-primary-foreground shadow-2xs'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            title="Inspect Project Master Settings"
          >
            <Settings className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{irState.doc.meta?.contentId || 'Project'}</span>
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

      {/* 2. Main Content Area Virtualized with TanStack Virtual */}
      <div ref={inspectorScrollRef} className="flex-1 p-3 overflow-y-auto">
        <div
          style={{
            height: `${inspectorVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {inspectorVirtualizer.getVirtualItems().map((virtualItem) => {
            const section = inspectorSections[virtualItem.index];
            if (!section) return null;
            return (
              <div
                key={section.id}
                data-index={virtualItem.index}
                ref={inspectorVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {section.type === 'track' && selectedTrack ? (
                  <TrackInspector selectedTrack={selectedTrack} irState={irState} />
                ) : section.type === 'project' || !selectedSeq ? (
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
            );
          })}
        </div>
      </div>
    </aside>
  );
}
