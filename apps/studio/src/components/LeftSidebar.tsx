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
  UploadCloud,
  Image as ImageIcon,
  FileBox,
} from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { STAGING_PRESETS, type StagingPreset, type PresetCategory } from '../lib/library/stagingPresets';
import { IRStateManager } from '../lib/ir/irState';

export interface LeftSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeNav: 'library' | 'vault';
  setActiveNav: (nav: 'library' | 'vault') => void;
  onInsertPreset?: (preset: StagingPreset) => void;
}

export function renderPresetIcon(iconName: string) {
  switch (iconName) {
    case 'Type':
      return <Type className="w-3.5 h-3.5 text-indigo-500" />;
    case 'Square':
      return <Square className="w-3.5 h-3.5 text-violet-500" />;
    case 'Circle':
      return <Circle className="w-3.5 h-3.5 text-cyan-400" />;
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
    case 'Sparkles':
    default:
      return <Sparkles className="w-3.5 h-3.5 text-pink-400" />;
  }
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
      className={`p-3 rounded-xl glass-card transition-all duration-200 select-none cursor-grab active:cursor-grabbing group hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/40 hover:shadow-[0_4px_16px_var(--accent-glow)]/15 ${
        isDragging
          ? 'opacity-40 border-cyan-400 scale-[0.98]'
          : 'hover:border-[var(--accent-primary)]/40'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-slate-500/10 group-hover:bg-[var(--accent-glow)]/20 group-hover:scale-110 transition-all duration-200">
            {renderPresetIcon(preset.iconName)}
          </div>
          <span className="font-semibold text-foreground/90 text-xs">{preset.name}</span>
        </div>
        <Badge variant="outline" className="text-[9px] font-mono border-border/40">
          {preset.badge}
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground leading-tight mb-2.5 pointer-events-none line-clamp-2">
        {preset.description}
      </p>

      <div className="flex items-center justify-between pt-1 border-t border-[var(--glass-border)] text-[10px]">
        <span className="text-muted-foreground font-mono flex items-center gap-1 pointer-events-none">
          <GripVertical className="w-3 h-3 text-muted-foreground/60" />
          Drag to stage
        </span>
        <Button
          size="sm"
          variant="ghost"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onInsert(preset);
          }}
          className="h-5 px-2 text-[10px] font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-glow)]/20 rounded-full gap-1 cursor-pointer transition-all active:scale-95"
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
  asset: any;
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
        return <FileBox className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-2.5 rounded-lg glass-card transition-all select-none cursor-grab active:cursor-grabbing group ${
        isDragging
          ? 'opacity-40 border-cyan-400 scale-[0.98]'
          : 'hover:border-cyan-400/60'
      }`}
    >
      <div className="flex items-center justify-between mb-1 pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded bg-slate-500/10 group-hover:bg-cyan-500/20 transition-colors">
            {getAssetIcon(asset.type)}
          </div>
          <span className="font-medium text-slate-800 dark:text-slate-100 truncate text-xs font-mono">
            {assetId}
          </span>
        </div>
        <Badge variant="outline" className="text-[9px] uppercase font-mono border-border/40">
          {asset.type}
        </Badge>
      </div>
      <p className="text-[10px] text-slate-400 truncate font-mono pointer-events-none">{asset.src}</p>
      <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-100 text-[10px] text-slate-400 font-mono pointer-events-none">
        <span className="flex items-center gap-1">
          <GripVertical className="w-3 h-3 text-slate-300" />
          Drag into canvas
        </span>
        {asset.durationSec && <span>{asset.durationSec.toFixed(1)}s</span>}
      </div>
    </Card>
  );
}

