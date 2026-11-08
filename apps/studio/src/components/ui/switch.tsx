import { splitProps, type ComponentProps } from "solid-js";
import * as SwitchPrimitive from "@kobalte/core/switch";
import { cn } from "cn";

export interface SwitchProps {
  class?: string;
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
  size?: "sm" | "default";
  disabled?: boolean;
  [key: string]: any;
}

function Switch(props: SwitchProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "className",
    "checked",
    "defaultChecked",
    "onCheckedChange",
    "onChange",
    "size",
  ]);

  const handleChange = (val: boolean) => {
    if (local.onCheckedChange) local.onCheckedChange(val);
    if (local.onChange) local.onChange(val);
  };

  return (
    <SwitchPrimitive.Root
      checked={local.checked}
      defaultChecked={local.defaultChecked}
      onChange={handleChange}
      data-slot="switch"
      data-size={local.size ?? "default"}
      class={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border-2 transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/30 data-[size=default]:h-5 data-[size=default]:w-11 data-[size=sm]:h-4 data-[size=sm]:w-7 data-[checked]:border-primary data-[checked]:bg-primary data-[unchecked]:border-transparent data-[unchecked]:bg-input/90 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        local.class || local.className
      )}
      {...rest}
    >
      <SwitchPrimitive.Input />
      <SwitchPrimitive.Control class="w-full h-full flex items-center">
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          class="pointer-events-none block rounded-full bg-background shadow-sm ring-0 transition-transform group-data-[size=default]/switch:h-4 group-data-[size=default]/switch:w-4 group-data-[size=sm]/switch:h-3 group-data-[size=sm]/switch:w-3 data-[checked]:translate-x-5 data-[unchecked]:translate-x-0"
        />
      </SwitchPrimitive.Control>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
