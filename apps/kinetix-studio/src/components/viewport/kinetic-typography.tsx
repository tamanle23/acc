import { For, type Component, type JSX } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import { cn } from '@/lib/utils';

export interface KineticTypographyProps {
  alignClass: string;
}

export const KineticTypography: Component<KineticTypographyProps> = (props) => {
  const studio = useStudio();

  // Compute Per-Line Kinetic Typography Styles
  const getHeadlineLineStyle = (lineIdx: number): JSX.CSSProperties => {
    const theta = studio.rawProgress * Math.PI * 2;
    const phaseOffset = (lineIdx * studio.state.staggerMs) / 240;
    const wave = Math.sin(theta - phaseOffset);
    const cosWave = Math.cos(theta - phaseOffset);
    const focusMultiplier = studio.state.primaryFocusZone === 'headline' ? 1.35 : 0.85;
    const amp = studio.choreo.typeEnergyScale * focusMultiplier;

    let transform = `translateY(${(1 - studio.choreo.headlineReveal) * 24}px)`;
    let letterSpacing = '-0.03em';
    let textShadow = 'none';
    let WebkitTextStroke = '0px transparent';
    let color = lineIdx === 1 ? studio.state.palette.accent : studio.state.palette.ink;
    let opacity = studio.choreo.headlineReveal;

    switch (studio.state.kineticTypeId) {
      case 'weight-wave':
        transform += ` scaleY(${1 + wave * 0.14 * amp}) translateX(${wave * 6 * amp}px)`;
        break;
      case 'track-expand':
        letterSpacing = `${(0.02 + Math.abs(wave) * 0.14 * amp).toFixed(3)}em`;
        break;
      case 'perspective-shear':
        transform += ` perspective(360px) rotateY(${wave * 22 * amp}deg) skewY(${cosWave * 4 * amp}deg)`;
        break;
      case 'slide-shear':
        transform += ` translateX(${wave * 14 * amp}px) skewX(${wave * -12 * amp}deg)`;
        break;
      case 'cylinder-3d':
        transform += ` perspective(420px) rotateX(${wave * 32 * amp}deg) translateZ(${cosWave * 10 * amp}px)`;
        break;
      case 'rgb-glitch': {
        const split = (2.5 + Math.abs(wave) * 5) * amp;
        textShadow = `${split}px 0px 0px ${studio.state.palette.accent}, ${-split}px 0px 0px ${studio.state.palette.accent2}`;
        transform += ` translateX(${Math.round(wave * 3 * amp)}px)`;
        break;
      }
      case 'bounce-floor':
        transform += ` translateY(${-Math.abs(wave) * 16 * amp}px) scaleY(${1 - Math.abs(cosWave) * 0.08 * amp})`;
        break;
      case 'strobe-gate':
        opacity = studio.choreo.headlineReveal * (0.55 + 0.45 * Math.sin(theta * 2 - lineIdx));
        break;
      case 'accordion':
        transform += ` scaleY(${0.78 + (wave + 1) * 0.25 * amp})`;
        break;
      case 'pendulum':
        transform += ` rotate(${wave * 5 * amp}deg)`;
        break;
      case 'orbital-swirl':
        transform += ` translate(${wave * 8 * amp}px, ${cosWave * 5 * amp}px)`;
        break;
      case 'outline-breathe':
        if (lineIdx !== 1) {
          color = 'transparent';
          WebkitTextStroke = `1.5px ${studio.state.palette.ink}`;
        }
        textShadow = `0 0 ${Math.max(0, 14 * Math.abs(wave) * amp)}px ${studio.state.palette.accent}`;
        break;
      default:
        break;
    }

    return {
      transform,
      'letter-spacing': letterSpacing,
      'text-shadow': textShadow,
      '-webkit-text-stroke': WebkitTextStroke,
      color,
      opacity,
      transition: 'color 150ms ease',
    };
  };

  return (
    <div
      class={cn('relative py-1.5 px-2 rounded flex flex-col', props.alignClass)}
      style={{
        background:
          studio.wcagContrast < 4.5
            ? 'linear-gradient(180deg, rgba(0,0,0,0.68), rgba(0,0,0,0.45))'
            : 'transparent',
      }}
    >
      <For each={studio.state.content.headline}>
        {(line, idx) => (
          <div
            style={getHeadlineLineStyle(idx())}
            class={cn(
              'font-black leading-[0.92] tracking-tight uppercase select-none font-display',
              studio.state.layoutId === 'split-stage'
                ? 'text-2xl sm:text-3xl'
                : studio.state.layoutId === 'streetwear-manifesto'
                ? 'text-4xl sm:text-5xl'
                : 'text-3xl sm:text-4xl'
            )}
          >
            {line}
          </div>
        )}
      </For>
    </div>
  );
};
