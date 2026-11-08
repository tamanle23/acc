import { splitProps, type ComponentProps, type JSX } from "solid-js";
import { ContextMenu as ContextMenuPrimitive } from "@kobalte/core/context-menu";
import { Check, ChevronRight } from "lucide-solid";
import { cn } from "cn";

function ContextMenu(props: ComponentProps<typeof ContextMenuPrimitive.Root> & { [key: string]: any }) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger(props: ComponentProps<typeof ContextMenuPrimitive.Trigger> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" class={local.class || local.className} {...rest} />;
}

function ContextMenuContent(props: ComponentProps<typeof ContextMenuPrimitive.Content> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children"]);

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        class={cn(
          "z-50 min-w-48 overflow-hidden rounded-3xl bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10",
          local.class || local.className
        )}
        {...rest}
      >
        {local.children}
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem(props: ComponentProps<typeof ContextMenuPrimitive.Item> & {
  class?: string;
  className?: string;
  inset?: boolean;
  variant?: "default" | "destructive";
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "inset", "variant"]);

  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      class={cn(
        "group/context-menu-item relative flex cursor-default items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-medium outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

function ContextMenuSeparator(props: ComponentProps<typeof ContextMenuPrimitive.Separator> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      class={cn("pointer-events-none -mx-1.5 my-1.5 h-px bg-border", local.class || local.className)}
      {...rest}
    />
  );
}

function ContextMenuShortcut(props: ComponentProps<"span"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <span
      data-slot="context-menu-shortcut"
      class={cn("ml-auto text-xs tracking-widest text-muted-foreground", local.class || local.className)}
      {...rest}
    />
  );
}

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
};
