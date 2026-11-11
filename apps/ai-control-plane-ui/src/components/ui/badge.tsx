import { Component, JSX, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
  class?: string;
  className?: string;
}

export const Badge: Component<BadgeProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "className", "variant", "children"]);

  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-primary/15 text-primary border-primary/30",
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
    outline: "bg-surface text-muted-foreground border-border",
  };

  return (
    <span
      class={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-medium transition-colors",
        variants[local.variant ?? "default"],
        local.class || local.className
      )}
      {...others}
    >
      {local.children}
    </span>
  );
};
