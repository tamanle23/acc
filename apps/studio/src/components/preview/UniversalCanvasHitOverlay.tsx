import { createSignal, For, Show } from 'solid-js';
import type { ResolvedSequence } from '@acc/ir';
import { CanvasHitTester } from '../../lib/hit-test/CanvasHitTester';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioTrack } from '../../lib/ir/studioTypes';
import { Type, Sparkles, Box, Film, Image as ImageIcon } from 'lucide-solid';

export interface UniversalCanvasHitOverlayProps {
  activeSequences: ResolvedSequence[];
  selectedSeqId: string | null;
  tracks?: StudioTrack[];
  onStartEditingCue?: (cue: { sequenceId: string; cueIndex: number; text: string }) => void;
}

export function UniversalCanvasHitOverlay(props: UniversalCanvasHitOverlayProps) {
  const [hoveredSeqId, setHoveredSeqId] = createSignal<string | null>(null);

  const getArchetypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type class="w-3 h-3 text-violet-400" />;
      case 'shape':
        return <Box class="w-3 h-3 text-cyan-400" />;
      case 'image':
        return <ImageIcon class="w-3 h-3 text-blue-400" />;
      case 'overlay':
        return <Sparkles class="w-3 h-3 text-amber-400" />;
      default:
        return <Film class="w-3 h-3 text-indigo-400" />;
    }
  };

  const hitRegions = () =>
    CanvasHitTester.computeHitRegions(props.activeSequences || [], props.tracks || []);

  return (
    <Show when={props.activeSequences && props.activeSequences.length > 0}>
      <For each={hitRegions()}>
        {(region) => {
          const isSelected = () => props.selectedSeqId === region.sequenceId;
          const isHovered = () => hoveredSeqId() === region.sequenceId;

          const leftPercent = () => (region.normX - region.normWidth / 2) * 100;
          const topPercent = () => (region.normY - region.normHeight / 2) * 100;
          const widthPercent = () => region.normWidth * 100;
          const heightPercent = () => region.normHeight * 100;

          return (
            <Show when={!isSelected()}>
              <div
                onMouseEnter={() => setHoveredSeqId(region.sequenceId)}
                onMouseLeave={() => setHoveredSeqId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  IRStateManager.getInstance().setSelectedSequenceId(region.sequenceId);
                  IRStateManager.getInstance().setInspectorMode('sequence');
                }}
                onDblClick={(e) => {
                  e.stopPropagation();
                  const seq = props.activeSequences.find((s) => s.id === region.sequenceId);
                  const textMod = seq?.modifiers?.find(
                    (m) => m.type === 'text/draw' || m.type === 'text/overlay'
                  );
                  if (textMod && props.onStartEditingCue && seq) {
                    props.onStartEditingCue({
                      sequenceId: seq.id,
                      cueIndex: 0,
                      text: (textMod.params as any)?.text ?? seq.name ?? '',
                    });
                  } else if (seq && (seq.cues?.length || seq.type === 'text') && props.onStartEditingCue) {
                    props.onStartEditingCue({
                      sequenceId: seq.id,
                      cueIndex: 0,
                      text: seq.cues?.[0]?.text || seq.name || '',
                    });
                  }
                }}
                style={{
                  left: `${leftPercent()}%`,
                  top: `${topPercent()}%`,
                  width: `${widthPercent()}%`,
                  height: `${heightPercent()}%`,
                  "z-index": region.zIndex,
                }}
                class={`absolute pointer-events-auto cursor-pointer rounded-md transition-all duration-150 flex items-start justify-end p-1 select-none ${
                  isHovered()
                    ? 'border-2 border-dashed border-accent-theme/80 bg-accent-theme/10 shadow-accent-glow'
                    : 'border border-transparent hover:border-accent-theme/40'
                }`}
              >
                <Show when={isHovered()}>
                  <div class="glass-pill text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5 shadow-md text-foreground -mt-5 mr-1 animate-in fade-in zoom-in-95">
                    {getArchetypeIcon(region.sequenceType)}
                    <span class="truncate max-w-[140px] font-medium">{region.label}</span>
                  </div>
                </Show>
              </div>
            </Show>
          );
        }}
      </For>
    </Show>
  );
}
