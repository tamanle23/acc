import { Component, JSX, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  class?: string;
  className?: string;
}

export const Textarea: Component<TextareaProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "className"]);
  return (
    <textarea
      class={cn(
        "flex min-h-[120px] w-full rounded-lg border border-border bg-input p-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition resize-none leading-relaxed",
        local.class || local.className
      )}
      {...others}
    />
  );
};
