import { splitProps } from "solid-js";
import { cn } from "cn";
import * as SeparatorPrimitive from "@kobalte/core/separator";

export interface SeparatorProps {
  class?: string;
  className?: string;
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
  [key: string]: any;
}

function Separator(props: SeparatorProps) {
  const [local, rest] = splitProps(props, ["class", "className", "orientation", "decorative"]);

  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      orientation={local.orientation ?? "horizontal"}
      class={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

export { Separator };
