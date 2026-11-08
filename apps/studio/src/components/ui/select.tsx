import {
  createContext,
  useContext,
  createSignal,
  createMemo,
  splitProps,
  type JSX,
  type ComponentProps,
} from "solid-js";
import * as PopoverPrimitive from "@kobalte/core/popover";
import { ChevronDown, Check } from "lucide-solid";
import { cn } from "cn";

interface SelectContextType {
  value: () => any;
  setValue: (val: any) => void;
  open: () => boolean;
  setOpen: (open: boolean) => void;
  labels: Record<string, string>;
  registerLabel: (val: any, label: string) => void;
}

const SelectContext = createContext<SelectContextType>();

function useSelect() {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error("useSelect must be used within <Select>");
  return ctx;
}

export interface SelectProps {
  value?: any;
  defaultValue?: any;
  onChange?: (value: any) => void;
  onValueChange?: (value: any) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children?: JSX.Element;
  [key: string]: any;
}

function Select(props: SelectProps) {
  const [internalValue, setInternalValue] = createSignal(props.defaultValue ?? props.value);
  const [internalOpen, setInternalOpen] = createSignal(false);
  const [labels, setLabels] = createSignal<Record<string, string>>({});

  const currentValue = () => (props.value !== undefined ? props.value : internalValue());
  const isOpen = () => (props.open !== undefined ? props.open : internalOpen());

  const handleOpenChange = (open: boolean) => {
    setInternalOpen(open);
    props.onOpenChange?.(open);
  };

  const handleSelect = (val: any) => {
    setInternalValue(val);
    props.onChange?.(val);
    props.onValueChange?.(val);
    handleOpenChange(false);
  };

  const registerLabel = (val: any, label: string) => {
    setLabels((prev) => {
      const key = String(val);
      if (prev[key] === label) return prev;
      return { ...prev, [key]: label };
    });
  };

  const ctx: SelectContextType = {
    value: currentValue,
    setValue: handleSelect,
    open: isOpen,
    setOpen: handleOpenChange,
    get labels() {
      return labels();
    },
    registerLabel,
  };

  return (
    <SelectContext.Provider value={ctx}>
      <PopoverPrimitive.Root
        open={isOpen()}
        onOpenChange={handleOpenChange}
        disabled={props.disabled}
        sameWidth
      >
        {props.children}
      </PopoverPrimitive.Root>
    </SelectContext.Provider>
  );
}

function SelectTrigger(props: ComponentProps<"button"> & {
  class?: string;
  className?: string;
  size?: "sm" | "default";
  children?: JSX.Element;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "size", "children"]);

  return (
    <PopoverPrimitive.Trigger
      data-slot="select-trigger"
      data-size={local.size ?? "default"}
      class={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8",
        local.class || local.className
      )}
      {...rest}
    >
      {local.children}
      <ChevronDown class="pointer-events-none size-4 text-muted-foreground ml-auto opacity-70 shrink-0" />
    </PopoverPrimitive.Trigger>
  );
}

function SelectValue(props: { placeholder?: string; class?: string; className?: string }) {
  const ctx = useSelect();
  const label = createMemo(() => {
    const v = ctx.value();
    if (v === undefined || v === null || v === "") return undefined;
    return ctx.labels[String(v)] ?? String(v);
  });

  return (
    <span
      data-slot="select-value"
      class={cn("truncate", !label() && "text-muted-foreground", props.class || props.className)}
    >
      {label() ?? props.placeholder ?? ""}
    </span>
  );
}

function SelectContent(props: ComponentProps<"div"> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children"]);

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="select-content"
        class={cn(
          "relative z-50 max-h-96 min-w-36 overflow-x-hidden overflow-y-auto rounded-2xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5 duration-100 p-1 dark:ring-foreground/10 outline-none",
          local.class || local.className
        )}
        {...rest}
      >
        <div class="p-1 outline-none">{local.children}</div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function SelectItem(props: ComponentProps<"div"> & {
  value: any;
  class?: string;
  className?: string;
  children?: JSX.Element;
  disabled?: boolean;
  [key: string]: any;
}) {
  const ctx = useSelect();
  const [local, rest] = splitProps(props, ["value", "class", "className", "children", "disabled"]);

  if (typeof local.children === "string") {
    ctx.registerLabel(local.value, local.children);
  }

  const isSelected = createMemo(() => String(ctx.value()) === String(local.value));

  return (
    <div
      role="option"
      aria-selected={isSelected()}
      data-slot="select-item"
      onClick={() => {
        if (!local.disabled) {
          ctx.setValue(local.value);
        }
      }}
      class={cn(
        "relative flex w-full cursor-pointer items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm font-medium outline-none select-none transition-colors hover:bg-accent hover:text-accent-foreground",
        isSelected() && "bg-accent/60 font-semibold text-accent-foreground",
        local.disabled && "pointer-events-none opacity-50 cursor-not-allowed",
        local.class || local.className
      )}
      {...rest}
    >
      <span class="truncate">{local.children}</span>
      {isSelected() && (
        <span class="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-accent-theme">
          <Check class="size-4" />
        </span>
      )}
    </div>
  );
}

function SelectGroup(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <div data-slot="select-group" class={cn("scroll-my-1.5 p-1.5", local.class || local.className)} {...rest} />;
}

function SelectLabel(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="select-label"
      class={cn("px-3 py-2 text-xs font-semibold text-muted-foreground", local.class || local.className)}
      {...rest}
    />
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
