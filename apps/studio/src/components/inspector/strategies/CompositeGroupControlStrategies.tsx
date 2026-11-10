import { Show, For } from 'solid-js';
import { Sparkles, Cpu, Zap } from 'lucide-solid';
import { VisionEngineRegistry, DepthStrategyId, SegmentationStrategyId } from '@acc/core-isomorphic';
import { EasingCurveSelector } from '../../EasingCurveSelector';
import {
  type ControlStrategyProps,
  NumberControlStrategy,
  SwitchControlStrategy,
  ColorControlStrategy,
} from './PrimitiveControlStrategies';

/**
 * Strategy 8: MotionLifecycleControlStrategy
 * Renders full GSAP Motion Preset lifecycle controls (Static, Pop In, Slide In, Bounce, Overshoot, Drift),
 * along with duration sliders and easing curve selector.
 */
export function MotionLifecycleControlStrategy(props: ControlStrategyProps) {
  const anim = () => (typeof props.value === 'object' && props.value !== null ? props.value : {});
  const currentPreset = () => anim().preset || 'none';

  const presets = [
    { id: 'none', label: 'Static', ease: 'linear' },
    { id: 'pop_in', label: 'Pop In', ease: 'elastic.out' },
    { id: 'slide_left', label: 'Slide In', ease: 'power2.out' },
    { id: 'bounce', label: 'Bounce', ease: 'bounce.out' },
    { id: 'overshoot', label: 'Overshoot', ease: 'back.out' },
    { id: 'drift', label: 'Drift', ease: 'power2.inOut' },
  ];

  const handlePresetClick = (p: (typeof presets)[0]) => {
    if (props.disabled) return;
    if (p.id === 'none') {
      props.onChange(undefined);
    } else {
      props.onChange({
        ...anim(),
        preset: p.id,
        intro: { durationSec: anim().intro?.durationSec ?? 0.5, ease: p.ease },
        outro: { durationSec: anim().outro?.durationSec ?? 0.3, ease: 'power2.in' },
      });
    }
  };

  return (
    <div
      class={`pt-2 border-t border-glass-border space-y-2.5 ${
        props.disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Sparkles class="w-3 h-3 text-accent-theme" />
          Motion Preset & Lifecycle
        </span>
        <span class="text-[10px] text-muted-foreground uppercase font-mono">GSAP</span>
      </div>

      <div class="flex items-center gap-1 flex-wrap">
        <For each={presets}>
          {(p) => {
            const isSelected = () => currentPreset() === p.id;
            return (
              <button
                type="button"
                disabled={props.disabled}
                onClick={() => handlePresetClick(p)}
                class={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                  isSelected()
                    ? 'bg-accent-theme text-primary-foreground shadow-accent-glow'
                    : 'bg-glass-surface border border-glass-border text-muted-foreground hover:text-foreground hover:border-accent-theme/40'
                } disabled:cursor-not-allowed`}
              >
                {p.label}
              </button>
            );
          }}
        </For>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <NumberControlStrategy
          descriptor={{
            key: 'introDuration',
            label: 'Intro Duration',
            type: 'number',
            min: 0.1,
            max: 2.0,
            step: 0.05,
            defaultValue: 0.4,
            unit: 's',
          }}
          disabled={props.disabled}
          value={anim().intro?.durationSec ?? 0.4}
          onChange={(v) =>
            !props.disabled &&
            props.onChange({
              ...anim(),
              intro: { ...(anim().intro || {}), durationSec: v },
            })
          }
        />
        <NumberControlStrategy
          descriptor={{
            key: 'outroDuration',
            label: 'Outro Duration',
            type: 'number',
            min: 0.1,
            max: 1.5,
            step: 0.05,
            defaultValue: 0.3,
            unit: 's',
          }}
          disabled={props.disabled}
          value={anim().outro?.durationSec ?? 0.3}
          onChange={(v) =>
            !props.disabled &&
            props.onChange({
              ...anim(),
              outro: { ...(anim().outro || {}), durationSec: v },
            })
          }
        />
      </div>

      <EasingCurveSelector
        value={anim().intro?.ease || 'power2.out'}
        onChange={(ease) => {
          if (!props.disabled) {
            props.onChange({
              ...anim(),
              intro: { ...(anim().intro || {}), ease },
            });
          }
        }}
      />
    </div>
  );
}

/**
 * Strategy 9: ShaderGroupControlStrategy
 * Specialized sub-inspector for bloom and chromatic aberration post-processing shaders.
 */
