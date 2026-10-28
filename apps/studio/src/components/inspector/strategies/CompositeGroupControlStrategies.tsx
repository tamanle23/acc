import React from 'react';
import { Sparkles, Cpu, Zap } from 'lucide-react';
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
export const MotionLifecycleControlStrategy: React.FC<ControlStrategyProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const anim = typeof value === 'object' && value !== null ? value : {};
  const currentPreset = anim.preset || 'none';

  const presets = [
    { id: 'none', label: 'Static', ease: 'linear' },
    { id: 'pop_in', label: 'Pop In', ease: 'elastic.out' },
    { id: 'slide_left', label: 'Slide In', ease: 'power2.out' },
    { id: 'bounce', label: 'Bounce', ease: 'bounce.out' },
    { id: 'overshoot', label: 'Overshoot', ease: 'back.out' },
    { id: 'drift', label: 'Drift', ease: 'power2.inOut' },
  ];

  const handlePresetClick = (p: (typeof presets)[0]) => {
    if (disabled) return;
    if (p.id === 'none') {
      onChange(undefined);
    } else {
      onChange({
        ...anim,
        preset: p.id,
        intro: { durationSec: anim.intro?.durationSec ?? 0.5, ease: p.ease },
        outro: { durationSec: anim.outro?.durationSec ?? 0.3, ease: 'power2.in' },
      });
    }
  };

  return (
    <div
      className={`pt-2 border-t border-glass-border space-y-2.5 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-accent-theme" />
          Motion Preset & Lifecycle
        </span>
        <span className="text-[10px] text-muted-foreground uppercase font-mono">GSAP</span>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {presets.map((p) => {
          const isSelected = currentPreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => handlePresetClick(p)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                isSelected
                  ? 'bg-accent-theme text-primary-foreground shadow-accent-glow'
                  : 'bg-glass-surface border border-glass-border text-muted-foreground hover:text-foreground hover:border-accent-theme/40'
              } disabled:cursor-not-allowed`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
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
          disabled={disabled}
          value={anim.intro?.durationSec ?? 0.4}
          onChange={(v) =>
            !disabled &&
            onChange({
              ...anim,
              intro: { ...(anim.intro || {}), durationSec: v },
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
          disabled={disabled}
          value={anim.outro?.durationSec ?? 0.3}
          onChange={(v) =>
            !disabled &&
            onChange({
              ...anim,
              outro: { ...(anim.outro || {}), durationSec: v },
            })
          }
        />
      </div>

      <EasingCurveSelector
        value={anim.intro?.ease || 'power2.out'}
        onChange={(ease) => {
          if (!disabled) {
            onChange({
              ...anim,
              intro: { ...(anim.intro || {}), ease },
            });
          }
        }}
      />
    </div>
  );
};

/**
 * Strategy 9: ShaderGroupControlStrategy
 * Specialized sub-inspector for bloom and chromatic aberration post-processing shaders.
 */
export const ShaderGroupControlStrategy: React.FC<ControlStrategyProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const shaders = typeof value === 'object' && value !== null ? value : {};
  const bloom = shaders.bloom || { enabled: false, threshold: 0.7, intensity: 1.0 };
  const chromatic = shaders.chromaticAberration || { enabled: false, offsetPx: 2.0 };

  return (
    <div
      className={`pt-2 border-t border-glass-border space-y-2 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-accent-theme" />
          Post-Processing Shaders
        </span>
      </div>

      {/* Bloom */}
      <div className="p-2 rounded bg-glass-surface/60 border border-glass-border space-y-1.5">
        <SwitchControlStrategy
          descriptor={{ key: 'bloomEnabled', label: 'Bloom Glow', type: 'boolean' }}
          value={bloom.enabled}
          disabled={disabled}
          onChange={(en) =>
            !disabled &&
            onChange({
              ...shaders,
              bloom: { ...bloom, enabled: en },
            })
          }
        />
        {bloom.enabled && (
          <div className="grid grid-cols-2 gap-2 pt-1">
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
              value={bloom.threshold ?? 0.7}
              disabled={disabled}
              onChange={(v) =>
                !disabled &&
                onChange({
                  ...shaders,
                  bloom: { ...bloom, threshold: v },
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
              value={bloom.intensity ?? 1.0}
              disabled={disabled}
              onChange={(v) =>
                !disabled &&
                onChange({
                  ...shaders,
                  bloom: { ...bloom, intensity: v },
                })
              }
            />
          </div>
        )}
      </div>

      {/* Chromatic Aberration */}
      <div className="p-2 rounded bg-glass-surface/60 border border-glass-border space-y-1.5">
        <SwitchControlStrategy
          descriptor={{ key: 'chromaticEnabled', label: 'Chromatic Aberration', type: 'boolean' }}
          value={chromatic.enabled}
          disabled={disabled}
          onChange={(en) =>
            !disabled &&
            onChange({
              ...shaders,
              chromaticAberration: { ...chromatic, enabled: en },
            })
          }
        />
        {chromatic.enabled && (
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
            value={chromatic.offsetPx ?? 2.0}
            disabled={disabled}
            onChange={(v) =>
              !disabled &&
              onChange({
                ...shaders,
                chromaticAberration: { ...chromatic, offsetPx: v },
              })
            }
          />
        )}
      </div>
    </div>
  );
};

/**
 * Strategy 10: KaraokeGroupControlStrategy
 * Specialized sub-inspector for timed text active word karaoke effects.
 */
export const KaraokeGroupControlStrategy: React.FC<ControlStrategyProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const karaoke = typeof value === 'object' && value !== null ? value : {};

  return (
    <div
      className={`pt-2 border-t border-glass-border space-y-2 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Active Word Karaoke Highlights
        </span>
      </div>
      <SwitchControlStrategy
        descriptor={{ key: 'activeWordHighlight', label: 'Highlight Active Word', type: 'boolean' }}
        value={karaoke.activeWordHighlight ?? true}
        disabled={disabled}
        onChange={(v) => !disabled && onChange({ ...karaoke, activeWordHighlight: v })}
      />
      <ColorControlStrategy
        descriptor={{
          key: 'glowColor',
          label: 'Highlight Glow Color',
          type: 'color',
          defaultValue: '#ffcc00',
        }}
        value={karaoke.glowColor ?? '#ffcc00'}
        disabled={disabled}
        onChange={(v) => !disabled && onChange({ ...karaoke, glowColor: v })}
      />
    </div>
  );
};

/**
 * Strategy 12: VisionStrategyControlStrategy
 * Renders an AI strategy selector with performance badges ('⚡ Zero-Latency Heuristic' vs '🧠 Neural AI').
 */
export const VisionStrategyControlStrategy: React.FC<ControlStrategyProps> = ({
  descriptor,
  value,
  onChange,
  disabled = false,
}) => {
  const isDepth = descriptor.type === 'vision_depth_strategy';
  const registered = isDepth
    ? VisionEngineRegistry.getRegisteredDepthStrategies()
    : VisionEngineRegistry.getRegisteredSegmentationStrategies();

  const fallbackStrategies = isDepth
    ? [DepthStrategyId.Heuristic, 'depth-anything-v2-small', 'glpn-kitti']
    : [SegmentationStrategyId.GrabCutFallback, 'birefnet-general', 'rmbg-1.4'];

  const effectiveRegistered = registered.length > 0 ? registered : fallbackStrategies;

  const options = effectiveRegistered.map((id) => {
    const isHeuristic =
      id === DepthStrategyId.Heuristic || id === SegmentationStrategyId.GrabCutFallback;
    return {
      value: id,
      label: isHeuristic ? `${id} (⚡ 60fps Zero Latency)` : `${id} (🧠 Neural AI)`,
      isHeuristic,
    };
  });

  const currentVal = value || descriptor.defaultValue || (options[0]?.value ?? '');
  const activeOption = options.find((o) => o.value === currentVal);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <label className="font-medium text-foreground/90 flex items-center gap-1.5">
          {activeOption?.isHeuristic ? (
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Cpu className="w-3.5 h-3.5 text-accent-theme" />
          )}
          {descriptor.label}
        </label>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono border ${
            activeOption?.isHeuristic
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-accent-theme/10 text-accent-theme border-accent-theme/20'
          }`}
        >
          {activeOption?.isHeuristic ? 'HEURISTIC' : 'NEURAL'}
        </span>
      </div>

      <select
        value={currentVal}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background/50 border border-input rounded-md px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent-theme transition-colors disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {descriptor.description && (
        <p className="text-[10px] text-muted-foreground">{descriptor.description}</p>
      )}
    </div>
  );
};

/**
 * Strategy 13: LightVectorControlStrategy
 * Renders an intuitive 2D azimuth / elevation directional pad for positioning 3D relighting sources.
 */
export const LightVectorControlStrategy: React.FC<ControlStrategyProps> = ({
  descriptor,
  value,
  onChange,
  disabled = false,
}) => {
  const lightX = typeof value?.x === 'number' ? value.x : 0;
  const lightY = typeof value?.y === 'number' ? value.y : 0;

  const handlePadClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // [-1, 1]
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1; // [-1, 1]
    onChange({ x: Number(nx.toFixed(2)), y: Number(ny.toFixed(2)) });
  };

  return (
    <div className="flex flex-col gap-2 p-2 rounded-lg bg-background/40 border border-glass-border">
      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>{descriptor.label || '3D Light Direction'}</span>
        <span className="text-accent-theme font-bold">
          X: {lightX.toFixed(2)} | Y: {lightY.toFixed(2)}
        </span>
      </div>
      <div
        onClick={handlePadClick}
        className="relative w-full h-24 rounded-md border border-glass-border/60 bg-black/40 cursor-crosshair overflow-hidden flex items-center justify-center"
      >
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-15 pointer-events-none">
          <div className="border-r border-b border-foreground/40" />
          <div className="border-b border-foreground/40" />
          <div className="border-r border-foreground/40" />
          <div />
        </div>
        <div
          style={{
            transform: `translate(${lightX * 40}px, ${lightY * 40}px)`,
          }}
          className="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] border border-white transition-transform duration-75 pointer-events-none"
        />
      </div>
    </div>
  );
};
