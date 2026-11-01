"use client"

import * as React from "react"
import { cn } from "cn"
import { Slider as SliderPrimitive } from "radix-ui"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col py-1",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-muted/70 dark:bg-slate-800/90 border border-white/10 dark:border-white/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] h-1.5 w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-accent-theme select-none h-full data-[orientation=vertical]:w-full shadow-[0_0_8px_var(--accent-glow,rgba(6,182,212,0.4))]"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block h-3.5 w-3.5 shrink-0 rounded-full bg-foreground border-2 border-accent-theme shadow-md transition-transform select-none hover:scale-125 hover:shadow-[0_0_8px_var(--accent-glow,rgba(6,182,212,0.6))] focus-visible:ring-2 focus-visible:ring-accent-theme focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-ew-resize data-[orientation=vertical]:cursor-ns-resize"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
