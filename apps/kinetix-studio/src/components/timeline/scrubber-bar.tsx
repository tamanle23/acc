import type { Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';

export const ScrubberBar: Component = () => {
  const studio = useStudio();

  return (
    <div class="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={studio.totalFrames - 1}
        value={studio.currentFrame}
        onInput={(e) => {
          studio.setIsPlaying(false);
          studio.setCurrentFrame(Number(e.currentTarget.value));
        }}
        aria-label="Timeline scrubber"
        class="w-full accent-primary cursor-pointer"
      />
    </div>
  );
};
