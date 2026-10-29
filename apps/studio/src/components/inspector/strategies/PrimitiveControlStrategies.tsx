import React from 'react';
import { Input } from '../../ui/input';
import { Slider } from '../../ui/slider';
import { Switch } from '../../ui/switch';
import type { ParamFieldDescriptor } from '@acc/ir';
import { EasingCurveSelector } from '../../EasingCurveSelector';

export interface ControlStrategyProps {
  descriptor: ParamFieldDescriptor;
  value: any;
  onChange: (newValue: any) => void;
  disabled?: boolean;
}

/**
 * Strategy 1: NumberControlStrategy
 * Renders a clean synchronized slider + numerical input with unit badges.
 * Applies values statically at the sequence level without per-frame keyframe branching.
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

  // Resolve current scalar value (fall back to default if NaN, undefined, or an object)
  const numericVal =
    typeof value === 'number' && !Number.isNaN(value)
      ? value
      : defaultVal;

  const [localVal, setLocalVal] = React.useState(String(numericVal));

  React.useEffect(() => {
    setLocalVal(String(numericVal));
  }, [numericVal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setLocalVal(e.target.value);
    const num = parseFloat(e.target.value);
    if (!Number.isNaN(num)) {
      const clamped = Math.max(min, Math.min(max, num));
      onChange(clamped);
    }
  };

  return (
    <div className={`space-y-1 ${disabled ? 'pointer-events-none' : ''}`}>
      <div className="flex justify-between items-center text-[11px]">
        <div className="flex items-center gap-1.5">
          <span
            onDoubleClick={() => !disabled && onChange(defaultVal)}
            className={`text-muted-foreground hover:text-accent-theme select-none ${
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            } transition-colors`}
            title={disabled ? undefined : 'Double-click to reset to default'}
          >
            {descriptor.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step={step}
            value={localVal}
            disabled={disabled}
            onChange={handleInputChange}
            className="w-14 h-5 text-[10px] text-right font-mono px-1 py-0 border-glass-border bg-glass-surface text-foreground"
          />
          {descriptor.unit && (
            <span className="text-[10px] text-muted-foreground font-mono">{descriptor.unit}</span>
          )}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={[numericVal]}
        onValueChange={(v) => {
          if (disabled) return;
          onChange(v[0]);
        }}
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
      <span className="text-[11px] font-medium text-foreground/90">
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
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
        {descriptor.label}
      </label>
      <select
        value={String(currentVal)}
        disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.value)}
        className="w-full h-7 rounded-md border border-glass-border bg-glass-surface px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent-theme disabled:cursor-not-allowed"
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
      <span className="text-[11px] text-foreground/90 font-medium">
        {descriptor.label}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          disabled={disabled}
          value={colorVal.slice(0, 7)}
          onChange={(e) => !disabled && onChange(e.target.value)}
          className="w-6 h-6 rounded border border-glass-border cursor-pointer p-0 bg-transparent disabled:cursor-not-allowed"
        />
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
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
      <span className="text-[11px] font-medium text-foreground/90 block">
        {descriptor.label}
      </span>
      <Input
        type="text"
        disabled={disabled}
        value={String(value ?? descriptor.defaultValue ?? '')}
        onChange={(e) => !disabled && onChange(e.target.value)}
        className="w-full h-7 px-2 text-xs font-mono rounded border border-glass-border bg-glass-surface text-foreground disabled:cursor-not-allowed"
      />
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
