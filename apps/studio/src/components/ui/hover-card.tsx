import { splitProps, type ComponentProps, type JSX } from "solid-js";
import * as HoverCardPrimitive from "@kobalte/core/hover-card";
import { cn } from "cn";

function HoverCard(props: ComponentProps<typeof HoverCardPrimitive.Root> & { [key: string]: any }) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger(props: ComponentProps<typeof HoverCardPrimitive.Trigger> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" class={local.class || local.className} {...rest} />;
}

function HoverCardContent(props: ComponentProps<typeof HoverCardPrimitive.Content> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  sideOffset?: number;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children", "sideOffset"]);

  return (
    <HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        class={cn(
          "z-50 w-72 rounded-3xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none duration-100 dark:ring-foreground/10",
          local.class || local.className
        )}
        {...rest}
      >
        {local.children}
      </HoverCardPrimitive.Content>
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
