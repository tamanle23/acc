import { Component, JSX, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  class?: string;
  className?: string;
}

export const Card: Component<CardProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "className", "children"]);
  return (
    <div
      class={cn(
        "bento-card rounded-xl border border-border/90 bg-card/90 text-card-foreground backdrop-blur-xl transition-all duration-200 hover:border-border",
        local.class || local.className
      )}
      {...others}
    >
      {local.children}
    </div>
  );
};

export const CardHeader: Component<CardProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "className", "children"]);
  return (
    <div
      class={cn(
        "flex flex-col space-y-1 p-4 sm:p-5 border-b border-border/75 bg-surface/35 rounded-t-xl",
        local.class || local.className
      )}
      {...others}
    >
      {local.children}
    </div>
  );
};

export const CardTitle: Component<
  JSX.HTMLAttributes<HTMLHeadingElement> & { class?: string; className?: string }
> = (props) => {
  const [local, others] = splitProps(props, ["class", "className", "children"]);
  return (
    <h3
      class={cn(
        "text-xs sm:text-sm font-semibold leading-none tracking-tight text-card-foreground",
        local.class || local.className
      )}
      {...others}
    >
      {local.children}
    </h3>
  );
};

export const CardDescription: Component<
  JSX.HTMLAttributes<HTMLParagraphElement> & { class?: string; className?: string }
> = (props) => {
  const [local, others] = splitProps(props, ["class", "className", "children"]);
  return (
    <p
      class={cn(
        "text-[11px] sm:text-xs text-muted-foreground leading-relaxed",
        local.class || local.className
      )}
      {...others}
    >
      {local.children}
    </p>
  );
};

export const CardContent: Component<CardProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "className", "children"]);
  return (
    <div class={cn("p-4 sm:p-5", local.class || local.className)} {...others}>
      {local.children}
    </div>
  );
};

export const CardFooter: Component<CardProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "className", "children"]);
  return (
    <div class={cn("flex items-center p-4 sm:p-5 pt-0", local.class || local.className)} {...others}>
      {local.children}
    </div>
  );
};
