import React from 'react';
import { Plus, Trash2, Crosshair, Sparkles, Volume2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import type { ParamFieldDescriptor } from '@acc/ir';
import type { PartialVFXRegionConfig } from '@acc/ir';
import { ProceduralAudioSynthesizer } from '@acc/ir';
import { EasingCurveSelector } from '../EasingCurveSelector';
import { IRStateManager } from '../../lib/ir/irState';

export interface ControlStrategyProps {
  descriptor: ParamFieldDescriptor;
  value: any;
  onChange: (newValue: any) => void;
  disabled?: boolean;
}

/**
 * Strategy 1: NumberControlStrategy
 * Renders a synchronized slider + numerical input with double-click-to-reset and unit badges.
 */
export const NumberControlStrategy: React.FC<ControlStrategyProps> = ({
  descriptor,
  value,
  onChange,
  disabled = false,
}) => {
  const min = descriptor.min ?? 0;
  const max = descriptor.max ?? 100;
  const step = descriptor.step ?? 1;
  const defaultVal = typeof descriptor.defaultValue === 'number' ? descriptor.defaultValue : min;
  const numericVal = typeof value === 'number' && !Number.isNaN(value) ? value : defaultVal;

  const [localVal, setLocalVal] = React.useState(String(numericVal));

  React.useEffect(() => {
    setLocalVal(String(numericVal));
  }, [numericVal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setLocalVal(e.target.value);
    const num = parseFloat(e.target.value);
    if (!Number.isNaN(num)) {
      onChange(Math.max(min, Math.min(max, num)));
    }
  };

  return (
    <div className={`space-y-1 ${disabled ? 'pointer-events-none' : ''}`}>
      <div className="flex justify-between items-center text-[11px]">
        <span
          onDoubleClick={() => !disabled && onChange(defaultVal)}
          className={` select-none ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer '
          } transition-colors`}
          title={disabled ? undefined : "Double-click to reset to default"}
        >
          {descriptor.label}
        </span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step={step}
            value={localVal}
            disabled={disabled}
            onChange={handleInputChange}
            className="w-14 h-5 text-[10px] text-right font-mono px-1 py-0 "
          />
          {descriptor.unit && (
            <span className="text-[10px]  font-mono">{descriptor.unit}</span>
          )}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={[numericVal]}
        onValueChange={(v) => !disabled && onChange(v[0])}
      />
    </div>
  );
};

/**
 * Strategy 2: SwitchControlStrategy
 * Renders a boolean toggle switch.
 */
export const SwitchControlStrategy: React.FC<ControlStrategyProps> = ({
  descriptor,
  value,
  onChange,
  disabled = false,
}) => {
  const checked = typeof value === 'boolean' ? value : Boolean(descriptor.defaultValue);

  return (
    <div className={`flex items-center justify-between py-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
        {descriptor.label}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={(c) => !disabled && onChange(c)} />
    </div>
  );
};

/**
 * Strategy 3: SelectControlStrategy
 * Renders a clean dropdown select menu for enumerated options.
 */
export const SelectControlStrategy: React.FC<ControlStrategyProps> = ({
  descriptor,
  value,
  onChange,
  disabled = false,
}) => {
  const currentVal = value ?? descriptor.defaultValue ?? descriptor.options?.[0]?.value ?? '';

  return (
    <div className={`space-y-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
        {descriptor.label}
      </label>
      <select
        value={String(currentVal)}
        disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.value)}
        className="w-full h-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed"
      >
        {(descriptor.options || []).map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * Strategy 4: ColorControlStrategy
 * Renders a dual color swatch + hex input.
 */
export const ColorControlStrategy: React.FC<ControlStrategyProps> = ({
  descriptor,
  value,
  onChange,
  disabled = false,
}) => {
  const colorVal = typeof value === 'string' && value.startsWith('#') ? value : (descriptor.defaultValue || '#00ffff');

  return (
    <div className={`flex items-center justify-between pt-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
        {descriptor.label}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          disabled={disabled}
          value={colorVal.slice(0, 7)}
          onChange={(e) => !disabled && onChange(e.target.value)}
          className="w-6 h-6 rounded border border-slate-200 dark:border-white/10 cursor-pointer p-0 bg-transparent disabled:cursor-not-allowed"
        />
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
          {colorVal}
        </span>
      </div>
    </div>
  );
};

/**
 * Strategy 5: StringControlStrategy
 * Renders a compact text input field.
 */
export const StringControlStrategy: React.FC<ControlStrategyProps> = ({
  descriptor,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className={`space-y-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block">
        {descriptor.label}
      </span>
      <Input
        type="text"
        disabled={disabled}
        value={String(value ?? descriptor.defaultValue ?? '')}
        onChange={(e) => !disabled && onChange(e.target.value)}
        className="w-full h-7 px-2 text-xs font-mono rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 disabled:cursor-not-allowed"
      />
    </div>
  );
};

/**
 * Strategy 6: RegionsArrayControlStrategy (Specialized for vfx/partial)
 * Renders an interactive 2D coordinate pad and per-region cards for spotlights, glitches, blurs, and spark emitters.
 */
export const RegionsArrayControlStrategy: React.FC<ControlStrategyProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const regions: PartialVFXRegionConfig[] = Array.isArray(value) ? value : [];
  const [selectedIdx, setSelectedIdx] = React.useState<number>(0);

  const activeIndex = Math.max(0, Math.min(regions.length - 1, selectedIdx));
  const activeRegion = regions[activeIndex];

  const handleAddRegion = () => {
    if (disabled) return;
    const newRegion: PartialVFXRegionConfig = {
      type: 'spotlight',
      x: 0.5,
      y: 0.5,
      radius: 180,
      width: 0.35,
      height: 0.25,
      intensity: 1.5,
      color: '#00ffff',
    };
    const next = [...regions, newRegion];
    onChange(next);
    setSelectedIdx(next.length - 1);
  };

  const handleRemoveRegion = (idx: number) => {
    if (disabled) return;
    const next = regions.filter((_, i) => i !== idx);
    onChange(next);
    setSelectedIdx(Math.max(0, idx - 1));
  };

  const updateRegion = (idx: number, patch: Partial<PartialVFXRegionConfig>) => {
    if (disabled) return;
    const next = regions.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const handlePadPointer = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !activeRegion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, Number(((e.clientX - rect.left) / rect.width).toFixed(2))));
    const normY = Math.max(0, Math.min(1, Number(((e.clientY - rect.top) / rect.height).toFixed(2))));
    updateRegion(activeIndex, { x: normX, y: normY });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Localized Regions ({regions.length})
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddRegion}
          className="h-5 px-1.5 text-[10px] gap-1 border-cyan-500/30 text-cyan-600 dark:text-cyan-400"
        >
          <Plus className="w-3 h-3" />
          Add Region
        </Button>
      </div>

      {regions.length === 0 ? (
        <div className="p-3 text-center text-[10px] text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded">
          No regions active. Click &quot;+ Add Region&quot; to place a spotlight or glitch zone.
        </div>
      ) : (
        <>
          {/* Region Selector Pills */}
          <div className="flex flex-wrap gap-1">
            {regions.map((reg, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                  idx === activeIndex
                    ? 'bg-cyan-500/15 border-cyan-500 text-cyan-600 dark:text-cyan-300 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                }`}
                onClick={() => setSelectedIdx(idx)}
              >
                <span>#{idx + 1} {reg.type}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveRegion(idx);
                  }}
                  className="hover:text-rose-500 ml-0.5"
                  title="Delete region"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>

          {activeRegion && (
            <div className="p-2.5 rounded-md border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 space-y-2.5">
              {/* Interactive 2D Coordinate Pad */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-cyan-400" />
                    2D Region Target Pad (Click to position)
                  </span>
                  <span>
                    ({Math.round((activeRegion.x ?? 0.5) * 100)}%, {Math.round((activeRegion.y ?? 0.5) * 100)}%)
                  </span>
                </div>
                <div
                  onClick={handlePadPointer}
                  className="relative w-full h-24 rounded border border-slate-300 dark:border-slate-700 bg-slate-950 overflow-hidden cursor-crosshair select-none"
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-20">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className="border border-cyan-500/30" />
                    ))}
                  </div>
                  {/* Reticle marker */}
                  <div
                    style={{
                      left: `${(activeRegion.x ?? 0.5) * 100}%`,
                      top: `${(activeRegion.y ?? 0.5) * 100}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-cyan-400 shadow-[0_0_10px_#00ffff] pointer-events-none flex items-center justify-center"
                  >
                    <div className="w-1 h-1 rounded-full bg-white" />
                  </div>
                </div>
              </div>

              {/* Region Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 block">
                  Effect Type
                </label>
                <select
                  value={activeRegion.type || 'spotlight'}
                  onChange={(e) => updateRegion(activeIndex, { type: e.target.value })}
                  className="w-full h-6 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-1.5 text-[11px]"
                >
                  <option value="spotlight">Spotlight Beam</option>
                  <option value="glitch">Chromatic Glitch Slice</option>
                  <option value="blur">Frosted Glass Blur</option>
                  <option value="point_emitter">Spark Point Emitter</option>
                </select>
              </div>

              <NumberControlStrategy
                descriptor={{
                  key: 'x',
                  label: 'Center X',
                  type: 'number',
                  min: 0,
                  max: 1,
                  step: 0.01,
                  defaultValue: 0.5,
                }}
                value={activeRegion.x ?? 0.5}
                onChange={(v) => updateRegion(activeIndex, { x: v })}
              />

              <NumberControlStrategy
                descriptor={{
                  key: 'y',
                  label: 'Center Y',
                  type: 'number',
                  min: 0,
                  max: 1,
                  step: 0.01,
                  defaultValue: 0.5,
                }}
                value={activeRegion.y ?? 0.5}
                onChange={(v) => updateRegion(activeIndex, { y: v })}
              />

              {(activeRegion.type === 'spotlight' || activeRegion.type === 'point_emitter') ? (
                <NumberControlStrategy
                  descriptor={{
                    key: 'radius',
                    label: 'Radius',
                    type: 'number',
                    min: 20,
                    max: 600,
                    step: 5,
                    defaultValue: 180,
                    unit: 'px',
                  }}
                  value={activeRegion.radius ?? 180}
                  onChange={(v) => updateRegion(activeIndex, { radius: v })}
                />
              ) : (
                <>
                  <NumberControlStrategy
                    descriptor={{
                      key: 'width',
                      label: 'Zone Width',
                      type: 'number',
                      min: 0.05,
                      max: 1.0,
                      step: 0.05,
                      defaultValue: 0.35,
                    }}
                    value={activeRegion.width ?? 0.35}
                    onChange={(v) => updateRegion(activeIndex, { width: v })}
                  />
                  <NumberControlStrategy
                    descriptor={{
                      key: 'height',
                      label: 'Zone Height',
                      type: 'number',
                      min: 0.05,
                      max: 1.0,
                      step: 0.05,
                      defaultValue: 0.25,
                    }}
                    value={activeRegion.height ?? 0.25}
                    onChange={(v) => updateRegion(activeIndex, { height: v })}
                  />
                </>
              )}

              <NumberControlStrategy
                descriptor={{
                  key: 'intensity',
                  label: 'Effect Intensity',
                  type: 'number',
                  min: 0.1,
                  max: 4.0,
                  step: 0.1,
                  defaultValue: 1.5,
                }}
                value={activeRegion.intensity ?? 1.5}
                onChange={(v) => updateRegion(activeIndex, { intensity: v })}
              />

              <ColorControlStrategy
                descriptor={{
                  key: 'color',
                  label: 'Tint Color',
                  type: 'color',
                  defaultValue: '#00ffff',
                }}
                value={activeRegion.color ?? '#00ffff'}
                onChange={(v) => updateRegion(activeIndex, { color: v })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Strategy 7: CurveControlStrategy
 * Renders GSAP easing curve preview and selector with animated travel path.
 */
export const CurveControlStrategy: React.FC<ControlStrategyProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="pt-1">
      <EasingCurveSelector
        value={typeof value === 'string' ? value : 'power2.out'}
        onChange={(ease) => onChange(ease)}
      />
    </div>
  );
};

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

  const handlePresetClick = (p: typeof presets[0]) => {
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
    <div className={`pt-2 border-t border-slate-200 dark:border-white/10 space-y-2.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
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
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
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
            !disabled && onChange({
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
            !disabled && onChange({
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
    <div className={`pt-2 border-t border-slate-200 dark:border-white/10 space-y-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          Post-Processing Shaders
        </span>
      </div>

      {/* Bloom */}
      <div className="p-2 rounded bg-slate-50 dark:bg-white/5 space-y-1.5">
        <SwitchControlStrategy
          descriptor={{ key: 'bloomEnabled', label: 'Bloom Glow', type: 'boolean' }}
          value={bloom.enabled}
          disabled={disabled}
          onChange={(en) =>
            !disabled && onChange({
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
                !disabled && onChange({
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
                !disabled && onChange({
                  ...shaders,
                  bloom: { ...bloom, intensity: v },
                })
              }
            />
          </div>
        )}
      </div>

      {/* Chromatic Aberration */}
      <div className="p-2 rounded bg-slate-50 dark:bg-white/5 space-y-1.5">
        <SwitchControlStrategy
          descriptor={{ key: 'chromaticEnabled', label: 'Chromatic Aberration', type: 'boolean' }}
          value={chromatic.enabled}
          disabled={disabled}
          onChange={(en) =>
            !disabled && onChange({
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
              !disabled && onChange({
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
    <div className={`pt-2 border-t border-slate-200 dark:border-white/10 space-y-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
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
 * Strategy 11: SFXActionsControlStrategy
 * Renders Audition SFX and Add to Timeline action buttons with live Web Audio synthesis.
 */
export const SFXActionsControlStrategy: React.FC<ControlStrategyProps> = ({
  value,
  disabled = false,
}) => {
  const [isPlayingAudition, setIsPlayingAudition] = React.useState(false);

  const handleAuditionSFX = (synthType: string = 'whoosh', durationSec: number = 1.5) => {
    if (disabled) return;
    setIsPlayingAudition(true);
    let buf: Float32Array;
    switch (synthType) {
      case 'whoosh':
        buf = ProceduralAudioSynthesizer.synthWhoosh(0, durationSec);
        break;
      case 'impact':
        buf = ProceduralAudioSynthesizer.synthImpact(0, durationSec);
        break;
      case 'glitch':
        buf = ProceduralAudioSynthesizer.synthGlitch(0, durationSec);
        break;
      case 'riser':
        buf = ProceduralAudioSynthesizer.synthRiser(0, durationSec);
        break;
      case 'laser':
      default:
        buf = ProceduralAudioSynthesizer.synthLaserSFX(0, durationSec);
        break;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const audioBuf = ctx.createBuffer(1, buf.length, 44100);
        audioBuf.copyToChannel(buf, 0);
        const source = ctx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (e) {
      console.warn('Audio audition error:', e);
    }

    setTimeout(() => setIsPlayingAudition(false), Math.min(2000, durationSec * 1000));
  };

  const handleInsertProceduralSFX = (
    synthType: string = 'whoosh',
    durationSec: number = 1.5,
    duckingFactor: number = 0.75
  ) => {
    if (disabled) return;
    const startFrame = 0;
    const durationFrames = Math.round(durationSec * 30);
    const seq = {
      id: `seq-sfx-${synthType}-${Date.now()}`,
      name: `${synthType.toUpperCase()} SFX`,
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'sfx/procedural',
          params: {
            synthType,
            durationSec,
            duckingFactor,
            label: synthType.toUpperCase(),
          },
        },
      ],
    };
    IRStateManager.getInstance().addSequence('track-audio', seq as any, {
      trackTypeFallback: 'audio',
      trackNameFallback: 'Master Audio Track',
    });
  };

  const currentType = value?.synthType || value?.sfxType || 'whoosh';
  const durationSec = value?.durationSec ?? 1.5;
  const ducking = value?.duckingFactor ?? 0.75;

  return (
    <div className={`pt-2 border-t border-slate-200 dark:border-white/10 flex items-center gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAuditionSFX(currentType, durationSec)}
        disabled={disabled || isPlayingAudition}
        className="flex-1 text-[11px] font-mono gap-1.5 cursor-pointer hover:border-indigo-500 hover:text-indigo-500 disabled:cursor-not-allowed"
      >
        <Volume2
          className={`w-3.5 h-3.5 ${
            isPlayingAudition ? 'text-indigo-500 animate-pulse' : ''
          }`}
        />
        {isPlayingAudition ? 'Playing...' : 'Audition SFX'}
      </Button>

      <Button
        size="sm"
        disabled={disabled}
        onClick={() => handleInsertProceduralSFX(currentType, durationSec, ducking)}
        className="flex-1 text-[11px] font-mono gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer disabled:cursor-not-allowed"
      >
        <Plus className="w-3.5 h-3.5" />
        Insert to Track
      </Button>
    </div>
  );
};

/**
 * Control Strategy Factory:
 * Resolves the appropriate UI control strategy component for any ParamFieldDescriptor.
 */
export function resolveParamControlStrategy(
  descriptor: ParamFieldDescriptor
): React.FC<ControlStrategyProps> {
  switch (descriptor.type) {
    case 'number':
      return NumberControlStrategy;
    case 'boolean':
      return SwitchControlStrategy;
    case 'select':
      return SelectControlStrategy;
    case 'color':
      return ColorControlStrategy;
    case 'curve':
      return CurveControlStrategy;
    case 'motion_lifecycle':
      return MotionLifecycleControlStrategy;
    case 'shader_group':
      return ShaderGroupControlStrategy;
    case 'karaoke_group':
      return KaraokeGroupControlStrategy;
    case 'sfx_actions':
      return SFXActionsControlStrategy;
    case 'regions_array':
      return RegionsArrayControlStrategy;
    case 'string':
    default:
      return StringControlStrategy;
  }
}
