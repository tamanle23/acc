import { Component, JSX, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  class?: string;
  className?: string;
}

export const Button: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, [
    "class",
    "className",
    "variant",
    "size",
    "disabled",
    "children",
  ]);

  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    default:
      "bg-primary text-primary-foreground shadow-glow hover:opacity-92 active:scale-[0.99]",
    destructive:
      "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 active:scale-[0.99]",
    outline:
      "border border-border bg-card/70 text-foreground hover:bg-secondary hover:border-primary/40",
    secondary:
      "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost:
      "text-muted-foreground hover:bg-secondary hover:text-foreground",
  };

  const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
    default: "h-11 px-4 py-2.5 text-xs font-medium rounded-lg",
    sm: "h-9 px-3 py-1.5 text-xs font-medium rounded-md",
    lg: "h-12 px-6 py-3 text-sm font-semibold rounded-xl",
    icon: "h-10 w-10 rounded-lg",
  };

  return (
    <button
      disabled={local.disabled}
      aria-disabled={local.disabled}
      class={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        variants[local.variant ?? "default"],
        sizes[local.size ?? "default"],
        local.class || local.className
      )}
      {...others}
    >
      {local.children}
    </button>
  );
};
