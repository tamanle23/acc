import { splitProps, type ValidComponent, type JSX } from "solid-js";
import Resizable from "@corvu/resizable";
import { cn } from "cn";

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
        "flex h-full w-full data-[orientation=vertical]:flex-col",
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
  defaultSize?: number | `${number}%` | `${number}px`;
  initialSize?: number | `${number}%` | `${number}px`;
  minSize?: number | `${number}%` | `${number}px`;
  maxSize?: number | `${number}%` | `${number}px`;
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
    "children",
  ]);

  const initialSize = () => local.initialSize ?? local.defaultSize;

  return (
    <Resizable.Panel
      initialSize={initialSize()}
      minSize={local.minSize}
      maxSize={local.maxSize}
      class={cn("overflow-hidden", local.class || local.className)}
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
        "relative flex w-1.5 items-center justify-center bg-border/60 hover:bg-accent-theme/60 transition-colors focus-visible:outline-none data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full select-none cursor-col-resize data-[orientation=horizontal]:cursor-row-resize",
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

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
