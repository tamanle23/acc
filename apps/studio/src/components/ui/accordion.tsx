import { splitProps, type ComponentProps, type JSX } from "solid-js";
import * as AccordionPrimitive from "@kobalte/core/accordion";
import { ChevronDown, ChevronUp } from "lucide-solid";
import { cn } from "cn";

function Accordion(props: ComponentProps<typeof AccordionPrimitive.Root> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      class={cn("flex w-full flex-col overflow-hidden rounded-2xl border", local.class || local.className)}
      {...rest}
    />
  );
}

function AccordionItem(props: ComponentProps<typeof AccordionPrimitive.Item> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      class={cn("not-last:border-b data-[expanded]:bg-muted/50", local.class || local.className)}
      {...rest}
    />
  );
}

function AccordionTrigger(props: ComponentProps<typeof AccordionPrimitive.Trigger> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  actions?: JSX.Element;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children", "actions"]);

  return (
    <AccordionPrimitive.Header class="flex items-center justify-between">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        class={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between gap-6 border border-transparent p-4 text-left text-sm font-medium transition-all outline-none hover:underline disabled:pointer-events-none disabled:opacity-50",
          local.class || local.className
        )}
        {...rest}
      >
        {local.children}
        <ChevronDown class="pointer-events-none shrink-0 size-4 text-muted-foreground group-data-[expanded]/accordion-trigger:hidden" />
        <ChevronUp class="pointer-events-none hidden shrink-0 size-4 text-muted-foreground group-data-[expanded]/accordion-trigger:inline" />
      </AccordionPrimitive.Trigger>
      {local.actions && (
        <div
          class="flex items-center gap-1 pr-3 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {local.actions}
        </div>
      )}
    </AccordionPrimitive.Header>
  );
}

function AccordionContent(props: ComponentProps<typeof AccordionPrimitive.Content> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children"]);

  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      class="overflow-hidden px-4 text-sm"
      {...rest}
    >
      <div class={cn("pt-0 pb-4", local.class || local.className)}>
        {local.children}
      </div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