export function ShaderGroupControlStrategy(props: ControlStrategyProps) {
  const shaders = () => (typeof props.value === 'object' && props.value !== null ? props.value : {});
  const bloom = () => shaders().bloom || { enabled: false, threshold: 0.7, intensity: 1.0 };
  const chromatic = () => shaders().chromaticAberration || { enabled: false, offsetPx: 2.0 };

  return (
    <div
      class={`pt-2 border-t border-glass-border space-y-2 ${
        props.disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Sparkles class="w-3 h-3 text-accent-theme" />
          Post-Processing Shaders
        </span>
      </div>

      {/* Bloom */}
      <div class="p-2 rounded bg-glass-surface/60 border border-glass-border space-y-1.5">
        <SwitchControlStrategy
          descriptor={{ key: 'bloomEnabled', label: 'Bloom Glow', type: 'boolean' }}
          value={bloom().enabled}
          disabled={props.disabled}
          onChange={(en) =>
            !props.disabled &&
            props.onChange({
              ...shaders(),
              bloom: { ...bloom(), enabled: en },
            })
          }
        />
        <Show when={bloom().enabled}>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <NumberControlStrategy
              descriptor={{
                key: 'threshold',
                label: 'Threshold',
                type: 'number',
                min: 0,
                max: 1,
                step: 0.05,
                defaultValue: 0.7,
              }}
              value={bloom().threshold ?? 0.7}
              disabled={props.disabled}
              onChange={(v) =>
                !props.disabled &&
                props.onChange({
                  ...shaders(),
                  bloom: { ...bloom(), threshold: v },
                })
              }
            />
            <NumberControlStrategy
              descriptor={{
                key: 'intensity',
                label: 'Intensity',
                type: 'number',
                min: 0.1,
                max: 3,
                step: 0.1,
                defaultValue: 1.0,
              }}
              value={bloom().intensity ?? 1.0}
              disabled={props.disabled}
              onChange={(v) =>
                !props.disabled &&
                props.onChange({
                  ...shaders(),
                  bloom: { ...bloom(), intensity: v },
                })
              }
            />
          </div>
        </Show>
      </div>

      {/* Chromatic Aberration */}
      <div class="p-2 rounded bg-glass-surface/60 border border-glass-border space-y-1.5">
        <SwitchControlStrategy
          descriptor={{ key: 'chromaticEnabled', label: 'Chromatic Aberration', type: 'boolean' }}
          value={chromatic().enabled}
          disabled={props.disabled}
          onChange={(en) =>
            !props.disabled &&
            props.onChange({
              ...shaders(),
              chromaticAberration: { ...chromatic(), enabled: en },
            })
          }
        />
        <Show when={chromatic().enabled}>
          <NumberControlStrategy
            descriptor={{
              key: 'offsetPx',
              label: 'Color Offset',
              type: 'number',
              min: 0,
              max: 10,
              step: 0.5,
              defaultValue: 2.0,
              unit: 'px',
            }}
            value={chromatic().offsetPx ?? 2.0}
            disabled={props.disabled}
            onChange={(v) =>
              !props.disabled &&
              props.onChange({
                ...shaders(),
                chromaticAberration: { ...chromatic(), offsetPx: v },
              })
            }
          />
        </Show>
      </div>
    </div>
  );
}

/**
 * Strategy 10: KaraokeGroupControlStrategy
 * Specialized sub-inspector for timed text active word karaoke effects.
 */
export function KaraokeGroupControlStrategy(props: ControlStrategyProps) {
  const karaoke = () => (typeof props.value === 'object' && props.value !== null ? props.value : {});

  return (
    <div
      class={`pt-2 border-t border-glass-border space-y-2 ${
        props.disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Sparkles class="w-3 h-3 text-amber-400" />
          Active Word Karaoke Highlights
        </span>
      </div>
      <SwitchControlStrategy
        descriptor={{ key: 'activeWordHighlight', label: 'Highlight Active Word', type: 'boolean' }}
        value={karaoke().activeWordHighlight ?? true}
        disabled={props.disabled}
        onChange={(v) => !props.disabled && props.onChange({ ...karaoke(), activeWordHighlight: v })}
      />
      <ColorControlStrategy
        descriptor={{
          key: 'glowColor',
          label: 'Highlight Glow Color',
          type: 'color',
          defaultValue: '#ffcc00',
        }}
        value={karaoke().glowColor ?? '#ffcc00'}
        disabled={props.disabled}
        onChange={(v) => !props.disabled && props.onChange({ ...karaoke(), glowColor: v })}
      />
    </div>
  );
}

/**
 * Strategy 12: VisionStrategyControlStrategy
 * Renders an AI strategy selector with performance badges ('⚡ Zero-Latency Heuristic' vs '🧠 Neural AI').
 */
export function VisionStrategyControlStrategy(props: ControlStrategyProps) {
  const isDepth = () => props.descriptor.type === 'vision_depth_strategy';
  const registered = () =>
    isDepth()
      ? VisionEngineRegistry.getRegisteredDepthStrategies()
      : VisionEngineRegistry.getRegisteredSegmentationStrategies();

  const fallbackStrategies = () =>
    isDepth()
      ? [DepthStrategyId.Heuristic, 'depth-anything-v2-small', 'glpn-kitti']
      : [SegmentationStrategyId.GrabCutFallback, 'birefnet-general', 'rmbg-1.4'];

  const effectiveRegistered = () => (registered().length > 0 ? registered() : fallbackStrategies());

  const options = () =>
    effectiveRegistered().map((id) => {
      const isHeuristic =
        id === DepthStrategyId.Heuristic || id === SegmentationStrategyId.GrabCutFallback;
      return {
        value: id,
        label: isHeuristic ? `${id} (⚡ 60fps Zero Latency)` : `${id} (🧠 Neural AI)`,
        isHeuristic,
      };
    });

  const currentVal = () => props.value || props.descriptor.defaultValue || (options()[0]?.value ?? '');
  const activeOption = () => options().find((o) => o.value === currentVal());

  return (
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-[11px] text-muted-foreground">
        <label class="font-medium text-foreground/90 flex items-center gap-1.5">
          <Show
            when={activeOption()?.isHeuristic}
            fallback={<Cpu class="w-3.5 h-3.5 text-accent-theme" />}
          >
            <Zap class="w-3.5 h-3.5 text-amber-400" />
          </Show>
          {props.descriptor.label}
        </label>
        <span
          class={`px-1.5 py-0.5 rounded-full text-[9px] font-mono border ${
            activeOption()?.isHeuristic
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-accent-theme/10 text-accent-theme border-accent-theme/20'
          }`}
        >
          {activeOption()?.isHeuristic ? 'HEURISTIC' : 'NEURAL'}
        </span>
      </div>

      <select
        value={currentVal()}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.currentTarget.value)}
        class="w-full bg-background/50 border border-input rounded-md px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent-theme transition-colors disabled:opacity-50"
      >
        <For each={options()}>
          {(opt) => (
            <option value={opt.value}>
              {opt.label}
            </option>
          )}
        </For>
      </select>
      <Show when={props.descriptor.description}>
        <p class="text-[10px] text-muted-foreground">{props.descriptor.description}</p>
      </Show>
    </div>
  );
}

