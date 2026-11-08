import { Show } from 'solid-js';
import {
  Plus,
  GripVertical,
  Video,
  Music,
  Image as ImageIcon,
  FileBox,
  Play,
} from 'lucide-solid';
import { useDraggable } from '@dnd-kit/solid';
import { ProceduralAudioSynthesizer, ProceduralSFXModifierPlugin } from '@acc/ir';
import { WebAudioEngine } from '../../lib/audio/WebAudioEngine';
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

export function DraggablePresetCard(props: {
  preset: StagingPreset;
  onInsert: (preset: StagingPreset) => void;
}) {
  const draggable = useDraggable({
    id: `preset-${props.preset.id}`,
    data: {
      type: 'preset',
      preset: props.preset,
    },
  });

  return (
    <div
      ref={(el) => {
        if (el) draggable.ref(el);
      }}
      class={`p-3 rounded-xl glass-card transition-all duration-200 select-none cursor-grab active:cursor-grabbing group hover:-translate-y-0.5 hover:border-accent-theme/40 hover:shadow-accent-glow/15 ${
        draggable.isDragging()
          ? 'opacity-40 border-accent-theme scale-[0.98]'
          : 'hover:border-accent-theme/40'
      }`}
    >
      <div class="flex items-center justify-between mb-1.5 pointer-events-none">
        <div class="flex items-center gap-2">
          <div class="p-1 rounded-lg bg-muted/60 group-hover:bg-accent-theme/20 group-hover:scale-110 transition-all duration-200">
            {renderPresetIcon(props.preset.iconName)}
          </div>
          <span class="font-semibold text-foreground/90 text-xs">{props.preset.name}</span>
        </div>
        <Badge variant="outline" class="text-[9px] font-mono border-border/40">
          {props.preset.badge}
        </Badge>
      </div>

      <Show when={props.preset.thumbnailUrl}>
        <div class="relative w-full h-24 mb-2 rounded-lg overflow-hidden border border-border/40 pointer-events-none group-hover:border-cyan-400/50 transition-colors">
          <img
            src={props.preset.thumbnailUrl}
            alt={props.preset.name}
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-1.5">
            <span class="text-[9px] font-mono font-semibold text-white/90 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">
              {props.preset.durationSec ? `${props.preset.durationSec.toFixed(1)}s` : 'HD Plate'}
            </span>
          </div>
        </div>
      </Show>

      <Show when={props.preset.category === 'shape' && !props.preset.thumbnailUrl}>
        <ShapePresetThumbnail preset={props.preset} />
      </Show>

      <Show when={props.preset.category === 'text' && !props.preset.thumbnailUrl}>
        <TypographyPresetThumbnail preset={props.preset} />
      </Show>

      <Show when={props.preset.category === 'audio'}>
        <div class="flex items-center justify-between p-2 mb-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span class="text-[10px] font-mono text-emerald-400 font-semibold">
              {props.preset.bpm ? `${props.preset.bpm} BPM` : 'BGM Master'}
            </span>
          </div>
          <span class="text-[10px] font-mono text-muted-foreground">
            {props.preset.durationSec ? `${props.preset.durationSec.toFixed(0)}s` : 'Score'}
          </span>
        </div>
      </Show>

      <p class="text-[11px] text-muted-foreground leading-tight mb-2.5 pointer-events-none line-clamp-2">
        {props.preset.description}
      </p>

      <div class="flex items-center justify-between pt-1 border-t border-[var(--glass-border)] text-[10px]">
        <Show
          when={props.preset.category === 'sfx' || props.preset.category === 'audio'}
          fallback={
            <span class="text-muted-foreground font-mono flex items-center gap-1 pointer-events-none">
              <GripVertical class="w-3 h-3 text-muted-foreground/60" />
              Drag to stage
            </span>
          }
        >
          <Button
            size="sm"
            variant="ghost"
            onPointerDown={(e: Event) => e.stopPropagation()}
            onClick={(e: Event) => {
              e.stopPropagation();
              try {
                let buf: Float32Array;
                if (props.preset.category === 'sfx') {
                  const seq = props.preset.createSequence({ startFrame: 0 });
                  const sfxMod = seq.modifiers?.find((m) => m.type === 'sfx/procedural');
                  const plugin = new ProceduralSFXModifierPlugin();
                  buf = plugin.generateAudioBuffer(sfxMod?.params || {}, 44100);
                } else if (props.preset.category === 'audio') {
                  buf = ProceduralAudioSynthesizer.synthBGM(0, 3.0);
                } else {
                  buf = ProceduralAudioSynthesizer.synthWhoosh(0, 0.6);
                }
                WebAudioEngine.getInstance().playAuditionBuffer(buf, 44100);
              } catch (err) {
                console.warn('Audition error:', err);
              }
            }}
            class="h-5 px-2 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 rounded-full gap-1 cursor-pointer transition-all active:scale-95"
          >
            <Play class="w-2.5 h-2.5 fill-current" />
            Audition
          </Button>
        </Show>
        <Button
          size="sm"
          variant="ghost"
          onPointerDown={(e: Event) => e.stopPropagation()}
          onClick={(e: Event) => {
            e.stopPropagation();
            props.onInsert(props.preset);
          }}
          class="h-5 px-2 text-[10px] font-medium text-accent-theme hover:bg-accent-theme/20 rounded-full gap-1 cursor-pointer transition-all active:scale-95"
        >
          <Plus class="w-3 h-3" />
          Insert
        </Button>
      </div>
    </div>
  );
}

