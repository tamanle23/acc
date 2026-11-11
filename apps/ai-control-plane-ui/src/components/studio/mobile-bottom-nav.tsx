import { Component, For } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import type { StudioWorkspaceId } from "@/types/studio";
import { NAV_ITEMS } from "@/constants/studio-constants";

export interface MobileBottomNavProps {
  activeTab?: StudioWorkspaceId;
  onSelectTab?: (tab: StudioWorkspaceId) => void;
}

const TAB_ROUTES: Record<StudioWorkspaceId, string> = {
  pipelines: "/pipelines",
  hf: "/weights",
  env: "/uv",
  telemetry: "/telemetry",
  sdk: "/sdk",
};

export const MobileBottomNav: Component<MobileBottomNavProps> = (props) => {
  let location: any;
  try {
    location = useLocation();
  } catch {
    location = { pathname: "/pipelines" };
  }

  const isItemActive = (id: StudioWorkspaceId) => {
    if (props.activeTab) return props.activeTab === id;
    const target = TAB_ROUTES[id];
    return location.pathname === target || (id === "pipelines" && location.pathname === "/");
  };

  return (
    <nav
      aria-label="Mobile Cockpit Navigation"
      class="md:hidden shrink-0 h-16 border-t border-border bg-surface/95 backdrop-blur-xl grid grid-cols-5 z-30"
    >
      <For each={NAV_ITEMS}>
        {(item) => {
          const Icon = item.icon;
          const targetRoute = () => TAB_ROUTES[item.id] || "/pipelines";
          const active = () => isItemActive(item.id);

          return (
            <A
              href={targetRoute()}
              onClick={() => props.onSelectTab?.(item.id)}
              class={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${
                active()
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon class="w-4 h-4" />
              <span class="truncate">{item.shortLabel}</span>
            </A>
          );
        }}
      </For>
    </nav>
  );
};
