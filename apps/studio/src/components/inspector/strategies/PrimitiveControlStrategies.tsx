import { Show, For } from 'solid-js';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Slider } from '../../ui/slider';
import { Switch } from '../../ui/switch';
import type { ParamFieldDescriptor } from '@acc/ir';
import { EasingCurveSelector } from '../../EasingCurveSelector';
import { ScrubbableNumberInput } from '../ScrubbableNumberInput';

export interface ControlStrategyProps {
  descriptor: ParamFieldDescriptor;
  value: any;
  onChange: (newValue: any) => void;
  disabled?: boolean;
}

/**
 * Strategy 1: NumberControlStrategy
 * Renders a studio-grade synchronized virtual scrub input + range slider.
 * Supports horizontal click-drag scrubbing (Shift: 10x, Alt: 0.1x), double-click direct text
 * with safe math expressions (e.g. 1080/2), and double-click reset to defaults.
 */
export function NumberControlStrategy(props: ControlStrategyProps) {
  const min = () => props.descriptor.min ?? 0;
  const max = () => props.descriptor.max ?? 100;
  const step = () => props.descriptor.step ?? 1;
  const defaultVal = () =>
    typeof props.descriptor.defaultValue === 'number' ? props.descriptor.defaultValue : min();

  // Resolve current scalar value (fall back to default if NaN, undefined, or an object)
  const numericVal = () =>
    typeof props.value === 'number' && !Number.isNaN(props.value) ? props.value : defaultVal();

  return (
    <div class={`space-y-1.5 ${props.disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div class="flex justify-between items-center text-[11px]">
        <span
          onDblClick={() => {
            if (!props.disabled) props.onChange(defaultVal());
          }}
          class={`text-muted-foreground hover:text-accent-theme select-none truncate ${
            props.disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          } transition-colors`}
          title={props.disabled ? undefined : `Double-click to reset (${defaultVal()})`}
        >
          {props.descriptor.label}
        </span>
        <ScrubbableNumberInput
          value={numericVal()}
          min={min()}
          max={max()}
          step={step()}
          unit={props.descriptor.unit}
          defaultValue={defaultVal()}
          disabled={props.disabled}
          onChange={props.onChange}
        />
      </div>
      <Slider
        min={min()}
        max={max()}
        step={step()}
        disabled={props.disabled}
        defaultValue={defaultVal()}
        value={numericVal()}
        onChange={(v: number[]) => {
          if (props.disabled) return;
          props.onChange(v[0]);
        }}
      />
    </div>
  );
}

/**
 * Strategy 2: SwitchControlStrategy
 * Renders a boolean toggle switch.
 */
export function SwitchControlStrategy(props: ControlStrategyProps) {
  const checked = () =>
    typeof props.value === 'boolean' ? props.value : Boolean(props.descriptor.defaultValue);

  return (
    <div class={`flex items-center justify-between py-1 ${props.disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span class="text-[11px] font-medium text-foreground/90">
        {props.descriptor.label}
      </span>
      <Switch
        checked={checked()}
        disabled={props.disabled}
        onChange={(c: boolean) => !props.disabled && props.onChange(c)}
      />
    </div>
  );
}

/**
 * Strategy 3: SelectControlStrategy
 * Renders a clean dropdown select menu for enumerated options.
 */
export function SelectControlStrategy(props: ControlStrategyProps) {
  const currentVal = () =>
    props.value ?? props.descriptor.defaultValue ?? props.descriptor.options?.[0]?.value ?? '';

  return (
    <div class={`space-y-1 ${props.disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <label class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
        {props.descriptor.label}
      </label>
      <select
        value={String(currentVal())}
        disabled={props.disabled}
        onChange={(e) => !props.disabled && props.onChange(e.currentTarget.value)}
        class="w-full h-7 rounded-md border border-glass-border bg-glass-surface px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent-theme disabled:cursor-not-allowed"
      >
        <For each={props.descriptor.options || []}>
          {(opt) => (
            <option value={String(opt.value)}>
              {opt.label}
            </option>
          )}
        </For>
      </select>
    </div>
  );
}

/**
 * Strategy 4: ColorControlStrategy
 * Renders a dual color swatch + hex input.
 */
export function ColorControlStrategy(props: ControlStrategyProps) {
  const colorVal = () =>
    typeof props.value === 'string' && props.value.startsWith('#')
      ? props.value
      : props.descriptor.defaultValue || '#00ffff';

  return (
    <div class={`flex items-center justify-between pt-1 ${props.disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span class="text-[11px] text-foreground/90 font-medium">
        {props.descriptor.label}
      </span>
      <div class="flex items-center gap-1.5">
        <input
          type="color"
          disabled={props.disabled}
          value={colorVal().slice(0, 7)}
          onInput={(e) => !props.disabled && props.onChange(e.currentTarget.value)}
          class="w-6 h-6 rounded border border-glass-border cursor-pointer p-0 bg-transparent disabled:cursor-not-allowed"
        />
        <span class="text-[10px] font-mono text-muted-foreground uppercase">
          {colorVal()}
        </span>
      </div>
    </div>
  );
}

/**
 * Strategy 5: StringControlStrategy
 * Renders a compact text input field.
 */
export function StringControlStrategy(props: ControlStrategyProps) {
  const isMultiLine = () => props.descriptor.key === 'text' || (props.descriptor as any).type === 'textarea';

  return (
    <div class={`space-y-1 ${props.disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span class="text-[11px] font-medium text-foreground/90 block">
        {props.descriptor.label}
      </span>
      <Show
        when={isMultiLine()}
        fallback={
          <Input
            type="text"
            disabled={props.disabled}
            value={String(props.value ?? props.descriptor.defaultValue ?? '')}
            onInput={(e) => !props.disabled && props.onChange(e.currentTarget.value)}
            class="w-full h-7 px-2 text-xs font-mono rounded border border-glass-border bg-glass-surface text-foreground disabled:cursor-not-allowed"
          />
        }
      >
        <Textarea
          disabled={props.disabled}
          value={String(props.value ?? props.descriptor.defaultValue ?? '')}
          onInput={(e) => !props.disabled && props.onChange(e.currentTarget.value)}
          rows={3}
          placeholder="Enter text..."
          class="w-full min-h-[64px] p-2 text-xs font-mono rounded border border-glass-border bg-glass-surface text-foreground disabled:cursor-not-allowed resize-y"
        />
      </Show>
    </div>
  );
}

/**
 * Strategy 7: CurveControlStrategy
 * Renders GSAP easing curve preview and selector with animated travel path.
 */
export function CurveControlStrategy(props: ControlStrategyProps) {
  return (
    <div class="pt-1">
      <EasingCurveSelector
        value={typeof props.value === 'string' ? props.value : 'power2.out'}
        onChange={(ease) => props.onChange(ease)}
      />
    </div>
  );
}
