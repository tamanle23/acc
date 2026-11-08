import { createSignal, createEffect, For, Show } from 'solid-js';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';

export interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function ParameterSlider(props: ParameterSliderProps) {
  const [localVal, setLocalVal] = createSignal(String(props.value));

  createEffect(() => {
    setLocalVal(String(props.value));
  });

  const handleInputChange = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    setLocalVal(e.currentTarget.value);
    const num = parseFloat(e.currentTarget.value);
    if (!isNaN(num)) {
      props.onChange(Math.max(props.min, Math.min(props.max, num)));
    }
  };

  return (
    <div class="space-y-1">
      <div class="flex justify-between items-center text-[11px]">
        <span
          onDblClick={() => props.onChange(props.defaultValue)}
          class="text-muted-foreground select-none cursor-pointer hover:text-accent-theme transition-colors"
          title="Double-click to reset"
        >
          {props.label}
        </span>
        <div class="flex items-center gap-1">
          <Input
            type="number"
            step={props.step}
            value={localVal()}
            onInput={handleInputChange}
            class="w-14 h-5 text-[10px] text-right font-mono px-1 py-0 border-glass-border bg-glass-surface text-foreground"
          />
          <Show when={props.unit}>
            <span class="text-[10px] text-muted-foreground font-mono">{props.unit}</span>
          </Show>
        </div>
      </div>
      <Slider
        min={props.min}
        max={props.max}
        step={props.step}
        value={[props.value]}
        onChange={(val: number[]) => props.onChange(val[0])}
        onDblClick={() => props.onChange(props.defaultValue)}
      />
    </div>
  );
}

export interface ColorPickerRowProps {
  label: string;
  value: string;
  presets: { name: string; hex: string }[];
  onChange: (hex: string) => void;
}

export function ColorPickerRow(props: ColorPickerRowProps) {
  return (
    <div class="space-y-1.5">
      <div class="flex justify-between items-center text-[11px] text-muted-foreground">
        <span>{props.label}</span>
        <div class="flex items-center gap-1.5">
          <input
            type="color"
            value={props.value}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            class="w-5 h-5 rounded cursor-pointer border border-glass-border p-0 bg-transparent"
          />
          <span class="font-mono text-[10px] text-muted-foreground uppercase">{props.value}</span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <For each={props.presets}>
          {(preset) => (
            <button
              onClick={() => props.onChange(preset.hex)}
              class={`w-4 h-4 rounded-full border transition-transform hover:scale-125 ${
                props.value.toLowerCase() === preset.hex.toLowerCase()
                  ? 'ring-2 ring-accent-theme border-background scale-110'
                  : 'border-glass-border'
              }`}
              style={{ 'background-color': preset.hex }}
              title={preset.name}
            />
          )}
        </For>
      </div>
    </div>
  );
}
