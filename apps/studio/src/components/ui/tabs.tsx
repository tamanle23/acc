import { splitProps, type ComponentProps } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "@kobalte/core/tabs";
import { cn } from "cn";

function Tabs(props: ComponentProps<typeof TabsPrimitive.Root> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className", "orientation"]);
  const orientation = () => local.orientation ?? "horizontal";

  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation={orientation()}
      class={cn(
        "group/tabs flex gap-2",
        orientation() === 'horizontal' ? "flex-col" : "flex-row",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-full p-1 text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col group-data-[orientation=vertical]/tabs:rounded-2xl data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function TabsList(props: ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants> & { class?: string; className?: string; variant?: "default" | "line"; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className", "variant"]);

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={local.variant ?? "default"}
      class={cn(tabsListVariants({ variant: local.variant ?? "default" }), local.class || local.className)}
      {...rest}
    />
  );
}

function TabsTrigger(props: ComponentProps<typeof TabsPrimitive.Trigger> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      class={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-2 rounded-full border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-background data-[selected]:text-foreground dark:data-[selected]:bg-input/30",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

function TabsContent(props: ComponentProps<typeof TabsPrimitive.Content> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);

  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      class={cn("flex-1 text-sm outline-none", local.class || local.className)}
      {...rest}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
