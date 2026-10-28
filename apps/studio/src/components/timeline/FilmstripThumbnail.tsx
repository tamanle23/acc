import React, { useMemo } from 'react';
import { AssetTextureCache } from '../../lib/textures/AssetTextureCache';

interface FilmstripThumbnailProps {
  assetId: string;
  width: number;
  height: number;
}

export function FilmstripThumbnail({ assetId, width, height }: FilmstripThumbnailProps) {
  const thumbUrl = useMemo(() => {
    if (!assetId) return null;
    const url = AssetTextureCache.getInstance().getThumbnailDataUrl(assetId, 120, 68);
    return url && url.trim().length > 0 ? url : null;
  }, [assetId]);

  // Do not render anything if no valid thumbnail URL is available
  // This prevents rendering <img src="" /> which triggers browser page re-download warnings
  if (!thumbUrl) {
    return null;
  }

  // Compute how many thumbnail frames fit across the width
  const thumbWidth = 60; // 60px per thumbnail slice
  const numThumbs = Math.max(1, Math.floor(width / thumbWidth));

  return (
    <div
      className="absolute inset-0 flex overflow-hidden pointer-events-none opacity-40 select-none"
      style={{ height: `${height}px` }}
    >
      {Array.from({ length: numThumbs }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 border-r border-black/40 h-full relative overflow-hidden"
          style={{ width: `${thumbWidth}px` }}
        >
          <img
            src={thumbUrl}
            alt="filmstrip"
            className="w-full h-full object-cover grayscale-25 contrast-110"
          />
        </div>
      ))}
    </div>
  );
}
