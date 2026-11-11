import { splitProps, type ComponentProps, type JSX } from "solid-js";
import * as PopoverPrimitive from "@kobalte/core/popover";
import { cn } from "cn";

function Popover(props: ComponentProps<typeof PopoverPrimitive.Root> & { [key: string]: any }) {
  const [local, rest] = splitProps(props, ["modal"]);
  return <PopoverPrimitive.Root data-slot="popover" modal={local.modal ?? false} {...rest} />;
}

function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger> & { class?: string; className?: string; asChild?: boolean; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className", "asChild", "as"]);
  return (
    <PopoverPrimitive.Trigger
      as={local.as ?? (local.asChild ? "div" : "button")}
      data-slot="popover-trigger"
      class={cn(local.asChild && "inline-flex items-center", local.class || local.className)}
      {...rest}
    />
  );
}

function PopoverAnchor(props: ComponentProps<typeof PopoverPrimitive.Anchor> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" class={local.class || local.className} {...rest} />;
}

function PopoverContent(props: ComponentProps<typeof PopoverPrimitive.Content> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  sideOffset?: number;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children", "sideOffset", "onFocusOutside"]);

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        class={cn(
          "z-50 flex w-72 flex-col gap-4 rounded-3xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none duration-100 dark:ring-foreground/10",
          local.class || local.className
        )}
        onFocusOutside={(e: any) => {
          const target = e.detail?.originalEvent?.target as HTMLElement | undefined;
          if (target && (e.currentTarget?.contains?.(target) || target.closest?.('[data-slot="popover-content"]'))) {
            e.preventDefault();
            return;
          }
          local.onFocusOutside?.(e);
        }}
        {...rest}
      >
        {local.children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="popover-header"
      class={cn("flex flex-col gap-1 text-sm", local.class || local.className)}
      {...rest}
    />
  );
}

function PopoverTitle(props: ComponentProps<typeof PopoverPrimitive.Title> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      class={cn("text-base font-medium", local.class || local.className)}
      {...rest}
    />
  );
}

function PopoverDescription(props: ComponentProps<typeof PopoverPrimitive.Description> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      class={cn("text-muted-foreground", local.class || local.className)}
      {...rest}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
