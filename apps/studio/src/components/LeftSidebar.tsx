import React, { useState, useEffect } from 'react';
import {
  Library,
  Folder,
  Search,
  Plus,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Type,
  Square,
  Circle,
  ArrowUpRight,
  Eye,
  Sun,
  Zap,
  Sparkles,
  Video,
  Music,
  Volume2,
  Image as ImageIcon,
  FileBox,
  Film,
  Radio,
  Play,
  VolumeX,
  UploadCloud,
} from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { STAGING_PRESETS, type StagingPreset, type PresetCategory } from '../lib/library/stagingPresets';
import { SFX_SOUND_BANKS } from '../lib/library/sfxBank';
import { IRStateManager } from '../lib/ir/irState';
import { useIRState } from '../lib/ir/useStudioStore';
import type { StudioAssetRecord } from '../lib/ir/studioTypes';
import { ProceduralAudioSynthesizer, ProceduralSFXModifierPlugin } from '@acc/ir';

export type LeftNavTab =
  | 'library'
  | 'vault'
  | 'typography'
  | 'shapes'
  | 'vfx'
  | 'sfx'
  | 'video'
  | 'audio'
  | 'all';

export interface LeftSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeNav: LeftNavTab;
  setActiveNav: (nav: LeftNavTab) => void;
  onInsertPreset?: (preset: StagingPreset) => void;
}

export function renderPresetIcon(iconName: string) {
  switch (iconName) {
    case 'Type':
      return <Type className="w-3.5 h-3.5 text-accent-theme" />;
    case 'Square':
      return <Square className="w-3.5 h-3.5 text-accent-theme" />;
    case 'Circle':
      return <Circle className="w-3.5 h-3.5 text-accent-theme" />;
    case 'ArrowUpRight':
      return <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />;
    case 'Eye':
      return <Eye className="w-3.5 h-3.5 text-sky-400" />;
    case 'Sun':
      return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    case 'Zap':
      return <Zap className="w-3.5 h-3.5 text-amber-400" />;
    case 'Volume2':
      return <Volume2 className="w-3.5 h-3.5 text-rose-400" />;
    case 'Music':
      return <Music className="w-3.5 h-3.5 text-emerald-400" />;
    case 'Video':
      return <Video className="w-3.5 h-3.5 text-blue-500" />;
    case 'Film':
      return <Film className="w-3.5 h-3.5 text-accent-theme" />;
    case 'Radio':
      return <Radio className="w-3.5 h-3.5 text-amber-500" />;
    case 'Play':
      return <Play className="w-3.5 h-3.5 text-accent-theme" />;
    case 'Sparkles':
    default:
      return <Sparkles className="w-3.5 h-3.5 text-accent-theme" />;
  }
}

