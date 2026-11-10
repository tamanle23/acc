import { splitProps, type JSX } from "solid-js";
import Resizable from "@corvu/resizable";
import { cn } from "cn";

function normalizeCorvuSize(size: number | string | undefined): number | `${number}px` | undefined {
  if (size === undefined || size === null) return undefined;
  if (typeof size === "number") {
    return size > 1 ? size / 100 : size;
  }
  if (typeof size === "string") {
    const trimmed = size.trim();
    if (trimmed.endsWith("%")) {
      const parsed = parseFloat(trimmed);
      return Number.isNaN(parsed) ? undefined : parsed / 100;
    }
    if (trimmed.endsWith("px")) {
      return trimmed as `${number}px`;
    }
    const parsed = parseFloat(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed > 1 ? parsed / 100 : parsed;
    }
  }
  return undefined;
}

export interface ResizablePanelGroupProps {
  class?: string;
  className?: string;
  direction?: "horizontal" | "vertical";
  orientation?: "horizontal" | "vertical";
  children?: JSX.Element;
  [key: string]: any;
}

function ResizablePanelGroup(props: ResizablePanelGroupProps) {
  const [local, rest] = splitProps(props, ["class", "className", "direction", "orientation", "children"]);
  const orientation = () => local.orientation ?? local.direction ?? "horizontal";

  return (
    <Resizable
      orientation={orientation()}
      class={cn(
        "flex h-full w-full min-h-0 min-w-0 overflow-hidden data-[orientation=vertical]:flex-col",
        local.class || local.className
      )}
      {...rest}
    >
      {local.children}
    </Resizable>
  );
}

export interface ResizablePanelProps {
  class?: string;
  className?: string;
  defaultSize?: number | `${number}%` | `${number}px` | string;
  initialSize?: number | `${number}%` | `${number}px` | string;
  minSize?: number | `${number}%` | `${number}px` | string;
  maxSize?: number | `${number}%` | `${number}px` | string;
  collapsedSize?: number | `${number}%` | `${number}px` | string;
  collapsible?: boolean;
  children?: JSX.Element;
  [key: string]: any;
}

function ResizablePanel(props: ResizablePanelProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "className",
    "defaultSize",
    "initialSize",
    "minSize",
    "maxSize",
    "collapsedSize",
    "children",
  ]);

  const initialSize = () => normalizeCorvuSize(local.initialSize ?? local.defaultSize);
  const minSize = () => normalizeCorvuSize(local.minSize);
  const maxSize = () => normalizeCorvuSize(local.maxSize);
  const collapsedSize = () => normalizeCorvuSize(local.collapsedSize);

  return (
    <Resizable.Panel
      initialSize={initialSize()}
      minSize={minSize()}
      maxSize={maxSize()}
      collapsedSize={collapsedSize()}
      class={cn("min-h-0 min-w-0 overflow-hidden", local.class || local.className)}
      {...rest}
    >
      {local.children}
    </Resizable.Panel>
  );
}

export interface ResizableHandleProps {
  class?: string;
  className?: string;
  withHandle?: boolean;
  [key: string]: any;
}

function ResizableHandle(props: ResizableHandleProps) {
  const [local, rest] = splitProps(props, ["class", "className", "withHandle"]);

  return (
    <Resizable.Handle
      class={cn(
        "relative flex w-1.5 items-center justify-center bg-border/60 hover:bg-accent-theme/60 transition-colors focus-visible:outline-none data-[orientation=vertical]:h-1.5 data-[orientation=vertical]:w-full select-none cursor-col-resize data-[orientation=vertical]:cursor-row-resize",
        local.class || local.className
      )}
      {...rest}
    >
      {local.withHandle && (
        <div class="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
      )}
    </Resizable.Handle>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup, normalizeCorvuSize };
