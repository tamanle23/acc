import { Component, JSX, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  class?: string;
  className?: string;
}

export const Input: Component<InputProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "className", "type"]);
  return (
    <input
      type={local.type ?? "text"}
      class={cn(
        "flex h-11 w-full rounded-lg border border-border bg-input px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition",
        local.class || local.className
      )}
      {...others}
    />
  );
};