export function ShapePresetThumbnail({ preset }: { preset: StagingPreset }) {
  // Extract shape parameters from preset sequence
  const seq = React.useMemo(() => preset.createSequence({ startFrame: 0 }), [preset]);
  const shapeMod = seq.modifiers?.find((m) => m.type === 'shape/draw' || m.type === 'shape/vector');
  const params: any = shapeMod?.params || {};
  const geom: string = params.geometry || params.shapeType || 'rect';

  const strokeColor = params.strokeColor || '#818cf8';
  const fillColor = params.fillColor || (params.gradient ? undefined : 'rgba(99, 102, 241, 0.2)');
  const strokeWidth = params.strokeWidth ? Math.min(Math.max(params.strokeWidth, 1.5), 3) : 2;
  const strokeDasharray = params.strokeDash ? params.strokeDash.join(' ') : params.isDashed ? '4 3' : undefined;

  // Unique gradient id if linear or radial gradient exists
  const gradientId = `grad-${preset.id}`;
  const gradient = params.gradient;

  const renderVector = () => {
    switch (geom) {
      case 'circle':
        return (
          <circle
            cx="100"
            cy="40"
            r="28"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );

      case 'pill':
        return (
          <rect
            x="35"
            y="22"
            width="130"
            height="36"
            rx="18"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );

      case 'rounded_rect':
      case 'rounded_box':
        return (
          <rect
            x="30"
            y="12"
            width="140"
            height="56"
            rx={Math.min(params.cornerRadius ?? params.radius ?? 8, 16)}
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );

      case 'triangle':
        return (
          <polygon
            points="100,14 145,66 55,66"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );

      case 'star': {
        const points = params.points ?? 5;
        const outerR = 26;
        const innerR = outerR * (params.innerRadiusRatio ?? 0.45);
        const pts: string[] = [];
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI) / points - Math.PI / 2;
          pts.push(`${(100 + r * Math.cos(angle)).toFixed(1)},${(40 + r * Math.sin(angle)).toFixed(1)}`);
        }
        return (
          <polygon
            points={pts.join(' ')}
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      }

      case 'hexagon': {
        const r = 28;
        const pts: string[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6;
          pts.push(`${(100 + r * Math.cos(angle)).toFixed(1)},${(40 + r * Math.sin(angle)).toFixed(1)}`);
        }
        return (
          <polygon
            points={pts.join(' ')}
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      }

      case 'cross':
        return (
          <path
            d="M93,16 L107,16 L107,33 L124,33 L124,47 L107,47 L107,64 L93,64 L93,47 L76,47 L76,33 L93,33 Z"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );

      case 'frame':
        return (
          <rect
            x="25"
            y="12"
            width="150"
            height="56"
            rx="6"
            fill="none"
            stroke={strokeColor}
            strokeWidth={Math.max(strokeWidth, 3)}
          />
        );

      case 'arrow':
        return (
          <path
            d="M80,55 L115,25 M115,25 L115,45 M115,25 L95,25"
            fill="none"
            stroke={strokeColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'rect':
      default:
        return (
          <rect
            x="30"
            y="14"
            width="140"
            height="52"
            rx="4"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );
    }
  };

  return (
    <div className="relative w-full h-20 mb-2 rounded-lg overflow-hidden border border-border/40 bg-card/60 pointer-events-none group-hover:border-accent-theme/50 group-hover:bg-card/80 transition-all flex items-center justify-center">
      <div
        className="absolute inset-0 opacity-20 bg-[radial-gradient(var(--accent-primary)_1px,transparent_1px)] [background-size:12px_12px]"
      />
      <svg viewBox="0 0 200 80" className="w-full h-full relative z-10 drop-shadow-sm">
        {gradient && (
          <defs>
            {gradient.type === 'radial' ? (
              <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                {gradient.colors.map((c: string, idx: number) => (
                  <stop key={idx} offset={`${(idx / (gradient.colors.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </radialGradient>
            ) : (
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                {gradient.colors.map((c: string, idx: number) => (
                  <stop key={idx} offset={`${(idx / (gradient.colors.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </linearGradient>
            )}
          </defs>
        )}
        {renderVector()}
      </svg>
      <div className="absolute bottom-1 right-1.5 z-20">
        <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/80 bg-background/70 px-1 rounded border border-border/30">
          {geom.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
}

export function TypographyPresetThumbnail({ preset }: { preset: StagingPreset }) {
  const seq = React.useMemo(() => preset.createSequence({ startFrame: 0 }), [preset]);
  const textMod = seq.modifiers?.find((m) => m.type === 'text/style');
  const params: any = textMod?.params || {};

  const cueText = seq.cues?.[0]?.text || preset.name;
  const fontFamily = params.fontFamily || 'Inter, system-ui, sans-serif';
  const fontWeight = params.fontWeight || 700;
  const textColor = params.textColor || '#ffffff';
  const strokeColor = params.strokeColor;
  const strokeWidth = params.strokeWidth;
  const glowColor = params.glowColor;
  const glowBlur = params.glowBlur ?? 8;
  const letterSpacing = params.letterSpacing ? `${params.letterSpacing}px` : 'normal';

  // Build clean text shadow style combining drop shadow and glow
  const textShadowParts: string[] = [];
  if (glowColor) {
    textShadowParts.push(`0 0 ${glowBlur}px ${glowColor}`);
    textShadowParts.push(`0 0 ${glowBlur * 2}px ${glowColor}`);
  }
  if (params.shadowColor) {
    textShadowParts.push(`0 2px ${params.shadowBlur ?? 4}px ${params.shadowColor}`);
  }
  const textShadow = textShadowParts.length > 0 ? textShadowParts.join(', ') : '0 2px 8px rgba(0,0,0,0.5)';

  const webkitTextStroke = strokeColor && strokeWidth ? `${strokeWidth}px ${strokeColor}` : undefined;

  return (
    <div className="relative w-full h-20 mb-2 rounded-lg overflow-hidden border border-border/40 bg-card/60 pointer-events-none group-hover:border-accent-theme/50 group-hover:bg-card/80 transition-all flex items-center justify-center p-2">
      {/* Background typographic grid texture */}
      <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,var(--accent-primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--accent-primary)_1px,transparent_1px)] bg-[size:16px_16px]" />

      {/* Centered stylized typographic specimen */}
      <div className="relative z-10 text-center px-2 w-full flex flex-col items-center justify-center overflow-hidden">
        <span
          className="truncate max-w-full leading-tight select-none font-bold"
          style={{
            fontFamily,
            fontWeight,
            color: textColor,
            textShadow,
            WebkitTextStroke: webkitTextStroke,
            letterSpacing,
            fontSize: '15px',
          }}
        >
          {cueText}
        </span>
      </div>

      {/* Font Family Metadata Tag */}
      <div className="absolute bottom-1 right-1.5 z-20">
        <span className="text-[8px] font-mono text-muted-foreground/80 bg-background/80 px-1 rounded border border-border/30">
          {fontFamily.split(',')[0].replace(/['"]/g, '')}
        </span>
      </div>
    </div>
  );
}

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
      className={`p-3 rounded-xl glass-card transition-all duration-200 select-none cursor-grab active:cursor-grabbing group hover:-translate-y-0.5 hover:border-accent-theme/40 hover:shadow-accent-glow/15 ${isDragging
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
        {(preset.category === 'sfx' || preset.category === 'audio') ? (
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
                source.start();
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
}: {
  assetId: string;
  asset: StudioAssetRecord;
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
      className={`p-2.5 rounded-lg glass-card transition-all select-none cursor-grab active:cursor-grabbing group ${isDragging
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
      <p className="text-[10px] text-muted-foreground truncate font-mono pointer-events-none">{asset.src}</p>
      <div className="flex items-center justify-between pt-1 mt-1 border-t border-border/40 text-[10px] text-muted-foreground font-mono pointer-events-none">
        <span className="flex items-center gap-1">
          <GripVertical className="w-3 h-3 text-muted-foreground/60" />
          Drag into canvas
        </span>
        {asset.durationSec && <span>{asset.durationSec.toFixed(1)}s</span>}
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
          <Badge className="text-[9px] bg-accent-theme text-primary-foreground font-mono">{p.badge}</Badge>
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
          <span className="font-mono text-xs font-semibold text-foreground truncate">{assetId}</span>
          <Badge className="text-[9px] uppercase font-mono bg-accent-theme text-primary-foreground">{asset.type}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">{asset.src}</p>
      </div>
    );
  }

  return null;
}

export function LeftSidebar({
  isOpen,
  onToggle,
  activeNav,
  setActiveNav,
  onInsertPreset,
}: LeftSidebarProps) {
  const irState = useIRState();
  const [libraryFilterQuery, setLibraryFilterQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | PresetCategory>('all');
  const [selectedSfxBank, setSelectedSfxBank] = useState<string>('all');
  const [assetFilterQuery, setAssetFilterQuery] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isVaultDragOver, setIsVaultDragOver] = useState(false);
  const presetScrollRef = React.useRef<HTMLDivElement | null>(null);
  const assetScrollRef = React.useRef<HTMLDivElement | null>(null);

  const handleFilesIngest = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const objectUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv)$/i);
      const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|aac|m4a)$/i);
      const isImage = file.type.startsWith('image/') || file.name.match(/\.(png|jpg|jpeg|webp|svg)$/i);

      const type = isVideo ? 'video' : isAudio ? 'audio' : isImage ? 'image' : 'video';
      const cleanName = file.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const assetId = `asset_${Date.now()}_${cleanName.slice(0, 16)}`;

      IRStateManager.getInstance().addAsset(assetId, {
        id: assetId,
        type,
        src: objectUrl,
        name: file.name,
        size: file.size,
      });
    }
  };

  const handleInsert = (preset: StagingPreset) => {
    if (onInsertPreset) {
      onInsertPreset(preset);
    } else {
      const seq = preset.createSequence({
        startFrame: 0,
        normX: 0.5,
        normY: 0.5,
      });
      IRStateManager.getInstance().addSequence(preset.targetTrackId, seq, {
        trackTypeFallback: preset.targetTrackType,
        trackNameFallback: preset.targetTrackName,
      });
    }
  };

  const effectiveCategory: 'all' | PresetCategory =
    activeNav === 'typography'
      ? 'text'
      : activeNav === 'shapes'
        ? 'shape'
        : activeNav === 'vfx'
          ? 'vfx'
          : activeNav === 'sfx'
            ? 'sfx'
            : activeNav === 'video'
              ? 'video'
              : activeNav === 'audio'
                ? 'audio'
                : activeNav === 'all'
                  ? 'all'
                  : selectedCategory;

  const filteredPresets = STAGING_PRESETS.filter((p) => {
    const matchesCat =
      effectiveCategory === 'all' ||
      p.category === effectiveCategory ||
      (effectiveCategory === 'vfx' && p.category === 'overlay');
    const matchesBank =
      effectiveCategory !== 'sfx' ||
      selectedSfxBank === 'all' ||
      p.id.toLowerCase().includes(`preset_sfx_${selectedSfxBank}`) ||
      p.id.toLowerCase().includes(`sfx_${selectedSfxBank}`);
    const matchesQuery =
      p.name.toLowerCase().includes(libraryFilterQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(libraryFilterQuery.toLowerCase()) ||
      p.badge.toLowerCase().includes(libraryFilterQuery.toLowerCase());
    return matchesCat && matchesBank && matchesQuery;
  });

  const assetList = Object.entries(irState.doc.assets || {}).map(([id, asset]) => ({
    id,
    ...asset,
  }));

  const filteredAssets = assetList.filter((a) => {
    const matchesType = selectedAssetType === 'all' || a.type === selectedAssetType;
    const matchesQuery =
      a.id.toLowerCase().includes(assetFilterQuery.toLowerCase()) ||
      a.src.toLowerCase().includes(assetFilterQuery.toLowerCase());
    return matchesType && matchesQuery;
  });

  const presetVirtualizer = useVirtualizer({
    count: filteredPresets.length,
    getScrollElement: () => presetScrollRef.current,
    estimateSize: (index) => {
      const p = filteredPresets[index];
      if (!p) return 140;
      if (p.thumbnailUrl) return 210;
      if (p.category === 'shape' || p.category === 'text') return 185;
      if (p.category === 'audio' || p.category === 'sfx') return 155;
      return 140;
    },
    overscan: 5,
  });

  const assetVirtualizer = useVirtualizer({
    count: filteredAssets.length,
    getScrollElement: () => assetScrollRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  const getDrawerHeader = () => {
    switch (activeNav) {

      case 'typography':
        return {
          title: 'Typography',
          icon: <Type className="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets.length} styles`,
        };
      case 'shapes':
        return {
          title: 'Shapes',
          icon: <Square className="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets.length} shapes`,
        };
      case 'vfx':
        return {
          title: 'Visual Effects',
          icon: <Sparkles className="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets.length} effects`,
        };
      case 'sfx':
        return {
          title: 'Sound Fx',
          icon: <Volume2 className="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets.length} sounds`,
        };
      case 'video':
        return {
          title: 'Video Footages',
          icon: <Film className="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets.length} plates`,
        };
      case 'audio':
        return {
          title: 'Audio Clips',
          icon: <Music className="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets.length} scores`,
        };
      case 'all':
      case 'library':
        return {
          title: 'Library',
          icon: <Library className="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets.length} items`,
        };
      case 'vault':
      default:
        return {
          title: 'Assets Vault',
          icon: <Folder className="w-4 h-4 text-accent-theme" />,
          count: `${filteredAssets.length} assets`,
        };
    }
  };

  const headerInfo = getDrawerHeader();

  return (
    <div className="flex h-full select-none z-10 shrink-0">
      {/* 1. 48px Enterprise Activity Rail */}
      <aside className="w-12 glass-panel border-r border-border/50 flex flex-col items-center py-3 justify-between shadow-sm z-20">
        <div className="flex flex-col items-center gap-2">
          {/* 1. Assets Vault */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (activeNav === 'vault' && isOpen) {
                onToggle();
              } else {
                setActiveNav('vault');
                if (!isOpen) onToggle();
              }
            }}
            className={`w-9 h-9 rounded-lg transition-colors ${activeNav === 'vault' && isOpen
              ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            title="Assets Vault (Upload & Media) ([)"
          >
            <Folder className="w-4 h-4" />
          </Button>

          <div className="w-5 h-[1px] bg-border/40 my-0.5" />

          {/* 2. Typography Library */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (activeNav === 'typography' && isOpen) {
                onToggle();
              } else {
                setActiveNav('typography');
                setSelectedCategory('text');
                if (!isOpen) onToggle();
              }
            }}
            className={`w-9 h-9 rounded-lg transition-colors ${activeNav === 'typography' && isOpen
              ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            title="Typography Library (16+ Styles)"
          >
            <Type className="w-4 h-4" />
          </Button>

          {/* 3. Designer Shapes */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (activeNav === 'shapes' && isOpen) {
                onToggle();
              } else {
                setActiveNav('shapes');
                setSelectedCategory('shape');
                if (!isOpen) onToggle();
              }
            }}
            className={`w-9 h-9 rounded-lg transition-colors ${activeNav === 'shapes' && isOpen
              ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            title="Designer Shapes (16+ Vector Geometries)"
          >
            <Square className="w-4 h-4" />
          </Button>

          {/* 4. Cinematic VFX Overlays */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (activeNav === 'vfx' && isOpen) {
                onToggle();
              } else {
                setActiveNav('vfx');
                setSelectedCategory('vfx');
                if (!isOpen) onToggle();
              }
            }}
            className={`w-9 h-9 rounded-lg transition-colors ${activeNav === 'vfx' && isOpen
              ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            title="Cinematic VFX Overlays (16+ Atmospheric Layers)"
          >
            <Sparkles className="w-4 h-4" />
          </Button>

          {/* 5. Sound Effects Catalog */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (activeNav === 'sfx' && isOpen) {
                onToggle();
              } else {
                setActiveNav('sfx');
                setSelectedCategory('sfx');
                if (!isOpen) onToggle();
              }
            }}
            className={`w-9 h-9 rounded-lg transition-colors ${activeNav === 'sfx' && isOpen
              ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            title="Sound FX Catalog (104+ Curated SFX)"
          >
            <Volume2 className="w-4 h-4" />
          </Button>

          {/* 6. Production Video Footages */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (activeNav === 'video' && isOpen) {
                onToggle();
              } else {
                setActiveNav('video');
                setSelectedCategory('video');
                if (!isOpen) onToggle();
              }
            }}
            className={`w-9 h-9 rounded-lg transition-colors ${activeNav === 'video' && isOpen
              ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            title="Production Video Footages (Curated 4K/HD Plates)"
          >
            <Film className="w-4 h-4" />
          </Button>

          {/* 7. Audio Clips */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (activeNav === 'audio' && isOpen) {
                onToggle();
              } else {
                setActiveNav('audio');
                setSelectedCategory('audio');
                if (!isOpen) onToggle();
              }
            }}
            className={`w-9 h-9 rounded-lg transition-colors ${activeNav === 'audio' && isOpen
              ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            title="Audio Clips (BGM & Soundtracks)"
          >
            <Music className="w-4 h-4" />
          </Button>


        </div>

        {/* Drawer Collapse Trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title={isOpen ? 'Collapse Left Drawer ([)' : 'Expand Left Drawer ([)'}
        >
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
      </aside>

      {/* 2. 300px Slide-out Drawer */}
      {isOpen && (
        <aside className="w-[300px] glass-panel border-r border-border/50 flex flex-col h-full shadow-xs">
          {/* Drawer Header */}
          <div className="p-3 border-b border-border/40 bg-background/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {headerInfo.icon}
              <h2 className="text-xs font-bold capitalize tracking-wider text-foreground">
                {headerInfo.title}
              </h2>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] border-border/40">
              {headerInfo.count}
            </Badge>
          </div>

          {activeNav !== 'vault' ? (
            /* Library View */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border/30 bg-transparent space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={`Search ${headerInfo.title.toLowerCase()}...`}
                    value={libraryFilterQuery}
                    onChange={(e) => setLibraryFilterQuery(e.target.value)}
                    className="pl-8 h-8 text-xs bg-muted/40 border-border/50"
                  />
                </div>
                {/* Category Filter Pills (shown in All / Library overview) */}
                {(activeNav === 'all' || activeNav === 'library') && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                    {(['all', 'text', 'shape', 'vfx', 'sfx', 'video', 'audio'] as const).map((cat) => (
                      <Button
                        key={cat}
                        variant={selectedCategory === cat ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(cat)}
                        className={`h-6 text-[10px] px-2 capitalize shrink-0 ${selectedCategory === cat
                          ? 'bg-accent-theme text-primary-foreground hover:bg-accent-theme/90'
                          : 'text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
                          }`}
                      >
                        {cat === 'all'
                          ? 'All'
                          : cat === 'vfx'
                            ? 'VFX'
                            : cat === 'sfx'
                              ? 'SFX (100+)'
                              : cat === 'text'
                                ? 'Typography'
                                : cat === 'shape'
                                  ? 'Shapes'
                                  : cat === 'video'
                                    ? 'Video Plates'
                                    : 'Audio Scores'}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Secondary SFX Bank Filter Pills */}
                {(effectiveCategory === 'sfx' || activeNav === 'sfx') && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none pt-1.5 border-t border-border/20">
                    {SFX_SOUND_BANKS.map((b) => (
                      <Button
                        key={b.id}
                        variant={selectedSfxBank === b.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedSfxBank(b.id)}
                        className={`h-5 text-[9px] px-2 shrink-0 rounded-full font-mono ${selectedSfxBank === b.id
                          ? 'bg-accent-theme text-primary-foreground hover:bg-accent-theme/90'
                          : 'text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground'
                          }`}
                      >
                        {b.name} ({b.count})
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div ref={presetScrollRef} className="flex-1 p-3 overflow-y-auto">
                {filteredPresets.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-6">
                    No presets found matching "{libraryFilterQuery}".
                  </p>
                ) : (
                  <div
                    style={{
                      height: `${presetVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {presetVirtualizer.getVirtualItems().map((virtualItem) => {
                      const preset = filteredPresets[virtualItem.index];
                      if (!preset) return null;
                      return (
                        <div
                          key={preset.id}
                          data-index={virtualItem.index}
                          ref={presetVirtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualItem.start}px)`,
                            paddingBottom: '10px',
                          }}
                        >
                          <DraggablePresetCard
                            preset={preset}
                            onInsert={handleInsert}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Assets Vault View */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border/40 bg-transparent space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Filter IR assets..."
                    value={assetFilterQuery}
                    onChange={(e) => setAssetFilterQuery(e.target.value)}
                    className="pl-8 h-8 text-xs bg-muted/40 border-border/50"
                  />
                </div>

                {/* Asset Type Filter Pills */}
                <div className="flex items-center gap-1">
                  {(['all', 'video', 'audio', 'image'] as const).map((type) => (
                    <Button
                      key={type}
                      variant={selectedAssetType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedAssetType(type)}
                      className={`h-6 text-[10px] px-2 capitalize ${selectedAssetType === type
                        ? 'bg-accent-theme text-primary-foreground hover:bg-accent-theme/90'
                        : 'text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
                        }`}
                    >
                      {type === 'all' ? 'All' : type}
                    </Button>
                  ))}
                </div>

                {/* Assets Vault Drag & Drop Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsVaultDragOver(true);
                  }}
                  onDragLeave={() => setIsVaultDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsVaultDragOver(false);
                    handleFilesIngest(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`mt-2 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${isVaultDragOver
                    ? 'border-accent-theme bg-accent-theme/10 text-accent-theme'
                    : 'border-border/60 hover:border-accent-theme/40 hover:bg-muted/40 text-muted-foreground'
                    }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFilesIngest(e.target.files);
                      if (e.target) e.target.value = '';
                    }}
                  />
                  <div className="flex flex-col items-center gap-1 pointer-events-none">
                    <UploadCloud className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[11px] font-medium">Click or drag files here</span>
                    <span className="text-[9px] text-muted-foreground">MP4, WEBM, MP3, WAV, PNG, JPG</span>
                  </div>
                </div>
              </div>

              <div ref={assetScrollRef} className="flex-1 p-3 overflow-y-auto">
                {filteredAssets.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-6">
                    No assets found matching "{assetFilterQuery}".
                  </p>
                ) : (
                  <div
                    style={{
                      height: `${assetVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {assetVirtualizer.getVirtualItems().map((virtualItem) => {
                      const asset = filteredAssets[virtualItem.index];
                      if (!asset) return null;
                      return (
                        <div
                          key={asset.id}
                          data-index={virtualItem.index}
                          ref={assetVirtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualItem.start}px)`,
                            paddingBottom: '8px',
                          }}
                        >
                          <DraggableAssetCard
                            assetId={asset.id}
                            asset={asset}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
