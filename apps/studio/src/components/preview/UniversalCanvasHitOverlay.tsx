import React, { useState } from 'react';
import type { ResolvedSequence } from '@acc/ir';
import { CanvasHitTester, type SequenceHitRegion } from '../../lib/hit-test/CanvasHitTester';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioTrack } from '../../lib/ir/studioTypes';
import { Type, Sparkles, Box, Film, Image } from 'lucide-react';

export interface UniversalCanvasHitOverlayProps {
  activeSequences: ResolvedSequence[];
  selectedSeqId: string | null;
  tracks?: StudioTrack[];
  onStartEditingCue?: (cue: { sequenceId: string; cueIndex: number; text: string }) => void;
}

export const UniversalCanvasHitOverlay: React.FC<UniversalCanvasHitOverlayProps> = ({
  activeSequences,
  selectedSeqId,
  tracks = [],
  onStartEditingCue,
}) => {
  const [hoveredSeqId, setHoveredSeqId] = useState<string | null>(null);

  if (!activeSequences || activeSequences.length === 0) return null;

  const hitRegions = CanvasHitTester.computeHitRegions(activeSequences, tracks);

  const getArchetypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="w-3 h-3 text-violet-400" />;
      case 'shape':
        return <Box className="w-3 h-3 text-cyan-400" />;
      case 'image':
        return <Image className="w-3 h-3 text-blue-400" />;
      case 'overlay':
        return <Sparkles className="w-3 h-3 text-amber-400" />;
      default:
        return <Film className="w-3 h-3 text-indigo-400" />;
    }
  };

  return (
    <>
      {hitRegions.map((region) => {
        const isSelected = selectedSeqId === region.sequenceId;
        const isHovered = hoveredSeqId === region.sequenceId;

        // Skip rendering hit bounds for selected sequence (TransformGizmo handles it)
        if (isSelected) return null;

        const leftPercent = (region.normX - region.normWidth / 2) * 100;
        const topPercent = (region.normY - region.normHeight / 2) * 100;
        const widthPercent = region.normWidth * 100;
        const heightPercent = region.normHeight * 100;

        return (
          <div
            key={region.sequenceId}
            onMouseEnter={() => setHoveredSeqId(region.sequenceId)}
            onMouseLeave={() => setHoveredSeqId(null)}
            onClick={(e) => {
              e.stopPropagation();
              IRStateManager.getInstance().setSelectedSequenceId(region.sequenceId);
              IRStateManager.getInstance().setInspectorMode('sequence');
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              const seq = activeSequences.find((s) => s.id === region.sequenceId);
              if (seq && (seq.cues?.length || seq.type === 'text') && onStartEditingCue) {
                onStartEditingCue({
                  sequenceId: seq.id,
                  cueIndex: 0,
                  text: seq.cues?.[0]?.text || seq.name || '',
                });
              }
            }}
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              width: `${widthPercent}%`,
              height: `${heightPercent}%`,
              zIndex: region.zIndex,
            }}
            className={`absolute pointer-events-auto cursor-pointer rounded-md transition-all duration-150 flex items-start justify-end p-1 select-none ${
              isHovered
                ? 'border-2 border-dashed border-accent-theme/80 bg-accent-theme/10 shadow-accent-glow'
                : 'border border-transparent hover:border-accent-theme/40'
            }`}
          >
            {isHovered && (
              <div className="glass-pill text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5 shadow-md text-foreground -mt-5 mr-1 animate-in fade-in zoom-in-95">
                {getArchetypeIcon(region.sequenceType)}
                <span className="truncate max-w-[140px] font-medium">{region.label}</span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};
