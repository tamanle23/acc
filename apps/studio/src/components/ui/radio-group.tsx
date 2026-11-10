import { splitProps, type ComponentProps } from "solid-js";
import * as RadioGroupPrimitive from "@kobalte/core/radio-group";
import { cn } from "cn";

function RadioGroup(props: ComponentProps<typeof RadioGroupPrimitive.Root> & { class?: string; className?: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className"]);
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      class={cn("grid w-full gap-3", local.class || local.className)}
      {...rest}
    />
  );
}

function RadioGroupItem(props: ComponentProps<typeof RadioGroupPrimitive.Item> & { class?: string; className?: string; value: string; [key: string]: any }) {
  const [local, rest] = splitProps(props, ["class", "className", "value"]);

  return (
    <RadioGroupPrimitive.Item
      value={local.value}
      data-slot="radio-group-item"
      class={cn(
        "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-transparent bg-input/90 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[checked]:text-primary-foreground",
        local.class || local.className
      )}
      {...rest}
    >
      <RadioGroupPrimitive.ItemInput />
      <RadioGroupPrimitive.ItemControl class="w-full h-full flex items-center justify-center">
        <RadioGroupPrimitive.ItemIndicator class="flex size-4 items-center justify-center">
          <span class="size-2 rounded-full bg-primary-foreground" />
        </RadioGroupPrimitive.ItemIndicator>
      </RadioGroupPrimitive.ItemControl>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
