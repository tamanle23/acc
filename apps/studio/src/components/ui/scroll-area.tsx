import { splitProps, type ComponentProps, type JSX } from "solid-js";
import { cn } from "cn";

export interface ScrollAreaProps extends ComponentProps<"div"> {
  class?: string;
  className?: string;
  children?: JSX.Element;
}

function ScrollArea(props: ScrollAreaProps) {
  const [local, rest] = splitProps(props, ["class", "className", "children"]);

  return (
    <div
      data-slot="scroll-area"
      class={cn("relative overflow-auto", local.class || local.className)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

function ScrollBar(props: ComponentProps<"div"> & { class?: string; className?: string; orientation?: "horizontal" | "vertical" }) {
  const [local, rest] = splitProps(props, ["class", "className", "orientation"]);
  return (
    <div
      data-slot="scroll-area-scrollbar"
      data-orientation={local.orientation ?? "vertical"}
      class={cn("hidden", local.class || local.className)}
      {...rest}
    />
  );
}

export { ScrollArea, ScrollBar };
