import { createSignal, createMemo, For, Show } from 'solid-js';
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
} from 'lucide-solid';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  getDynamicStagingPresets,
  type StagingPreset,
  type PresetCategory,
} from '../lib/library/stagingPresets';
import { SFX_SOUND_BANKS } from '../lib/library/sfxBank';
import { IRStateManager } from '../lib/ir/irState';
import { useIRState } from '../lib/ir/useStudioStore';
import type { IRSequence } from '@acc/ir';
import type { StudioAssetRecord } from '../lib/ir/studioTypes';
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

export function LeftSidebar(props: LeftSidebarProps) {
  const irState = useIRState();
  const [libraryFilterQuery, setLibraryFilterQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<'all' | PresetCategory>('all');
  const [selectedSfxBank, setSelectedSfxBank] = createSignal<string>('all');
  const [assetFilterQuery, setAssetFilterQuery] = createSignal('');
  const [selectedAssetType, setSelectedAssetType] = createSignal<'all' | 'video' | 'audio' | 'image'>('all');
  let fileInputRef!: HTMLInputElement;
  const [isVaultDragOver, setIsVaultDragOver] = createSignal(false);

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
        cache.set(assetId, file, { mimeType: file.type, sizeBytes: file.size }).catch(() => { });
      } catch { }

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
    if (props.onInsertPreset) {
      props.onInsertPreset(preset);
    } else {
      const seq = preset.createSequence({ startFrame: 0, normX: 0.5, normY: 0.5 });
      IRStateManager.getInstance().addSequence(preset.targetTrackId, seq, {
        trackTypeFallback: preset.targetTrackType,
        trackNameFallback: preset.targetTrackName,
      });
    }
  };

  const NAV_CATEGORY_MAP: Partial<Record<LeftNavTab, 'all' | PresetCategory>> = {
    typography: 'text',
    shapes: 'shape',
    vfx: 'vfx',
    sfx: 'sfx',
    video: 'video',
    audio: 'audio',
    all: 'all',
  };

  const effectiveCategory = () =>
    NAV_CATEGORY_MAP[props.activeNav] ?? selectedCategory();

  const allStagingPresets = createMemo(() => getDynamicStagingPresets());

  const filteredPresets = createMemo(() => {
    const cat = effectiveCategory();
    const bank = selectedSfxBank();
    const q = libraryFilterQuery().toLowerCase();

    return allStagingPresets().filter((p) => {
      const matchesCat =
        cat === 'all' || p.category === cat || (cat === 'vfx' && p.category === 'overlay');
      const matchesBank =
        cat !== 'sfx' ||
        bank === 'all' ||
        p.id.toLowerCase().includes(`preset_sfx_${bank}`) ||
        p.id.toLowerCase().includes(`sfx_${bank}`);
      const matchesQuery =
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.badge.toLowerCase().includes(q);
      return matchesCat && matchesBank && matchesQuery;
    });
  });

  const assetList = createMemo(() =>
    Object.entries(irState().doc?.assets || {}).map(([id, asset]) => ({ id, ...asset }))
  );

  const filteredAssets = createMemo(() => {
    const selectedType = selectedAssetType();
    const q = assetFilterQuery().toLowerCase();
    return assetList().filter((a) => {
      const matchesType = selectedType === 'all' || a.type === selectedType;
      const matchesQuery =
        a.id.toLowerCase().includes(q) ||
        a.src.toLowerCase().includes(q) ||
        (a.name && a.name.toLowerCase().includes(q));
      return matchesType && matchesQuery;
    });
  });

  const headerInfo = () => {
    switch (props.activeNav) {
      case 'typography':
        return {
          title: 'Typography',
          icon: <Type class="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets().length} styles`,
        };
      case 'shapes':
        return {
          title: 'Shapes',
          icon: <Square class="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets().length} shapes`,
        };
      case 'vfx':
        return {
          title: 'Visual Effects',
          icon: <Sparkles class="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets().length} effects`,
        };
      case 'sfx':
        return {
          title: 'Sound Fx',
          icon: <Volume2 class="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets().length} sounds`,
        };
      case 'video':
        return {
          title: 'Video Footages',
          icon: <Film class="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets().length} plates`,
        };
      case 'audio':
        return {
          title: 'Audio Clips',
          icon: <Music class="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets().length} scores`,
        };
      case 'all':
      case 'library':
        return {
          title: 'Library',
          icon: <Library class="w-4 h-4 text-accent-theme" />,
          count: `${filteredPresets().length} items`,
        };
      case 'vault':
      default:
        return {
          title: 'Assets Vault',
          icon: <Folder class="w-4 h-4 text-accent-theme" />,
          count: `${filteredAssets().length} assets`,
        };
    }
  };

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
    <div class="flex h-full min-h-0 select-none z-10 shrink-0">
      {/* 1. 48px Enterprise Activity Rail */}
      <SidebarActivityRail
        isOpen={props.isOpen}
        onToggle={props.onToggle}
        activeNav={props.activeNav}
        setActiveNav={props.setActiveNav}
        onSelectCategory={setSelectedCategory}
      />

      {/* 2. 300px Slide-out Drawer */}
      <Show when={props.isOpen}>
        <aside class="w-[300px] glass-panel border-r border-border/50 flex flex-col h-full min-h-0 overflow-hidden shadow-glass">
          {/* Drawer Header */}
          <div class="p-3 border-b border-border/40 bg-background/50 flex items-center justify-between">
            <div class="flex items-center gap-2">
              {headerInfo().icon}
              <h2 class="text-xs font-bold capitalize tracking-wider text-foreground">
                {headerInfo().title}
              </h2>
            </div>
            <Badge variant="outline" class="font-mono text-[10px] border-border/40">
              {headerInfo().count}
            </Badge>
          </div>

          <Show
            when={props.activeNav !== 'vault'}
            fallback={
              /* Assets Vault View */
              <div class="flex-1 flex flex-col overflow-hidden">
                <div class="p-3 border-b border-border/40 bg-transparent space-y-2">
                  <div class="relative">
                    <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Filter IR assets..."
                      value={assetFilterQuery()}
                      onInput={(e: any) => setAssetFilterQuery(e.target.value)}
                      class="pl-8 h-8 text-xs bg-muted/40 border-border/50"
                    />
                  </div>

                  {/* Asset Type Filter Pills */}
                  <div class="flex items-center gap-1">
                    <For each={['all', 'video', 'audio', 'image'] as const}>
                      {(type) => (
                        <Button
                          variant={selectedAssetType() === type ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedAssetType(type)}
                          class={`h-6 text-[10px] px-2 capitalize ${
                            selectedAssetType() === type
                              ? 'bg-accent-theme text-primary-foreground hover:bg-accent-theme/90'
                              : 'text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {type === 'all' ? 'All' : type}
                        </Button>
                      )}
                    </For>
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
                      handleFilesIngest(e.dataTransfer?.files || null);
                    }}
                    onClick={() => fileInputRef?.click()}
                    class={`mt-2 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                      isVaultDragOver()
                        ? 'border-accent-theme bg-accent-theme/10 text-accent-theme'
                        : 'border-border/60 hover:border-accent-theme/40 hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      class="hidden"
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleFilesIngest(target.files);
                        target.value = '';
                      }}
                    />
                    <div class="flex flex-col items-center gap-1 pointer-events-none">
                      <UploadCloud class="w-5 h-5 text-muted-foreground" />
                      <span class="text-[11px] font-medium">Click or drag files here</span>
                      <span class="text-[9px] text-muted-foreground">
                        MP4, WEBM, MP3, WAV, PNG, JPG
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex-1 p-3 overflow-y-auto min-h-0">
                  <Show
                    when={filteredAssets().length > 0}
                    fallback={
                      <p class="text-xs text-muted-foreground italic text-center py-6">
                        No assets found matching "{assetFilterQuery()}".
                      </p>
                    }
                  >
                    <div class="flex flex-col gap-2">
                      <For each={filteredAssets()}>
                        {(asset) => (
                          <DraggableAssetCard
                            assetId={asset.id}
                            asset={asset}
                            onInsert={handleInsertAsset}
                          />
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            }
          >
            {/* Library View */}
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="p-3 border-b border-border/30 bg-transparent space-y-2">
                <div class="relative">
                  <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={`Search ${headerInfo().title.toLowerCase()}...`}
                    value={libraryFilterQuery()}
                    onInput={(e: any) => setLibraryFilterQuery(e.target.value)}
                    class="pl-8 h-8 text-xs bg-muted/40 border-border/50"
                  />
                </div>
                {/* Category Filter Pills (shown in All / Library overview) */}
                <Show when={props.activeNav === 'all' || props.activeNav === 'library'}>
                  <div class="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                    <For each={['all', 'text', 'shape', 'vfx', 'sfx', 'video', 'audio'] as const}>
                      {(cat) => (
                        <Button
                          variant={selectedCategory() === cat ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory(cat)}
                          class={`h-6 text-[10px] px-2 capitalize shrink-0 transition-transform hover:-translate-y-0.5 ${
                            selectedCategory() === cat
                              ? 'bg-accent-theme text-primary-foreground hover:bg-accent-theme/90'
                              : 'text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {CATEGORY_LABELS[cat] || cat}
                        </Button>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Secondary SFX Bank Filter Pills */}
                <Show when={effectiveCategory() === 'sfx' || props.activeNav === 'sfx'}>
                  <div class="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none pt-1.5 border-t border-border/20">
                    <For each={SFX_SOUND_BANKS}>
                      {(b) => (
                        <Button
                          variant={selectedSfxBank() === b.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedSfxBank(b.id)}
                          class={`h-5 text-[9px] px-2 shrink-0 rounded-full font-mono ${
                            selectedSfxBank() === b.id
                              ? 'bg-accent-theme text-primary-foreground hover:bg-accent-theme/90'
                              : 'text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {b.name} ({b.count})
                        </Button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <div class="flex-1 p-3 overflow-y-auto min-h-0">
                <Show
                  when={filteredPresets().length > 0}
                  fallback={
                    <p class="text-xs text-muted-foreground italic text-center py-6">
                      No presets found matching "{libraryFilterQuery()}".
                    </p>
                  }
                >
                  <div class="flex flex-col gap-2.5">
                    <For each={filteredPresets()}>
                      {(preset) => (
                        <DraggablePresetCard preset={preset} onInsert={handleInsert} />
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </aside>
      </Show>
    </div>
  );
}