export function DragOverlayPreview({ item }: { item: any }) {
  if (!item) return null;

  if (item.type === 'preset' && item.preset) {
    const p = item.preset as StagingPreset;
    return (
      <div className="p-3 border-2 border-indigo-500 bg-white/95 rounded-lg shadow-xl w-64 pointer-events-none backdrop-blur-xs">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {renderPresetIcon(p.iconName)}
            <span className="font-semibold text-slate-900 text-xs">{p.name}</span>
          </div>
          <Badge className="text-[9px] bg-indigo-600 text-white font-mono">{p.badge}</Badge>
        </div>
        <p className="text-[10px] text-slate-500 line-clamp-1">{p.description}</p>
      </div>
    );
  }

  if (item.type === 'asset' && item.asset) {
    return (
      <div className="p-2.5 border-2 border-indigo-500 bg-white/95 rounded-lg shadow-xl w-60 pointer-events-none backdrop-blur-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold text-slate-900 truncate">{item.assetId}</span>
          <Badge className="text-[9px] uppercase font-mono bg-indigo-600 text-white">{item.asset.type}</Badge>
        </div>
        <p className="text-[10px] text-slate-400 truncate font-mono mt-0.5">{item.asset.src}</p>
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
  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());
  const [libraryFilterQuery, setLibraryFilterQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | PresetCategory>('all');
  const [assetFilterQuery, setAssetFilterQuery] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isVaultDragOver, setIsVaultDragOver] = useState(false);

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

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

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

  const filteredPresets = STAGING_PRESETS.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesQuery =
      p.name.toLowerCase().includes(libraryFilterQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(libraryFilterQuery.toLowerCase()) ||
      p.badge.toLowerCase().includes(libraryFilterQuery.toLowerCase());
    return matchesCat && matchesQuery;
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

  return (
    <div className="flex h-full select-none z-10 shrink-0">
      {/* 1. 48px Enterprise Activity Rail */}
      <aside className="w-12 glass-panel border-r border-border/50 flex flex-col items-center py-3 justify-between shadow-sm z-20">
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setActiveNav('library');
              if (!isOpen) onToggle();
            }}
            className={`w-9 h-9 rounded-lg transition-colors ${
              activeNav === 'library' && isOpen
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
            }`}
            title="Library Presets & Partial VFX ([)"
          >
            <Library className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setActiveNav('vault');
              if (!isOpen) onToggle();
            }}
            className={`w-9 h-9 rounded-lg transition-colors ${
              activeNav === 'vault' && isOpen
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
            }`}
            title="Assets Vault ([)"
          >
            <Folder className="w-4 h-4" />
          </Button>
        </div>

        {/* Drawer Collapse Trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
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
              {activeNav === 'library' ? (
                <>
                  <Library className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Staging Library
                  </h2>
                </>
              ) : (
                <>
                  <Folder className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Assets Vault
                  </h2>
                </>
              )}
            </div>
            <Badge variant="outline" className="font-mono text-[10px] border-border/40">
              {activeNav === 'library' ? `${filteredPresets.length} items` : `${filteredAssets.length} assets`}
            </Badge>
          </div>

          {activeNav === 'library' ? (
            /* Library View */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border/30 bg-transparent space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Search presets & partial VFX..."
                    value={libraryFilterQuery}
                    onChange={(e) => setLibraryFilterQuery(e.target.value)}
                    className="pl-8 h-8 text-xs bg-slate-50/50"
                  />
                </div>
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {(['all', 'text', 'shape', 'vfx', 'sfx'] as const).map((cat) => (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(cat)}
                      className={`h-6 text-[10px] px-2 capitalize shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {cat === 'all'
                        ? 'All'
                        : cat === 'vfx'
                        ? 'VFX'
                        : cat === 'sfx'
                        ? 'SFX'
                        : cat === 'text'
                        ? 'Typography'
                        : 'Shapes'}
                    </Button>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2.5 pb-4">
                  {filteredPresets.map((preset) => (
                    <DraggablePresetCard
                      key={preset.id}
                      preset={preset}
                      onInsert={handleInsert}
                    />
                  ))}
                  {filteredPresets.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-6">
                      No presets found matching "{libraryFilterQuery}".
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            /* Assets Vault View */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-100 bg-white space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Filter IR assets..."
                    value={assetFilterQuery}
                    onChange={(e) => setAssetFilterQuery(e.target.value)}
                    className="pl-8 h-8 text-xs bg-slate-50/50"
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
                      className={`h-6 text-[10px] px-2 capitalize ${
                        selectedAssetType === type
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'text-slate-600 border-slate-200 hover:bg-slate-50'
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
                  className={`mt-2 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                    isVaultDragOver
                      ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-500'
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
                    <UploadCloud className="w-5 h-5 text-slate-400" />
                    <span className="text-[11px] font-medium">Click or drag files here</span>
                    <span className="text-[9px] text-slate-400">MP4, WEBM, MP3, WAV, PNG, JPG</span>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2 pb-4">
                  {filteredAssets.map((asset) => (
                    <DraggableAssetCard
                      key={asset.id}
                      assetId={asset.id}
                      asset={asset}
                    />
                  ))}
                  {filteredAssets.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-6">
                      No assets found matching "{assetFilterQuery}".
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
