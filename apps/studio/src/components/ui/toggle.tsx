import { splitProps, type ComponentProps } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import { ToggleButton as TogglePrimitive } from "@kobalte/core/toggle-button";
import { cn } from "cn";

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-3xl text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 data-[pressed]:bg-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
      },
      size: {
        default:
          "h-9 min-w-9 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        sm: "h-8 min-w-8 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 min-w-10 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ToggleProps
  extends ComponentProps<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggleVariants> {
  class?: string;
  className?: string;
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  [key: string]: any;
}

function Toggle(props: ToggleProps) {
  const [local, rest] = splitProps(props, ["class", "className", "variant", "size", "onPressedChange", "onChange"]);

  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      class={cn(toggleVariants({ variant: local.variant ?? "default", size: local.size ?? "default" }), local.class || local.className)}
      onChange={local.onChange ?? local.onPressedChange}
      {...rest}
    />
  );
}

export { Toggle, toggleVariants };
