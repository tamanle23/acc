import { splitProps, type ComponentProps, type JSX } from "solid-js";
import { Dialog as DialogPrimitive } from "@kobalte/core/dialog";
import { cn } from "cn";
import { Button } from "./button";
import { X } from "lucide-solid";

function Dialog(props: ComponentProps<typeof DialogPrimitive.Root> & { [key: string]: any }) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" class={local.class || local.className} {...rest} />;
}

function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal> & { [key: string]: any }) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(props: ComponentProps<typeof DialogPrimitive.CloseButton> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <DialogPrimitive.CloseButton data-slot="dialog-close" class={local.class || local.className} {...rest} />;
}

function DialogOverlay(props: ComponentProps<typeof DialogPrimitive.Overlay> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      class={cn(
        "fixed inset-0 isolate z-50 bg-black/50 duration-100 backdrop-blur-sm",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

function DialogContent(props: ComponentProps<typeof DialogPrimitive.Content> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  showCloseButton?: boolean;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, [
    "class",
    "className",
    "children",
    "showCloseButton",
  ]);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        class={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-4xl bg-popover p-6 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-100 outline-none sm:max-w-md dark:ring-foreground/10",
          local.class || local.className
        )}
        {...rest}
      >
        {local.children}
        {local.showCloseButton !== false && (
          <DialogPrimitive.CloseButton
            data-slot="dialog-close"
            class="absolute top-4 right-4 inline-flex size-7 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-muted transition-colors"
          >
            <X class="size-4" />
            <span class="sr-only">Close</span>
          </DialogPrimitive.CloseButton>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="dialog-header"
      class={cn("flex flex-col gap-1.5", local.class || local.className)}
      {...rest}
    />
  );
}

function DialogFooter(props: ComponentProps<"div"> & {
  class?: string;
  className?: string;
  showCloseButton?: boolean;
  children?: JSX.Element;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "showCloseButton", "children"]);
  return (
    <div
      data-slot="dialog-footer"
      class={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        local.class || local.className
      )}
      {...rest}
    >
      {local.children}
      {local.showCloseButton && (
        <DialogPrimitive.CloseButton asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.CloseButton>
      )}
    </div>
  );
}

function DialogTitle(props: ComponentProps<typeof DialogPrimitive.Title> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      class={cn("text-base leading-none font-medium", local.class || local.className)}
      {...rest}
    />
  );
}

function DialogDescription(props: ComponentProps<typeof DialogPrimitive.Description> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      class={cn("text-sm text-muted-foreground", local.class || local.className)}
      {...rest}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
