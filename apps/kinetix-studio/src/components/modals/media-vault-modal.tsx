import { createSignal, createMemo, Show, For, onCleanup, Component } from 'solid-js';
import {
  Film,
  Music,
  Search,
  X,
  Check,
  RotateCcw,
  Volume2,
  Image as ImageIcon,
} from 'lucide-solid';
import type { MediaCatalogItem } from '@/types/media';
import { useStudio } from '@/context/studio-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MEDIA_CATALOG } from '@/constants/media-catalog';
import { preloadImage } from '@/lib/opfs-storage';
import { videoTextureEngine } from '@/lib/video-texture-engine';
import { userAudioTrack } from '@/engine/audio-user-track';
import { cn } from '@/lib/utils';

export interface MediaVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TypeFilter = 'All' | 'Images' | 'Videos' | 'Audio';

export const MediaVaultModal: Component<MediaVaultModalProps> = (props) => {
  const studio = useStudio();
  const [typeFilter, setTypeFilter] = createSignal<TypeFilter>('All');
  const [categoryFilter, setCategoryFilter] = createSignal<string>('All');
  const [searchQuery, setSearchQuery] = createSignal<string>('');
  const [previewingAudioUrl, setPreviewingAudioUrl] = createSignal<string | null>(null);

  let previewAudio: HTMLAudioElement | null = null;

  onCleanup(() => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
    }
  });

  const categories = createMemo(() => {
    const set = new Set<string>();
    for (const item of MEDIA_CATALOG) {
      set.add(item.category);
    }
    return ['All', ...Array.from(set)];
  });

  const filteredAssets = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    const t = typeFilter();
    const c = categoryFilter();

    return MEDIA_CATALOG.filter((item) => {
      // Type filter
      if (t === 'Images' && item.mediaType !== 'image') return false;
      if (t === 'Videos' && item.mediaType !== 'video') return false;
      if (t === 'Audio' && item.mediaType !== 'audio') return false;

      // Category filter
      if (c !== 'All' && item.category !== c) return false;

      // Search query
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchAuthor = item.author.toLowerCase().includes(q);
        const matchSource = item.source.toLowerCase().includes(q);
        const matchTags = item.tags.some((tag) => tag.toLowerCase().includes(q));
        const matchSpheres = item.recommendedSpheres?.some((s) => s.toLowerCase().includes(q));
        if (!matchName && !matchAuthor && !matchSource && !matchTags && !matchSpheres) {
          return false;
        }
      }

      return true;
    });
  });

  const isItemActive = (item: MediaCatalogItem) => {
    if (item.mediaType === 'image') {
      return (
        studio.state.bgCustomImageKey === item.id ||
        studio.state.userPhotoCutoutKey === item.id ||
        studio.state.activeMediaAssetId === item.id
      );
    }
    if (item.mediaType === 'video') {
      return (
        studio.state.bgVideoUrl === item.url ||
        studio.state.activeMediaAssetId === item.id
      );
    }
    if (item.mediaType === 'audio') {
      return (
        studio.state.activeMediaAssetId === item.id &&
        studio.state.audioSource === 'user-file'
      );
    }
    return false;
  };

  const toggleAudioPreview = (url: string) => {
    if (typeof Audio === 'undefined') return;

    if (previewingAudioUrl() === url) {
      previewAudio?.pause();
      setPreviewingAudioUrl(null);
    } else {
      if (previewAudio) {
        previewAudio.pause();
      }
      previewAudio = new Audio(url);
      previewAudio.onended = () => setPreviewingAudioUrl(null);
      previewAudio.play().catch(() => {});
      setPreviewingAudioUrl(url);
    }
  };

  const handleApplyImageBackground = async (item: MediaCatalogItem) => {
    try {
      await preloadImage(item.id, item.url);
      studio.patchState({
        bgGraphicId: 'custom-image',
        bgCustomImageKey: item.id,
        bgVideoUrl: null,
        activeMediaAssetId: item.id,
      });
      studio.triggerToast(`Applied Background: ${item.name}`);
    } catch (err) {
      console.warn('[MediaVault] Failed to preload image, using dataUri fallback:', err);
      if (item.dataUriFallback) {
        await preloadImage(item.id, item.dataUriFallback);
        studio.patchState({
          bgGraphicId: 'custom-image',
          bgCustomImageKey: item.id,
          bgVideoUrl: null,
          activeMediaAssetId: item.id,
        });
        studio.triggerToast(`Applied Offline Background: ${item.name}`);
      }
    }
  };

  const handleApplyHeroCutout = async (item: MediaCatalogItem) => {
    try {
      await preloadImage(item.id, item.url);
      studio.patchState({
        userPhotoCutoutKey: item.id,
        activeMediaAssetId: item.id,
      });
      studio.triggerToast(`Applied Hero Cutout: ${item.name}`);
    } catch (err) {
      console.warn('[MediaVault] Failed to preload hero cutout:', err);
      if (item.dataUriFallback) {
        await preloadImage(item.id, item.dataUriFallback);
        studio.patchState({
          userPhotoCutoutKey: item.id,
          activeMediaAssetId: item.id,
        });
        studio.triggerToast(`Applied Offline Hero Cutout: ${item.name}`);
      }
    }
  };

  const handleApplyVideoBackground = async (item: MediaCatalogItem) => {
    try {
      await videoTextureEngine.setActiveVideo(item.url);
      studio.patchState({
        bgVideoUrl: item.url,
        bgGraphicId: 'solid',
        bgVideoLoopDuration: item.durationSec || 6,
        activeMediaAssetId: item.id,
      });
      studio.triggerToast(`Applied Video Background: ${item.name}`);
    } catch (err) {
      console.error('[MediaVault] Failed to set video background:', err);
      studio.triggerToast(`Error loading video: ${item.name}`);
    }
  };

  const handleApplyAudio = async (item: MediaCatalogItem) => {
    try {
      if (previewAudio) {
        previewAudio.pause();
        setPreviewingAudioUrl(null);
      }
      await userAudioTrack.loadAudioFromUrl(item.url);
      studio.patchState({
        audioSource: 'user-file',
        activeMediaAssetId: item.id,
      });
      studio.triggerToast(`Applied Audio Stem: ${item.name}`);
    } catch (err) {
      console.error('[MediaVault] Failed to load audio stem:', err);
      studio.triggerToast(`Error loading audio: ${item.name}`);
    }
  };

  const handleClearActiveMedia = () => {
    if (previewAudio) {
      previewAudio.pause();
      setPreviewingAudioUrl(null);
    }
    videoTextureEngine.setActiveVideo(null);
    studio.patchState({
      bgVideoUrl: null,
      bgCustomImageKey: null,
      userPhotoCutoutKey: null,
      activeMediaAssetId: null,
      bgGraphicId: 'solid',
    });
    studio.triggerToast('Cleared active media asset (Procedural mode restored)');
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      maxWidthClass="max-w-6xl"
      title={
        <div class="flex items-center gap-2">
          <Film class="w-4 h-4 text-cyan-400" />
          <h2 class="text-sm font-mono font-bold text-foreground">
            STUDIO MEDIA VAULT // {MEDIA_CATALOG.length} CC0 & ARCHIVAL ASSETS
          </h2>
          <Badge variant="cyan" class="text-[10px] hidden sm:inline-flex">
            Free & Open Access
          </Badge>
        </div>
      }
      headerActions={
        <div class="flex items-center gap-2 mr-2">
          <Show when={studio.state.activeMediaAssetId || studio.state.bgVideoUrl || studio.state.bgCustomImageKey}>
            <Button
              variant="secondary"
              size="xs"
              onClick={handleClearActiveMedia}
              title="Reset background and return to procedural patterns"
              class="text-xs text-rose-400 hover:text-rose-300 border border-rose-500/30"
            >
              <RotateCcw class="w-3 h-3 mr-1" />
              <span>Reset Media</span>
            </Button>
          </Show>
        </div>
      }
    >
      <div class="flex flex-col gap-4">
        {/* Controls: Type Tabs, Categories & Real-time Search */}
        <div class="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between pb-3 border-b border-border">
          {/* MediaType Filter */}
          <div class="flex items-center gap-1 shrink-0 overflow-x-auto pb-1 md:pb-0">
            <For each={['All', 'Images', 'Videos', 'Audio'] as const}>
              {(type) => {
                const isActive = () => typeFilter() === type;
                return (
                  <button
                    type="button"
                    onClick={() => setTypeFilter(type)}
                    class={cn(
                      'px-3 py-1.5 rounded text-xs font-mono font-medium cursor-pointer transition-colors shrink-0',
                      isActive()
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                    )}
                  >
                    {type === 'Images' && <ImageIcon class="w-3 h-3 inline mr-1" />}
                    {type === 'Videos' && <Film class="w-3 h-3 inline mr-1" />}
                    {type === 'Audio' && <Music class="w-3 h-3 inline mr-1" />}
                    {type}
                  </button>
                );
              }}
            </For>
          </div>

          {/* Search Input & Category Dropdown */}
          <div class="flex items-center gap-2 flex-1 max-w-md">
            <div class="relative flex-1">
              <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search art, grain, stems, tags..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-full pl-8 pr-7 py-1.5 text-xs font-mono bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500"
              />
              <Show when={searchQuery()}>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X class="w-3 h-3" />
                </button>
              </Show>
            </div>

            <select
              value={categoryFilter()}
              onChange={(e) => setCategoryFilter(e.currentTarget.value)}
              class="py-1.5 px-2 text-xs font-mono bg-card border border-border rounded text-foreground focus:outline-none focus:border-cyan-500"
            >
              <For each={categories()}>
                {(cat) => <option value={cat}>{cat}</option>}
              </For>
            </select>
          </div>
        </div>

        {/* Assets Grid */}
        <Show
          when={filteredAssets().length > 0}
          fallback={
            <div class="py-16 text-center text-muted-foreground font-mono text-xs flex flex-col items-center gap-2">
              <Film class="w-8 h-8 text-muted-foreground/50 mb-1" />
              <div>No media assets found matching the query.</div>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  setTypeFilter('All');
                  setCategoryFilter('All');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          }
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[64vh] overflow-y-auto pr-1">
            <For each={filteredAssets()}>
              {(item) => {
                const active = () => isItemActive(item);
                const isAudioPlaying = () => previewingAudioUrl() === item.url;

                return (
                  <div
                    class={cn(
                      'group rounded-lg bg-card border transition-all flex flex-col justify-between overflow-hidden',
                      active()
                        ? 'border-cyan-500 ring-1 ring-cyan-500/40 shadow-sm'
                        : 'border-border hover:border-cyan-500/40'
                    )}
                  >
                    {/* Media Preview Box */}
                    <div class="relative w-full h-36 bg-slate-950 flex items-center justify-center overflow-hidden select-none border-b border-border">
                      {/* Image Preview */}
                      <Show when={item.mediaType === 'image'}>
                        <img
                          src={item.thumbUrl || item.url}
                          alt={item.name}
                          loading="lazy"
                          onError={(e) => {
                            if (item.dataUriFallback) {
                              e.currentTarget.src = item.dataUriFallback;
                            }
                          }}
                          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </Show>

                      {/* Video Preview */}
                      <Show when={item.mediaType === 'video'}>
                        <video
                          src={item.url}
                          muted
                          loop
                          playsinline
                          autoplay
                          onError={(e) => {
                            // Fallback poster on network error
                            e.currentTarget.style.display = 'none';
                          }}
                          class="w-full h-full object-cover"
                        />
                        <div class="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-mono text-cyan-300">
                          {item.durationSec}s Loop
                        </div>
                      </Show>

                      {/* Audio Stem Preview */}
                      <Show when={item.mediaType === 'audio'}>
                        <div class="flex flex-col items-center justify-center gap-2 p-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleAudioPreview(item.url)}
                            class={cn(
                              'w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer',
                              isAudioPlaying()
                                ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/30'
                                : 'bg-secondary text-foreground hover:bg-cyan-500/20'
                            )}
                            title={isAudioPlaying() ? 'Pause Preview' : 'Play Audio Stem'}
                          >
                            <Show
                              when={isAudioPlaying()}
                              fallback={<Volume2 class="w-5 h-5 text-cyan-400" />}
                            >
                              <Volume2 class="w-5 h-5 animate-pulse text-slate-950" />
                            </Show>
                          </button>
                          <span class="text-[10px] font-mono text-muted-foreground">
                            {isAudioPlaying() ? 'Playing Stem...' : `Acoustic Stem • ${item.durationSec}s`}
                          </span>
                        </div>
                      </Show>

                      {/* Top Badges */}
                      <div class="absolute top-2 left-2 flex items-center gap-1.5">
                        <Badge
                          variant={
                            item.mediaType === 'image'
                              ? 'cyan'
                              : item.mediaType === 'video'
                              ? 'lime'
                              : 'amber'
                          }
                          class="text-[9px] px-1.5 py-0.5"
                        >
                          {item.mediaType.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" class="text-[9px] px-1.5 py-0.5 bg-black/60 text-slate-200">
                          {item.license}
                        </Badge>
                      </div>

                      <Show when={active()}>
                        <div class="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-mono font-bold shadow-xs">
                          <Check class="w-3 h-3" />
                          <span>Active</span>
                        </div>
                      </Show>
                    </div>

                    {/* Meta Information */}
                    <div class="p-3 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <div class="text-xs font-bold text-foreground line-clamp-1 group-hover:text-cyan-400 transition-colors">
                          {item.name}
                        </div>
                        <div class="text-[11px] font-mono text-muted-foreground mt-0.5 line-clamp-1">
                          {item.author} • {item.source}
                        </div>
                        <div class="flex flex-wrap gap-1 mt-2">
                          <For each={item.tags.slice(0, 3)}>
                            {(tag) => (
                              <span class="text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                #{tag}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>

                      {/* Action Triggers */}
                      <div class="pt-2.5 border-t border-border flex items-center gap-1.5">
                        <Show when={item.mediaType === 'image'}>
                          <Button
                            variant="secondary"
                            size="xs"
                            class="flex-1 text-[11px]"
                            onClick={() => handleApplyImageBackground(item)}
                            title="Apply this CC0 artwork as canvas background texture"
                          >
                            Set Background
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            class="text-[11px] border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                            onClick={() => handleApplyHeroCutout(item)}
                            title="Apply as foreground Hero Cutout"
                          >
                            Cutout
                          </Button>
                        </Show>

                        <Show when={item.mediaType === 'video'}>
                          <Button
                            variant="primary"
                            size="xs"
                            class="flex-1 text-[11px] bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                            onClick={() => handleApplyVideoBackground(item)}
                            title="Stream this video footage texture into the 60fps Canvas2D loop"
                          >
                            <Film class="w-3 h-3 mr-1" />
                            Set Video Texture
                          </Button>
                        </Show>

                        <Show when={item.mediaType === 'audio'}>
                          <Button
                            variant="secondary"
                            size="xs"
                            class="flex-1 text-[11px]"
                            onClick={() => handleApplyAudio(item)}
                            title="Set this acoustic stem as the master audio track and compute 3-band FFT"
                          >
                            <Music class="w-3 h-3 mr-1 text-cyan-400" />
                            Set Master Audio
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => toggleAudioPreview(item.url)}
                            class="px-2"
                            title="Toggle preview playback"
                          >
                            <Volume2 class="w-3 h-3" />
                          </Button>
                        </Show>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </Modal>
  );
};
