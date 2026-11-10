import { splitProps, type ComponentProps } from "solid-js";
import { cn } from "cn";

function Skeleton(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="skeleton"
      class={cn("animate-pulse rounded-2xl bg-muted", local.class || local.className)}
      {...rest}
    />
  );
}

export { Skeleton };
