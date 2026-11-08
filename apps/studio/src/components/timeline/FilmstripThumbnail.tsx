import { createMemo, Show, For } from 'solid-js';
import { AssetTextureCache } from '../../lib/textures/AssetTextureCache';

interface FilmstripThumbnailProps {
  assetId: string;
  width: number;
  height: number;
}

export function FilmstripThumbnail(props: FilmstripThumbnailProps) {
  const thumbUrl = createMemo(() => {
    if (!props.assetId) return null;
    const url = AssetTextureCache.getInstance().getThumbnailDataUrl(props.assetId, 120, 68);
    return url && url.trim().length > 0 ? url : null;
  });

  const thumbWidth = 60; // 60px per thumbnail slice
  const thumbsCount = createMemo(() => Math.max(1, Math.floor(props.width / thumbWidth)));
  const thumbsList = createMemo(() => Array.from({ length: thumbsCount() }, (_, i) => i));

  return (
    <Show when={thumbUrl()}>
      {(url) => (
        <div
          class="absolute inset-0 flex overflow-hidden pointer-events-none opacity-40 select-none"
          style={{ height: `${props.height}px` }}
        >
          <For each={thumbsList()}>
            {() => (
              <div
                class="shrink-0 border-r border-black/40 h-full relative overflow-hidden"
                style={{ width: `${thumbWidth}px` }}
              >
                <img
                  src={url()}
                  alt="filmstrip"
                  class="w-full h-full object-cover grayscale-25 contrast-110"
                />
              </div>
            )}
          </For>
        </div>
      )}
    </Show>
  );
}
