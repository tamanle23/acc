import { Component, JSX, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export interface AlertProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success";
  class?: string;
  className?: string;
}

export const Alert: Component<AlertProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "className", "variant", "children"]);
  const variants: Record<NonNullable<AlertProps["variant"]>, string> = {
    default: "border-border bg-surface text-foreground",
    destructive: "border-destructive/40 bg-destructive/10 text-destructive",
    success: "border-success/40 bg-success/10 text-success",
  };
  return (
    <div
      role="alert"
      aria-live="polite"
      class={cn(
        "relative w-full rounded-lg border p-4 text-xs flex items-start gap-3",
        variants[local.variant ?? "default"],
        local.class || local.className
      )}
      {...others}
    >
      {local.children}
    </div>
  );
};
