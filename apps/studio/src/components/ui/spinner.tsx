import type { JSX } from "solid-js";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-solid";

function Spinner(props: JSX.SvgSVGAttributes<SVGSVGElement> & { class?: string; className?: string }) {
  return (
    <Loader2
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      class={cn("size-4 animate-spin", props.class || props.className)}
      {...props}
    />
  );
}

export { Spinner };
