import { splitProps, Show, type ComponentProps, type JSX, type ParentProps } from "solid-js";
import * as TooltipPrimitive from "@kobalte/core/tooltip";
import { cn } from "cn";

function TooltipProvider(props: ParentProps) {
  return <>{props.children}</>;
}

function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root> & { content?: JSX.Element; delayDuration?: number; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["content", "delayDuration", "children"]);
  return (
    <TooltipPrimitive.Root data-slot="tooltip" openDelay={local.delayDuration ?? 0} {...rest}>
      <Show when={local.content !== undefined} fallback={local.children}>
        <TooltipTrigger as="div" class="inline-flex items-center">
          {local.children}
        </TooltipTrigger>
        <TooltipContent>{local.content}</TooltipContent>
      </Show>
    </TooltipPrimitive.Root>
  );
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