/**
 * Strategy 13: LightVectorControlStrategy
 * Renders an intuitive 2D azimuth / elevation directional pad for positioning 3D relighting sources.
 */
export function LightVectorControlStrategy(props: ControlStrategyProps) {
  const lightX = () => (typeof props.value?.x === 'number' ? props.value.x : 0);
  const lightY = () => (typeof props.value?.y === 'number' ? props.value.y : 0);

  const handlePadClick = (e: MouseEvent) => {
    if (props.disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // [-1, 1]
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1; // [-1, 1]
    props.onChange({ x: Number(nx.toFixed(2)), y: Number(ny.toFixed(2)) });
  };

  return (
    <div class="flex flex-col gap-2 p-2 rounded-lg bg-background/40 border border-glass-border">
      <div class="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>{props.descriptor.label || '3D Light Direction'}</span>
        <span class="text-accent-theme font-bold">
          X: {lightX().toFixed(2)} | Y: {lightY().toFixed(2)}
        </span>
      </div>
      <div
        onClick={handlePadClick}
        class="relative w-full h-24 rounded-md border border-glass-border/60 bg-black/40 cursor-crosshair overflow-hidden flex items-center justify-center"
      >
        <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-15 pointer-events-none">
          <div class="border-r border-b border-foreground/40" />
          <div class="border-b border-foreground/40" />
          <div class="border-r border-foreground/40" />
          <div />
        </div>
        <div
          style={{
            transform: `translate(${lightX() * 40}px, ${lightY() * 40}px)`,
          }}
          class="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] border border-white transition-transform duration-75 pointer-events-none"
        />
      </div>
    </div>
  );
}
