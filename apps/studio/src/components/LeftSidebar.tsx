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
      return <Type className="w-3.5 h-3.5 text-indigo-600" />;
    case 'Square':
      return <Square className="w-3.5 h-3.5 text-violet-600" />;
    case 'Circle':
      return <Circle className="w-3.5 h-3.5 text-cyan-600" />;
    case 'ArrowUpRight':
      return <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />;
    case 'Eye':
      return <Eye className="w-3.5 h-3.5 text-sky-600" />;
    case 'Sun':
      return <Sun className="w-3.5 h-3.5 text-amber-500" />;
    case 'Zap':
      return <Zap className="w-3.5 h-3.5 text-amber-500" />;
    case 'Sparkles':
    default:
      return <Sparkles className="w-3.5 h-3.5 text-pink-500" />;
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
      className={`p-3 border rounded-lg bg-white shadow-2xs transition-all select-none cursor-grab active:cursor-grabbing group ${
        isDragging
          ? 'opacity-40 border-indigo-500 scale-[0.98]'
          : 'border-slate-200 hover:border-indigo-400 hover:shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-slate-100 group-hover:bg-indigo-50 transition-colors">
            {renderPresetIcon(preset.iconName)}
          </div>
          <span className="font-semibold text-slate-800 text-xs">{preset.name}</span>
        </div>
        <Badge variant="outline" className="text-[9px] font-mono border-slate-200">
          {preset.badge}
        </Badge>
      </div>

      <p className="text-[11px] text-slate-500 leading-tight mb-2.5 pointer-events-none">
        {preset.description}
      </p>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
        <span className="text-slate-400 font-mono flex items-center gap-1 pointer-events-none">
          <GripVertical className="w-3 h-3 text-slate-300" />
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
          className="h-5 px-2 text-[10px] font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 cursor-pointer"
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
      className={`p-2.5 border rounded-lg bg-white shadow-2xs transition-all select-none cursor-grab active:cursor-grabbing group ${
        isDragging
          ? 'opacity-40 border-indigo-500 scale-[0.98]'
          : 'border-slate-200 hover:border-indigo-400 hover:shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between mb-1 pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded bg-slate-100 group-hover:bg-indigo-50 transition-colors">
            {getAssetIcon(asset.type)}
          </div>
          <span className="font-medium text-slate-900 truncate text-xs font-mono">
            {assetId}
          </span>
        </div>
        <Badge variant="outline" className="text-[9px] uppercase font-mono">
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
      <aside className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 justify-between shadow-sm z-20">
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
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
          className="w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={isOpen ? 'Collapse Left Drawer ([)' : 'Expand Left Drawer ([)'}
        >
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
      </aside>

      {/* 2. 300px Slide-out Drawer */}
      {isOpen && (
        <aside className="w-[300px] bg-white border-r border-slate-200 flex flex-col h-full shadow-xs">
          {/* Drawer Header */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeNav === 'library' ? (
                <>
                  <Library className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Staging Library
                  </h2>
                </>
              ) : (
                <>
                  <Folder className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Assets Vault
                  </h2>
                </>
              )}
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {activeNav === 'library' ? `${filteredPresets.length} items` : `${filteredAssets.length} assets`}
            </Badge>
          </div>

          {activeNav === 'library' ? (
            /* Library View */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-100 bg-white space-y-2">
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
                <div className="flex items-center gap-1">
                  {(['all', 'text', 'shape', 'vfx'] as const).map((cat) => (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(cat)}
                      className={`h-6 text-[10px] px-2 capitalize ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {cat === 'all' ? 'All' : cat === 'vfx' ? 'Partial VFX' : cat + 's'}
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