export function DraggableAssetCard(props: {
  assetId: string;
  asset: StudioAssetRecord;
  onInsert?: (asset: StudioAssetRecord) => void;
}) {
  const draggable = useDraggable({
    id: `asset-${props.assetId}`,
    data: {
      type: 'asset',
      assetId: props.assetId,
      asset: props.asset,
    },
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video class="w-3.5 h-3.5 text-blue-500" />;
      case 'audio':
        return <Music class="w-3.5 h-3.5 text-rose-500" />;
      case 'image':
        return <ImageIcon class="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <FileBox class="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Card
      ref={(el) => {
        if (el) draggable.ref(el);
      }}
      class={`p-2.5 rounded-lg glass-card transition-all select-none cursor-grab active:cursor-grabbing group ${
        draggable.isDragging()
          ? 'opacity-40 border-accent-theme scale-[0.98]'
          : 'hover:border-accent-theme/60'
      }`}
    >
      <div class="flex items-center justify-between mb-1 pointer-events-none">
        <div class="flex items-center gap-1.5 min-w-0">
          <div class="p-1 rounded bg-muted group-hover:bg-accent-theme/20 transition-colors">
            {getAssetIcon(props.asset.type)}
          </div>
          <span class="font-medium text-foreground truncate text-xs font-mono">
            {props.assetId}
          </span>
        </div>
        <Badge variant="outline" class="text-[9px] uppercase font-mono border-border/40">
          {props.asset.type}
        </Badge>
      </div>
      <p class="text-[10px] text-muted-foreground truncate font-mono pointer-events-none">
        {props.asset.src}
      </p>
      <div class="flex items-center justify-between pt-1 mt-1 border-t border-border/40 text-[10px] text-muted-foreground font-mono">
        <span class="flex items-center gap-1 pointer-events-none">
          <GripVertical class="w-3 h-3 text-muted-foreground/60" />
          Drag to timeline
        </span>
        <div class="flex items-center gap-1.5">
          <Show when={props.asset.durationSec}>
            <span>{props.asset.durationSec!.toFixed(1)}s</span>
          </Show>
          <Show when={props.onInsert}>
            <Button
              size="sm"
              variant="ghost"
              onPointerDown={(e: Event) => e.stopPropagation()}
              onClick={(e: Event) => {
                e.stopPropagation();
                props.onInsert!(props.asset);
              }}
              class="h-5 px-1.5 text-[10px] font-medium text-primary hover:bg-primary/20 rounded cursor-pointer gap-0.5"
              title="Insert into timeline"
            >
              <Plus class="w-2.5 h-2.5" />
              Insert
            </Button>
          </Show>
        </div>
      </div>
    </Card>
  );
}

export function DragOverlayPreview(props: { item: Record<string, unknown> | null | undefined }) {
  return (
    <Show when={props.item}>
      <Show when={props.item?.type === 'preset' && props.item?.preset}>
        {(() => {
          const p = props.item!.preset as StagingPreset;
          return (
            <div class="p-3 border-2 border-accent-theme bg-popover/95 text-popover-foreground rounded-lg shadow-xl w-64 pointer-events-none backdrop-blur-md">
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                  {renderPresetIcon(p.iconName)}
                  <span class="font-semibold text-foreground text-xs">{p.name}</span>
                </div>
                <Badge class="text-[9px] bg-accent-theme text-primary-foreground font-mono">
                  {p.badge}
                </Badge>
              </div>
              <p class="text-[10px] text-muted-foreground line-clamp-1">{p.description}</p>
            </div>
          );
        })()}
      </Show>

      <Show when={props.item?.type === 'asset' && props.item?.asset}>
        {(() => {
          const asset = props.item!.asset as StudioAssetRecord;
          const assetId = String(props.item!.assetId || asset.id || '');
          return (
            <div class="p-2.5 border-2 border-accent-theme bg-popover/95 text-popover-foreground rounded-lg shadow-xl w-60 pointer-events-none backdrop-blur-md">
              <div class="flex items-center justify-between">
                <span class="font-mono text-xs font-semibold text-foreground truncate">
                  {assetId}
                </span>
                <Badge class="text-[9px] uppercase font-mono bg-accent-theme text-primary-foreground">
                  {asset.type}
                </Badge>
              </div>
              <p class="text-[10px] text-muted-foreground truncate font-mono mt-0.5">{asset.src}</p>
            </div>
          );
        })()}
      </Show>
    </Show>
  );
}
