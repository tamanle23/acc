import React from 'react';
import {
  Plus,
  GripVertical,
  Video,
  Music,
  Image as ImageIcon,
  FileBox,
  Play,
} from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { ProceduralAudioSynthesizer, ProceduralSFXModifierPlugin } from '@acc/ir';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import type { StagingPreset } from '../../lib/library/stagingPresets';
import type { StudioAssetRecord } from '../../lib/ir/studioTypes';
import {
  renderPresetIcon,
  ShapePresetThumbnail,
  TypographyPresetThumbnail,
} from './PresetThumbnails';

export function DraggablePresetCard({
  preset,
  onInsert,
}: {
  preset: StagingPreset;
  onInsert: (preset: StagingPreset) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `preset-${preset.id}`,
    data: {
      type: 'preset',
      preset,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-xl glass-card transition-all duration-200 select-none cursor-grab active:cursor-grabbing group hover:-translate-y-0.5 hover:border-accent-theme/40 hover:shadow-accent-glow/15 ${
        isDragging
          ? 'opacity-40 border-accent-theme scale-[0.98]'
          : 'hover:border-accent-theme/40'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-muted/60 group-hover:bg-accent-theme/20 group-hover:scale-110 transition-all duration-200">
            {renderPresetIcon(preset.iconName)}
          </div>
          <span className="font-semibold text-foreground/90 text-xs">{preset.name}</span>
        </div>
        <Badge variant="outline" className="text-[9px] font-mono border-border/40">
          {preset.badge}
        </Badge>
      </div>

      {preset.thumbnailUrl && (
        <div className="relative w-full h-24 mb-2 rounded-lg overflow-hidden border border-border/40 pointer-events-none group-hover:border-cyan-400/50 transition-colors">
          <img
            src={preset.thumbnailUrl}
            alt={preset.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-1.5">
            <span className="text-[9px] font-mono font-semibold text-white/90 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">
              {preset.durationSec ? `${preset.durationSec.toFixed(1)}s` : 'HD Plate'}
            </span>
          </div>
        </div>
      )}

      {preset.category === 'shape' && !preset.thumbnailUrl && (
        <ShapePresetThumbnail preset={preset} />
      )}

      {preset.category === 'text' && !preset.thumbnailUrl && (
        <TypographyPresetThumbnail preset={preset} />
      )}

      {preset.category === 'audio' && (
        <div className="flex items-center justify-between p-2 mb-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-400 font-semibold">
              {preset.bpm ? `${preset.bpm} BPM` : 'BGM Master'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {preset.durationSec ? `${preset.durationSec.toFixed(0)}s` : 'Score'}
          </span>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-tight mb-2.5 pointer-events-none line-clamp-2">
        {preset.description}
      </p>

      <div className="flex items-center justify-between pt-1 border-t border-[var(--glass-border)] text-[10px]">
        {preset.category === 'sfx' || preset.category === 'audio' ? (
          <Button
            size="sm"
            variant="ghost"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              try {
                const win = window as Window & { webkitAudioContext?: typeof AudioContext };
                const AudioCtx = window.AudioContext || win.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                let buf: Float32Array;
                if (preset.category === 'sfx') {
                  const seq = preset.createSequence({ startFrame: 0 });
                  const sfxMod = seq.modifiers?.find((m) => m.type === 'sfx/procedural');
                  const plugin = new ProceduralSFXModifierPlugin();
                  buf = plugin.generateAudioBuffer(sfxMod?.params || {}, 44100);
                } else if (preset.category === 'audio') {
                  buf = ProceduralAudioSynthesizer.synthBGM(0, 3.0);
                } else {
                  buf = ProceduralAudioSynthesizer.synthWhoosh(0, 0.6);
                }
                const audioBuf = ctx.createBuffer(1, buf.length, 44100);
                audioBuf.copyToChannel(buf as unknown as Float32Array<ArrayBuffer>, 0);
                const source = ctx.createBufferSource();
                source.buffer = audioBuf;
                source.connect(ctx.destination);
                source.onended = () => {
                  ctx.close().catch(() => {});
                };
                source.start();
                setTimeout(() => {
                  if (ctx.state !== 'closed') {
                    ctx.close().catch(() => {});
                  }
                }, 3500);
              } catch (err) {
                console.warn('Audition error:', err);
              }
            }}
            className="h-5 px-2 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 rounded-full gap-1 cursor-pointer transition-all active:scale-95"
          >
            <Play className="w-2.5 h-2.5 fill-current" />
            Audition
          </Button>
        ) : (
          <span className="text-muted-foreground font-mono flex items-center gap-1 pointer-events-none">
            <GripVertical className="w-3 h-3 text-muted-foreground/60" />
            Drag to stage
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onInsert(preset);
          }}
          className="h-5 px-2 text-[10px] font-medium text-accent-theme hover:bg-accent-theme/20 rounded-full gap-1 cursor-pointer transition-all active:scale-95"
        >
          <Plus className="w-3 h-3" />
          Insert
        </Button>
      </div>
    </div>
  );
}

export function DraggableAssetCard({
  assetId,
  asset,
  onInsert,
}: {
  assetId: string;
  asset: StudioAssetRecord;
  onInsert?: (asset: StudioAssetRecord) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asset-${assetId}`,
    data: {
      type: 'asset',
      assetId,
      asset,
    },
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-3.5 h-3.5 text-blue-500" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-rose-500" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <FileBox className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-2.5 rounded-lg glass-card transition-all select-none cursor-grab active:cursor-grabbing group ${
        isDragging
          ? 'opacity-40 border-accent-theme scale-[0.98]'
          : 'hover:border-accent-theme/60'
      }`}
    >
      <div className="flex items-center justify-between mb-1 pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded bg-muted group-hover:bg-accent-theme/20 transition-colors">
            {getAssetIcon(asset.type)}
          </div>
          <span className="font-medium text-foreground truncate text-xs font-mono">
            {assetId}
          </span>
        </div>
        <Badge variant="outline" className="text-[9px] uppercase font-mono border-border/40">
          {asset.type}
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground truncate font-mono pointer-events-none">
        {asset.src}
      </p>
      <div className="flex items-center justify-between pt-1 mt-1 border-t border-border/40 text-[10px] text-muted-foreground font-mono">
        <span className="flex items-center gap-1 pointer-events-none">
          <GripVertical className="w-3 h-3 text-muted-foreground/60" />
          Drag to timeline
        </span>
        <div className="flex items-center gap-1.5">
          {asset.durationSec && <span>{asset.durationSec.toFixed(1)}s</span>}
          {onInsert && (
            <Button
              size="sm"
              variant="ghost"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onInsert(asset);
              }}
              className="h-5 px-1.5 text-[10px] font-medium text-primary hover:bg-primary/20 rounded cursor-pointer gap-0.5"
              title="Insert into timeline"
            >
              <Plus className="w-2.5 h-2.5" />
              Insert
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function DragOverlayPreview({ item }: { item: Record<string, unknown> | null | undefined }) {
  if (!item) return null;

  if (item.type === 'preset' && item.preset) {
    const p = item.preset as StagingPreset;
    return (
      <div className="p-3 border-2 border-accent-theme bg-popover/95 text-popover-foreground rounded-lg shadow-xl w-64 pointer-events-none backdrop-blur-md">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {renderPresetIcon(p.iconName)}
            <span className="font-semibold text-foreground text-xs">{p.name}</span>
          </div>
          <Badge className="text-[9px] bg-accent-theme text-primary-foreground font-mono">
            {p.badge}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground line-clamp-1">{p.description}</p>
      </div>
    );
  }

  if (item.type === 'asset' && item.asset) {
    const asset = item.asset as StudioAssetRecord;
    const assetId = String(item.assetId || asset.id || '');
    return (
      <div className="p-2.5 border-2 border-accent-theme bg-popover/95 text-popover-foreground rounded-lg shadow-xl w-60 pointer-events-none backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold text-foreground truncate">
            {assetId}
          </span>
          <Badge className="text-[9px] uppercase font-mono bg-accent-theme text-primary-foreground">
            {asset.type}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">{asset.src}</p>
      </div>
    );
  }

  return null;
}
