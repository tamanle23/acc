import { splitProps, type ComponentProps } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-2xl border px-4 py-3 text-left text-sm has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive: "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface AlertProps extends ComponentProps<"div">, VariantProps<typeof alertVariants> {
  class?: string;
  className?: string;
}

function Alert(props: AlertProps) {
  const [local, rest] = splitProps(props, ["class", "className", "variant"]);

  return (
    <div
      data-slot="alert"
      role="alert"
      class={cn(alertVariants({ variant: local.variant }), local.class || local.className)}
      {...rest}
    />
  );
}

function AlertTitle(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="alert-title"
      class={cn("font-medium group-has-[>svg]/alert:col-start-2", local.class || local.className)}
      {...rest}
    />
  );
}

function AlertDescription(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="alert-description"
      class={cn("text-sm text-muted-foreground", local.class || local.className)}
      {...rest}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
