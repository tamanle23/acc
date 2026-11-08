import { splitProps, type ComponentProps } from "solid-js";
import { Collapsible as CollapsiblePrimitive } from "@kobalte/core/collapsible";
import { cn } from "cn";

function Collapsible(props: ComponentProps<typeof CollapsiblePrimitive.Root> & { [key: string]: any }) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger(props: ComponentProps<typeof CollapsiblePrimitive.Trigger> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" class={local.class || local.className} {...rest} />;
}

function CollapsibleContent(props: ComponentProps<typeof CollapsiblePrimitive.Content> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <CollapsiblePrimitive.Content data-slot="collapsible-content" class={local.class || local.className} {...rest} />;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
