import { createSignal, createMemo, Show, Switch, Match } from 'solid-js';
import { Plus } from 'lucide-solid';
import { Button } from './ui/button';
import type { IRSequence, IRTrack, ModifierNode } from '@acc/ir';
import { ModifierPluginRegistry } from '@acc/ir';
import { IRStateManager } from '../lib/ir/irState';
import { useIRState } from '../lib/ir/useStudioStore';
import { ProjectInspector } from './inspector/ProjectInspector';
import { TrackInspector } from './inspector/TrackInspector';
import { SequenceInspector } from './inspector/SequenceInspector';
import { InspectorHeader } from './inspector/InspectorHeader';
import { PropertySearchFilter } from './inspector/PropertySearchFilter';
import { ModifierAddPicker } from './inspector/ModifierAddPicker';
import {
  getAvailableModifiersFromRegistry,
  getSectionIdForModifierType,
  type AvailableModifierDef,
} from './inspector/modifierCatalog';

export * from './inspector/modifierCatalog';
export * from './inspector/ParameterControls';
export { ProjectInspector } from './inspector/ProjectInspector';
export { TrackInspector } from './inspector/TrackInspector';
export { SequenceInspector } from './inspector/SequenceInspector';
export { DynamicModifierInspector } from './inspector/DynamicModifierInspector';

