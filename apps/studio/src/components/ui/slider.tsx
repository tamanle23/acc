import { splitProps, createMemo, type ComponentProps } from "solid-js";
import { Slider as SliderPrimitive } from "@kobalte/core/slider";
import { cn } from "cn";

export interface SliderProps {
  class?: string;
  className?: string;
  value?: number[] | number;
  defaultValue?: number[] | number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  onChange?: (value: number[]) => void;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  [key: string]: any;
}

function Slider(props: SliderProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "className",
    "value",
    "defaultValue",
    "min",
    "max",
    "step",
    "onValueChange",
    "onChange",
  ]);

  const value = () => {
    if (local.value !== undefined) {
      return Array.isArray(local.value) ? local.value : [local.value];
    }
    return undefined;
  };

  const defaultValue = () => {
    if (local.defaultValue !== undefined) {
      return Array.isArray(local.defaultValue) ? local.defaultValue : [local.defaultValue];
    }
    return [local.min ?? 0];
  };

  const handleChange = (vals: number[]) => {
    if (local.onValueChange) local.onValueChange(vals);
    if (local.onChange) local.onChange(vals);
  };

  return (
    <SliderPrimitive.Root
      value={value()}
      defaultValue={defaultValue()}
      minValue={local.min ?? 0}
      maxValue={local.max ?? 100}
      step={local.step ?? 1}
      onChange={handleChange}
      data-slot="slider"
      class={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 py-1",
        local.class || local.className
      )}
      {...rest}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        class="relative grow overflow-hidden rounded-full bg-muted/70 dark:bg-slate-800/90 border border-white/10 dark:border-white/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] h-1.5 w-full"
      >
        <SliderPrimitive.Fill
          data-slot="slider-range"
          class="absolute bg-accent-theme select-none h-full shadow-[0_0_8px_var(--accent-glow,rgba(6,182,212,0.4))]"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        class="block h-3.5 w-3.5 shrink-0 rounded-full bg-foreground border-2 border-accent-theme shadow-md transition-transform select-none hover:scale-125 focus-visible:outline-none cursor-ew-resize"
      >
        <SliderPrimitive.Input />
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  );
}

export { Slider };
