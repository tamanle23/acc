import { splitProps, type ComponentProps, type JSX } from "solid-js";
import { Select as SelectPrimitive } from "@kobalte/core/select";
import { ChevronDown, Check, ChevronUp } from "lucide-solid";
import { cn } from "cn";

function Select(props: ComponentProps<typeof SelectPrimitive.Root> & { [key: string]: any }) {
  const [local, rest] = splitProps(props, ["onValueChange", "onChange"]);
  return <SelectPrimitive.Root data-slot="select" onChange={local.onChange ?? local.onValueChange} {...rest} />;
}

function SelectGroup(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <div data-slot="select-group" class={cn("scroll-my-1.5 p-1.5", local.class || local.className)} {...rest} />;
}

function SelectValue(props: ComponentProps<typeof SelectPrimitive.Value> & { [key: string]: any }) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger(props: ComponentProps<typeof SelectPrimitive.Trigger> & {
  class?: string;
  className?: string;
  size?: "sm" | "default";
  children?: JSX.Element;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "size", "children"]);

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={local.size ?? "default"}
      class={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8",
        local.class || local.className
      )}
      {...rest}
    >
      {local.children}
      <SelectPrimitive.Icon>
        <ChevronDown class="pointer-events-none size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent(props: ComponentProps<typeof SelectPrimitive.Content> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children"]);

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        class={cn(
          "relative z-50 max-h-96 min-w-36 overflow-x-hidden overflow-y-auto rounded-3xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5 duration-100 p-1 dark:ring-foreground/10",
          local.class || local.className
        )}
        {...rest}
      >
        <SelectPrimitive.Listbox class="p-1 outline-none">
          {local.children}
        </SelectPrimitive.Listbox>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel(props: ComponentProps<typeof SelectPrimitive.Label> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      class={cn("px-3 py-2.5 text-xs text-muted-foreground", local.class || local.className)}
      {...rest}
    />
  );
}

function SelectItem(props: ComponentProps<typeof SelectPrimitive.Item> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children"]);

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      class={cn(
        "relative flex w-full cursor-default items-center gap-2.5 rounded-2xl py-2 pr-8 pl-3 text-sm font-medium outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class || local.className
      )}
      {...rest}
    >
      <span class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check class="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemLabel>{local.children}</SelectPrimitive.ItemLabel>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="select-separator"
      class={cn("pointer-events-none -mx-1.5 my-1.5 h-px bg-border", local.class || local.className)}
      {...rest}
    />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
