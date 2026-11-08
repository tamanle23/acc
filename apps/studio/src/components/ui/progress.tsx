import { splitProps, type ComponentProps } from "solid-js";
import * as ProgressPrimitive from "@kobalte/core/progress";
import { cn } from "cn";

export interface ProgressProps {
  class?: string;
  className?: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
  [key: string]: any;
}

function Progress(props: ProgressProps) {
  const [local, rest] = splitProps(props, ["class", "className", "value", "minValue", "maxValue"]);

  return (
    <ProgressPrimitive.Root
      value={local.value ?? 0}
      minValue={local.minValue ?? 0}
      maxValue={local.maxValue ?? 100}
      data-slot="progress"
      class={cn(
        "relative flex h-3 w-full items-center overflow-x-hidden rounded-full bg-muted",
        local.class || local.className
      )}
      {...rest}
    >
      <ProgressPrimitive.Track class="w-full h-full">
        <ProgressPrimitive.Fill
          data-slot="progress-indicator"
          class="h-full bg-primary transition-all rounded-full"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
