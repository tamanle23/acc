import { createSignal, onMount, onCleanup, type Accessor } from "solid-js";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): Accessor<boolean> {
  const [isMobile, setIsMobile] = createSignal<boolean>(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  onMount(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    onCleanup(() => mql.removeEventListener("change", onChange));
  });

  return isMobile;
}
