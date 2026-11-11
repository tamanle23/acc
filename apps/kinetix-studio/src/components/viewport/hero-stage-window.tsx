import type { Component, JSX } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import { cn } from '@/lib/utils';

export interface HeroStageWindowProps {
  heroCanvasRef?: (el: HTMLCanvasElement | null) => void;
  stageClass: string;
  stageStyle: JSX.CSSProperties;
  badgeText: string;
}

export const HeroStageWindow: Component<HeroStageWindowProps> = (props) => {
  const studio = useStudio();

  return (
    <div
      style={props.stageStyle}
      class={cn(
        'relative flex items-center justify-center transition-all duration-300',
        props.stageClass,
        studio.state.heroBreakout ? 'overflow-visible' : 'overflow-hidden'
      )}
    >
      {/* Stage Telemetry Micro-Labels */}
      <div class="absolute top-1.5 left-2.5 right-2.5 flex justify-between text-[11px] font-mono font-medium pointer-events-none select-none">
        <span style={{ color: studio.state.palette.ink }}>
          {props.badgeText} // {studio.state.heroId.toUpperCase()}
        </span>
        <span style={{ color: studio.state.palette.accent }}>
          φ={(studio.rawProgress * Math.PI * 2).toFixed(2)}rad
        </span>
      </div>

      {/* Hero Subject Canvas */}
      <canvas
        ref={props.heroCanvasRef}
        width={280}
        height={240}
        class={cn(
          'w-52 h-44 object-contain pointer-events-none transition-transform',
          studio.state.heroBreakout
            ? 'scale-110 drop-shadow-[0_18px_24px_rgba(0,0,0,0.85)]'
            : ''
        )}
      />
    </div>
  );
};
