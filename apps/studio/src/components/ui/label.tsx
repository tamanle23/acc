import { splitProps, type ComponentProps } from "solid-js";
import { cn } from "cn";

export interface LabelProps extends ComponentProps<"label"> {
  class?: string;
  className?: string;
}

function Label(props: LabelProps) {
  const [local, rest] = splitProps(props, ["class", "className"]);

  return (
    <label
      data-slot="label"
      class={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        local.class || local.className
      )}
      {...rest}
    />
  );
}

export { Label };
