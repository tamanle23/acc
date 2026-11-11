import { Component, JSX, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends JSX.HTMLAttributes<HTMLDivElement> {
  class?: string;
  className?: string;
}

export const Skeleton: Component<SkeletonProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "className"]);
  return (
    <div
      aria-busy="true"
      class={cn("animate-pulse rounded-lg bg-secondary/70", local.class || local.className)}
      {...others}
    />
  );
};
