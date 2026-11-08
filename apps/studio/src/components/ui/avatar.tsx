import { splitProps, type ComponentProps } from "solid-js";
import * as ImagePrimitive from "@kobalte/core/image";
import { cn } from "cn";

function Avatar(props: ComponentProps<typeof ImagePrimitive.Root> & { class?: string; className?: string; size?: "default" | "sm" | "lg"; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className", "size"]);

  return (
    <ImagePrimitive.Root
      data-slot="avatar"
      data-size={local.size ?? "default"}
      class={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none overflow-hidden data-[size=lg]:size-10 data-[size=sm]:size-6",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

function AvatarImage(props: ComponentProps<typeof ImagePrimitive.Img> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <ImagePrimitive.Img
      data-slot="avatar-image"
      class={cn("aspect-square size-full object-cover", local.class || local.className)}
      {...rest}
    />
  );
}

function AvatarFallback(props: ComponentProps<typeof ImagePrimitive.Fallback> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <ImagePrimitive.Fallback
      data-slot="avatar-fallback"
      class={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