export function RightSidebar() {
  const irState = useIRState();
  const [openSections, setOpenSections] = useStateArray([
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
  const [isSequenceLocked, setIsSequenceLocked] = createSignal(false);
  const [isAddPickerOpen, setIsAddPickerOpen] = createSignal(false);
  const [isSearchOpen, setIsSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isBypassAllActive, setIsBypassAllActive] = createSignal(false);

  // Helper signal wrapper for setOpenSections with updater support
  function useStateArray(initial: string[]) {
    const [val, setVal] = createSignal<string[]>(initial);
    const setWithUpdater = (next: string[] | ((prev: string[]) => string[])) => {
      if (typeof next === 'function') {
        setVal((prev) => next(prev));
      } else {
        setVal(next);
      }
    };
    return [val, setWithUpdater] as const;
  }

  const selectedSeqId = () => irState().selectedSequenceId;
  const selectedTrackId = () => irState().selectedTrackId;

  // Resolve selected track & sequence reactively
  const resolved = createMemo(() => {
    const state = irState();
    let selectedTrack: IRTrack | null = null;
    let selectedSeq: IRSequence | null = null;

    for (const track of state.doc.tracks) {
      if (track.id === state.selectedTrackId) {
        selectedTrack = track;
      }
      const found = track.sequences.find((s) => s.id === state.selectedSequenceId);
      if (found) {
        selectedSeq = found;
        if (!selectedTrack) selectedTrack = track;
      }
    }

    const effectiveTrack: IRTrack | null =
      selectedTrack || (state.doc.tracks.length > 0 ? state.doc.tracks[0] : null);

    return { selectedTrack, selectedSeq, effectiveTrack };
  });

  const fps = () => irState().doc.meta?.globalFps || 30;

  const currentMode = createMemo<'timeline' | 'track' | 'sequence'>(() => {
    const state = irState();
    if (state.inspectorMode) return state.inspectorMode;
    const { selectedSeq, selectedTrack } = resolved();
    return selectedSeq ? 'sequence' : selectedTrack ? 'track' : 'timeline';
  });

  const trackType = () =>
    ((resolved().selectedTrack?.type || 'video') as
      | 'video'
      | 'audio'
      | 'timed_text'
      | 'data');

  const availableModifiers = getAvailableModifiersFromRegistry();
  const registry = ModifierPluginRegistry.getInstance();

  const relevantModifiers = createMemo(() => {
    const mode = currentMode();
    const { selectedSeq, selectedTrack } = resolved();
    const tType = trackType();

    const hasStandaloneGenerator = Boolean(
      selectedSeq?.modifiers?.some((m) => registry.get(m.type)?.targetScope === 'standalone')
    );
    const existingModifierTypes = selectedSeq?.modifiers?.map((m) => m.type) || [];

    return availableModifiers.filter((mod) => {
      if (mode === 'sequence' && selectedSeq) {
        if (selectedTrack && !mod.supportedTrackTypes.includes(tType)) return false;
        return registry.isModifierAllowedOnEntity(mod.type, {
          type: 'sequence',
          sequenceType: selectedSeq.type,
          hasStandaloneGenerator,
          existingModifierTypes,
        }).allowed;
      }
      if (mode === 'track' && selectedTrack) {
        if (!mod.supportedTrackTypes.includes(selectedTrack.type)) return false;
        return registry.isModifierAllowedOnEntity(mod.type, {
          type: 'track',
        }).allowed;
      }
      if (mode === 'timeline') {
        return registry.isModifierAllowedOnEntity(mod.type, {
          type: 'timeline',
        }).allowed;
      }
      return false;
    });
  });

  const activeEntityModifiers = createMemo<ModifierNode[]>(() => {
    const mode = currentMode();
    const { selectedSeq, selectedTrack } = resolved();
    if (mode === 'sequence' && selectedSeq) {
      return selectedSeq.modifiers || [];
    }
    if (mode === 'track' && selectedTrack) {
      return selectedTrack.modifiers || [];
    }
    if (mode === 'timeline') {
      return irState().doc.modifiers || [];
    }
    return [];
  });

  const canAddEffect = createMemo(() => {
    const mode = currentMode();
    const { selectedSeq, selectedTrack } = resolved();
    return (
      (mode === 'sequence' && Boolean(selectedSeq)) ||
      (mode === 'track' && Boolean(selectedTrack)) ||
      mode === 'timeline'
    );
  });

  const isAddEffectDisabled = createMemo(() => {
    return currentMode() === 'sequence' ? isSequenceLocked() : false;
  });

  const handleAddEffect = (mod: AvailableModifierDef) => {
    const mode = currentMode();
    const { selectedSeq, selectedTrack } = resolved();

    if (mode === 'sequence' && selectedSeq) {
      if (isSequenceLocked()) return;
      IRStateManager.getInstance().addModifier(selectedSeq.id, {
        type: mod.type,
        params: { ...mod.defaultParams },
        target: selectedSeq.type,
      });
      const sectionId = getSectionIdForModifierType(mod.type);
      setOpenSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
    } else if (mode === 'track' && selectedTrack) {
      IRStateManager.getInstance().addModifier(selectedTrack.id, {
        type: mod.type,
        params: { ...mod.defaultParams },
        target: selectedTrack.type === 'timed_text' ? 'text' : 'video',
      });
    } else if (mode === 'timeline') {
      IRStateManager.getInstance().addModifier('timeline', {
        type: mod.type,
        params: { ...mod.defaultParams },
        target: 'video',
      });
    }
  };

  return (
    <aside class="w-full glass-panel border-l border-glass-border flex flex-col h-full min-h-0 overflow-hidden select-none shadow-glass z-10">
      {/* 1. Header with Multi-Tier Breadcrumbs & Global Actions */}
      <InspectorHeader
        currentMode={currentMode()}
        onModeChange={(mode) => IRStateManager.getInstance().setInspectorMode(mode)}
        projectTitle={irState().doc.meta?.contentId || 'Timeline'}
        effectiveTrack={resolved().effectiveTrack}
        selectedSeq={resolved().selectedSeq}
        canAddEffect={canAddEffect()}
        isAddEffectDisabled={isAddEffectDisabled()}
        isSearchOpen={isSearchOpen()}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        isBypassAllActive={isBypassAllActive()}
        onToggleBypassAll={() => setIsBypassAllActive((prev) => !prev)}
        onOpenAddPicker={() => setIsAddPickerOpen(true)}
      >
        <ModifierAddPicker
          open={isAddPickerOpen()}
          onOpenChange={setIsAddPickerOpen}
          relevantModifiers={relevantModifiers()}
          activeEntityModifiers={activeEntityModifiers()}
          isDisabled={isAddEffectDisabled()}
          onSelectModifier={handleAddEffect}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={isAddEffectDisabled()}
            class="h-6 text-[10px] gap-1 px-1.5 border-accent-theme/40 text-accent-theme bg-accent-theme/10 hover:bg-accent-theme/20 cursor-pointer disabled:cursor-not-allowed"
            title="Add effect or modifier"
            aria-label="Add effect or modifier"
          >
            <Plus class="w-3 h-3" />
            Add Effect
          </Button>
        </ModifierAddPicker>
      </InspectorHeader>

      {/* 2. Real-Time Property Search Filter */}
      <Show when={isSearchOpen()}>
        <PropertySearchFilter
          query={searchQuery()}
          onQueryChange={setSearchQuery}
          onClose={() => setIsSearchOpen(false)}
        />
      </Show>

      {/* 3. Main Inspector Content Routing */}
      <div class="flex-1 p-3 overflow-y-auto min-h-0">
        <Switch>
          <Match when={currentMode() === 'track' && Boolean(resolved().effectiveTrack)}>
            <TrackInspector selectedTrack={resolved().effectiveTrack!} irState={irState()} />
          </Match>
          <Match when={currentMode() === 'timeline' || !resolved().selectedSeq}>
            <ProjectInspector irState={irState()} />
          </Match>
          <Match when={currentMode() === 'sequence' && Boolean(resolved().selectedSeq)}>
            <SequenceInspector
              selectedSeq={resolved().selectedSeq!}
              selectedTrack={resolved().effectiveTrack}
              irState={irState()}
              fps={fps()}
              isLocked={isSequenceLocked()}
              onToggleLock={() => setIsSequenceLocked((prev) => !prev)}
              openSections={openSections()}
              onOpenSectionsChange={setOpenSections}
              onAddEffectClick={() => setIsAddPickerOpen(true)}
              searchQuery={searchQuery()}
              isBypassAll={isBypassAllActive()}
            />
          </Match>
        </Switch>
      </div>
    </aside>
  );
}
