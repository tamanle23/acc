import { splitProps, type ComponentProps, type JSX, type ParentProps } from "solid-js";
import * as TooltipPrimitive from "@kobalte/core/tooltip";
import { cn } from "cn";

function TooltipProvider(props: ParentProps) {
  return <>{props.children}</>;
}

function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root> & { [key: string]: any }) {
  return <TooltipPrimitive.Root data-slot="tooltip" openDelay={props.delayDuration ?? 0} {...props} />;
}

function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" class={local.class || local.className} {...rest} />;
}

function TooltipContent(props: ComponentProps<typeof TooltipPrimitive.Content> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  sideOffset?: number;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children", "sideOffset"]);

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        class={cn(
          "z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs text-background shadow-md",
          local.class || local.className
        )}
        {...rest}
      >
        {local.children}
        <TooltipPrimitive.Arrow class="fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
