import { splitProps, type ComponentProps } from "solid-js";
import { cn } from "cn";

export interface CardProps extends ComponentProps<"div"> {
  class?: string;
  className?: string;
  size?: "default" | "sm";
}

function Card(props: CardProps) {
  const [local, rest] = splitProps(props, ["class", "className", "size"]);

  return (
    <div
      data-slot="card"
      data-size={local.size ?? "default"}
      class={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-4xl bg-card py-(--card-spacing) text-sm text-card-foreground shadow-md ring-1 ring-foreground/5 [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] dark:ring-foreground/10 *:[img:first-child]:rounded-t-4xl *:[img:last-child]:rounded-b-4xl",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

function CardHeader(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="card-header"
      class={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 rounded-t-4xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

function CardTitle(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="card-title"
      class={cn("text-base font-medium", local.class || local.className)}
      {...rest}
    />
  );
}

function CardDescription(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="card-description"
      class={cn("text-sm text-muted-foreground", local.class || local.className)}
      {...rest}
    />
  );
}

function CardAction(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="card-action"
      class={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

function CardContent(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="card-content"
      class={cn("px-(--card-spacing)", local.class || local.className)}
      {...rest}
    />
  );
}

function CardFooter(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="card-footer"
      class={cn(
        "flex items-center rounded-b-4xl px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
