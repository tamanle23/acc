import React, { useState } from 'react';
import {
  Library,
  Folder,
  Search,
  Type,
  Square,
  Sparkles,
  Music,
  Volume2,
  Film,
  UploadCloud,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { STAGING_PRESETS, type StagingPreset, type PresetCategory } from '../lib/library/stagingPresets';
import { SFX_SOUND_BANKS } from '../lib/library/sfxBank';
import { IRStateManager } from '../lib/ir/irState';
import { useIRState } from '../lib/ir/useStudioStore';
import { ContentCacheRegistry, CacheNamespace } from '@acc/core-isomorphic';
import {
  renderPresetIcon,
  ShapePresetThumbnail,
  TypographyPresetThumbnail,
} from './sidebar/PresetThumbnails';
import {
  DraggablePresetCard,
  DraggableAssetCard,
  DragOverlayPreview,
} from './sidebar/SidebarCards';
import { SidebarActivityRail } from './sidebar/SidebarActivityRail';

export {
  renderPresetIcon,
  ShapePresetThumbnail,
  TypographyPresetThumbnail,
  DraggablePresetCard,
  DraggableAssetCard,
  DragOverlayPreview,
};

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

      // Store into ContentCacheRegistry with Blob API zero-copy backing
      try {
        const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
        cache.set(assetId, file, { mimeType: file.type, sizeBytes: file.size }).catch(() => {});
      } catch {}

      if (isVideo) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = objectUrl;
        video.onloadedmetadata = () => {
          IRStateManager.getInstance().addAsset(assetId, {
            id: assetId,
            type: 'video',
            src: objectUrl,
            name: file.name,
            size: file.size,
            durationSec: video.duration || 10,
            hasAudio: true,
          });
        };
        video.onerror = () => {
          IRStateManager.getInstance().addAsset(assetId, {
            id: assetId,
            type: 'video',
            src: objectUrl,
            name: file.name,
            size: file.size,
            durationSec: 10,
          });
        };
      } else if (isAudio) {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.src = objectUrl;
        audio.onloadedmetadata = () => {
          IRStateManager.getInstance().addAsset(assetId, {
            id: assetId,
            type: 'audio',
            src: objectUrl,
            name: file.name,
            size: file.size,
            durationSec: audio.duration || 10,
          });
        };
        audio.onerror = () => {
          IRStateManager.getInstance().addAsset(assetId, {
            id: assetId,
            type: 'audio',
            src: objectUrl,
            name: file.name,
            size: file.size,
            durationSec: 10,
          });
        };
      } else {
        IRStateManager.getInstance().addAsset(assetId, {
          id: assetId,
          type,
          src: objectUrl,
          name: file.name,
          size: file.size,
        });
      }
    }
  };

  const handleInsertAsset = (asset: StudioAssetRecord) => {
    const assetId = String(asset.id || 'asset');
    const targetTrackId = asset.type === 'audio' ? 'track-a1' : 'track-v1';
    const targetTrackType = asset.type === 'audio' ? 'audio' : 'video';
    const seqId = `seq_${assetId}_${Date.now().toString(36)}`;
    const durationFrames = asset.durationSec ? Math.round(asset.durationSec * 30) : 90;

    const newSeq: IRSequence = {
      id: seqId,
      name: asset.name || assetId,
      type: asset.type === 'audio' ? 'audio' : asset.type === 'image' ? 'image' : 'video',
      time: {
        start: 0,
        duration: durationFrames,
      },
      startFrame: 0,
      timelineStartFrame: 0,
      durationFrames,
      assetId,
      modifiers: [],
    };

    IRStateManager.getInstance().addSequence(targetTrackId, newSeq, {
      trackTypeFallback: targetTrackType,
      trackNameFallback: targetTrackId,
    });
  };

  const handleInsert = (preset: StagingPreset) => {
    if (onInsertPreset) {
      onInsertPreset(preset);
    } else {
      const seq = preset.createSequence({ startFrame: 0, normX: 0.5, normY: 0.5 });
      IRStateManager.getInstance().addSequence(preset.targetTrackId, seq, { trackTypeFallback: preset.targetTrackType, trackNameFallback: preset.targetTrackName });
    }
  };

  const NAV_CATEGORY_MAP: Partial<Record<LeftNavTab, 'all' | PresetCategory>> = {
    typography: 'text', shapes: 'shape', vfx: 'vfx', sfx: 'sfx', video: 'video', audio: 'audio', all: 'all',
  };
  const effectiveCategory: 'all' | PresetCategory = NAV_CATEGORY_MAP[activeNav] ?? selectedCategory;

  const filteredPresets = STAGING_PRESETS.filter((p) => {
    const matchesCat = effectiveCategory === 'all' || p.category === effectiveCategory || (effectiveCategory === 'vfx' && p.category === 'overlay');
    const matchesBank = effectiveCategory !== 'sfx' || selectedSfxBank === 'all' || p.id.toLowerCase().includes(`preset_sfx_${selectedSfxBank}`) || p.id.toLowerCase().includes(`sfx_${selectedSfxBank}`);
    const matchesQuery = p.name.toLowerCase().includes(libraryFilterQuery.toLowerCase()) || p.description.toLowerCase().includes(libraryFilterQuery.toLowerCase()) || p.badge.toLowerCase().includes(libraryFilterQuery.toLowerCase());
    return matchesCat && matchesBank && matchesQuery;
  });

  const assetList = Object.entries(irState.doc.assets || {}).map(([id, asset]) => ({ id, ...asset }));

  const filteredAssets = assetList.filter((a) => {
    const matchesType = selectedAssetType === 'all' || a.type === selectedAssetType;
    const q = assetFilterQuery.toLowerCase();
    const matchesQuery =
      a.id.toLowerCase().includes(q) ||
      a.src.toLowerCase().includes(q) ||
      (a.name && a.name.toLowerCase().includes(q));
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
        return { title: 'Typography', icon: <Type className="w-4 h-4 text-accent-theme" />, count: `${filteredPresets.length} styles` };
      case 'shapes':
        return { title: 'Shapes', icon: <Square className="w-4 h-4 text-accent-theme" />, count: `${filteredPresets.length} shapes` };
      case 'vfx':
        return { title: 'Visual Effects', icon: <Sparkles className="w-4 h-4 text-accent-theme" />, count: `${filteredPresets.length} effects` };
      case 'sfx':
        return { title: 'Sound Fx', icon: <Volume2 className="w-4 h-4 text-accent-theme" />, count: `${filteredPresets.length} sounds` };
      case 'video':
        return { title: 'Video Footages', icon: <Film className="w-4 h-4 text-accent-theme" />, count: `${filteredPresets.length} plates` };
      case 'audio':
        return { title: 'Audio Clips', icon: <Music className="w-4 h-4 text-accent-theme" />, count: `${filteredPresets.length} scores` };
      case 'all':
      case 'library':
        return { title: 'Library', icon: <Library className="w-4 h-4 text-accent-theme" />, count: `${filteredPresets.length} items` };
      case 'vault':
      default:
        return { title: 'Assets Vault', icon: <Folder className="w-4 h-4 text-accent-theme" />, count: `${filteredAssets.length} assets` };
    }
  };

  const headerInfo = getDrawerHeader();
  const CATEGORY_LABELS: Record<string, string> = {
    all: 'All',
    vfx: 'VFX',
    sfx: 'SFX (100+)',
    text: 'Typography',
    shape: 'Shapes',
    video: 'Video Plates',
    audio: 'Audio Scores',
  };

  return (
    <div className="flex h-full select-none z-10 shrink-0">
      {/* 1. 48px Enterprise Activity Rail */}
      <SidebarActivityRail
        isOpen={isOpen}
        onToggle={onToggle}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onSelectCategory={setSelectedCategory}
      />

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
                        className={`h-6 text-[10px] px-2 capitalize shrink-0 transition-transform hover:-translate-y-0.5 ${
                          selectedCategory === cat
                            ? 'bg-accent-theme text-primary-foreground hover:bg-accent-theme/90'
                            : 'text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {CATEGORY_LABELS[cat] || cat}
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
                        className={`h-5 text-[9px] px-2 shrink-0 rounded-full font-mono ${
                          selectedSfxBank === b.id
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
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)`, paddingBottom: '10px' }}
                        >
                          <DraggablePresetCard preset={preset} onInsert={handleInsert} />
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
                      className={`h-6 text-[10px] px-2 capitalize ${
                        selectedAssetType === type
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
                  className={`mt-2 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                    isVaultDragOver
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
                    <span className="text-[9px] text-muted-foreground">
                      MP4, WEBM, MP3, WAV, PNG, JPG
                    </span>
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
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)`, paddingBottom: '8px' }}
                        >
                          <DraggableAssetCard assetId={asset.id} asset={asset} onInsert={handleInsertAsset} />
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
