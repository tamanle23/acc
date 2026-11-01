import React, { useState, useMemo } from 'react';
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

function RightSidebarInner() {
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
  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBypassAllActive, setIsBypassAllActive] = useState(false);

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

  // Fallback track resolution if no track is explicitly selected but tracks exist
  const effectiveTrack: IRTrack | null =
    selectedTrack || (irState.doc.tracks.length > 0 ? irState.doc.tracks[0] : null);

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

  const relevantModifiers = useMemo(() => {
    return availableModifiers.filter((mod) => {
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
  }, [
    availableModifiers,
    currentMode,
    selectedSeq,
    selectedTrack,
    trackType,
    registry,
    hasStandaloneGenerator,
    existingModifierTypes,
  ]);

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
      {/* 1. Header with Multi-Tier Breadcrumbs & Global Actions */}
      <InspectorHeader
        currentMode={currentMode}
        onModeChange={(mode) => IRStateManager.getInstance().setInspectorMode(mode)}
        projectTitle={irState.doc.meta?.contentId || 'Timeline'}
        effectiveTrack={effectiveTrack}
        selectedSeq={selectedSeq}
        canAddEffect={canAddEffect}
        isAddEffectDisabled={isAddEffectDisabled}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        isBypassAllActive={isBypassAllActive}
        onToggleBypassAll={() => setIsBypassAllActive((prev) => !prev)}
        onOpenAddPicker={() => setIsAddPickerOpen(true)}
      />

      {/* 2. Real-Time Property Search Filter */}
      {isSearchOpen && (
        <PropertySearchFilter
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {/* 3. Main Inspector Content Routing */}
      <div className="flex-1 p-3 overflow-y-auto">
        {currentMode === 'track' && effectiveTrack ? (
          <TrackInspector selectedTrack={effectiveTrack} irState={irState} />
        ) : currentMode === 'timeline' || !selectedSeq ? (
          <ProjectInspector irState={irState} />
        ) : (
          <SequenceInspector
            selectedSeq={selectedSeq}
            selectedTrack={effectiveTrack}
            irState={irState}
            fps={fps}
            isLocked={isSequenceLocked}
            onToggleLock={setIsSequenceLocked}
            openSections={openSections}
            onOpenSectionsChange={setOpenSections}
            onAddEffectClick={() => setIsAddPickerOpen(true)}
            searchQuery={searchQuery}
            isBypassAll={isBypassAllActive}
          />
        )}
      </div>

      {/* 4. Searchable Modifier Command Palette Popover */}
      <ModifierAddPicker
        open={isAddPickerOpen}
        onOpenChange={setIsAddPickerOpen}
        relevantModifiers={relevantModifiers}
        activeEntityModifiers={activeEntityModifiers}
        isDisabled={isAddEffectDisabled}
        onSelectModifier={handleAddEffect}
      />
    </aside>
  );
}

export const RightSidebar = React.memo(RightSidebarInner);
