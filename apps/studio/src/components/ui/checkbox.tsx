import { splitProps, type ComponentProps } from "solid-js";
import { Checkbox as CheckboxPrimitive } from "@kobalte/core/checkbox";
import { Check } from "lucide-solid";
import { cn } from "cn";

export interface CheckboxProps {
  class?: string;
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  [key: string]: any;
}

function Checkbox(props: CheckboxProps) {
  const [local, rest] = splitProps(props, ["class", "className", "checked", "defaultChecked", "onChange", "onCheckedChange"]);

  const handleChange = (val: boolean) => {
    if (local.onCheckedChange) local.onCheckedChange(val);
    if (local.onChange) local.onChange(val);
  };

  return (
    <CheckboxPrimitive.Root
      checked={local.checked}
      defaultChecked={local.defaultChecked}
      onChange={handleChange}
      data-slot="checkbox"
      class={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-transparent bg-input/90 transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground",
        local.class || local.className
      )}
      {...rest}
    >
      <CheckboxPrimitive.Input />
      <CheckboxPrimitive.Control class="grid place-content-center text-current w-full h-full">
        <CheckboxPrimitive.Indicator>
          <Check class="size-3.5" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Control>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
