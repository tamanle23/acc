import { splitProps, type ComponentProps, type JSX } from "solid-js";
import { AlertDialog as AlertDialogPrimitive } from "@kobalte/core/alert-dialog";
import { cn } from "cn";
import { Button } from "./button";

function AlertDialog(props: ComponentProps<typeof AlertDialogPrimitive.Root> & { [key: string]: any }) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger(props: ComponentProps<typeof AlertDialogPrimitive.Trigger> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" class={local.class || local.className} {...rest} />;
}

function AlertDialogPortal(props: ComponentProps<typeof AlertDialogPrimitive.Portal> & { [key: string]: any }) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay(props: ComponentProps<typeof AlertDialogPrimitive.Overlay> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      class={cn("fixed inset-0 isolate z-50 bg-black/50 backdrop-blur-sm", local.class || local.className)}
      {...rest}
    />
  );
}

function AlertDialogContent(props: ComponentProps<typeof AlertDialogPrimitive.Content> & {
  class?: string;
  className?: string;
  children?: JSX.Element;
  [key: string]: any;
}) {
  const [local, rest] = splitProps(props, ["class", "className", "children"]);

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        class={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-4xl bg-popover p-6 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/5 outline-none sm:max-w-lg dark:ring-foreground/10",
          local.class || local.className
        )}
        {...rest}
      >
        {local.children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="alert-dialog-header"
      class={cn("flex flex-col gap-2 text-center sm:text-left", local.class || local.className)}
      {...rest}
    />
  );
}

function AlertDialogFooter(props: ComponentProps<"div"> & { class?: string; className?: string }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <div
      data-slot="alert-dialog-footer"
      class={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", local.class || local.className)}
      {...rest}
    />
  );
}

function AlertDialogTitle(props: ComponentProps<typeof AlertDialogPrimitive.Title> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      class={cn("text-base font-semibold leading-none", local.class || local.className)}
      {...rest}
    />
  );
}

function AlertDialogDescription(props: ComponentProps<typeof AlertDialogPrimitive.Description> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      class={cn("text-sm text-muted-foreground", local.class || local.className)}
      {...rest}
    />
  );
}

function AlertDialogAction(props: ComponentProps<typeof AlertDialogPrimitive.CloseButton> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <AlertDialogPrimitive.CloseButton
      data-slot="alert-dialog-action"
      class={cn("inline-flex items-center justify-center rounded-3xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90", local.class || local.className)}
      {...rest}
    />
  );
}

function AlertDialogCancel(props: ComponentProps<typeof AlertDialogPrimitive.CloseButton> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <AlertDialogPrimitive.CloseButton
      data-slot="alert-dialog-cancel"
      class={cn("inline-flex items-center justify-center rounded-3xl border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted", local.class || local.className)}
      {...rest}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
