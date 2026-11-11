import { Component, For, Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-solid";
import { Button } from "@/components/ui/button";
import type { StudioWorkspaceId } from "@/types/studio";
import { NAV_ITEMS } from "@/constants/studio-constants";

export interface StudioSidebarNavProps {
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
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

export const StudioSidebarNav: Component<StudioSidebarNavProps> = (props) => {
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
    <aside
      aria-label="Cockpit Module Navigation"
      class={`hidden md:flex flex-col justify-between border-r border-border/80 bg-surface/55 shrink-0 transition-all duration-200 ${
        props.sidebarExpanded ? "w-56" : "w-16"
      }`}
    >
      <div class="p-2 space-y-1" role="tablist" aria-orientation="vertical">
        <For each={NAV_ITEMS}>
          {(item) => {
            const Icon = item.icon;
            const targetRoute = () => TAB_ROUTES[item.id] || "/pipelines";
            const active = () => isItemActive(item.id);

            return (
              <A
                href={targetRoute()}
                onClick={() => props.onSelectTab?.(item.id)}
                title={!props.sidebarExpanded ? item.label : undefined}
                class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active()
                    ? "bg-primary text-primary-foreground shadow-glow font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                } ${!props.sidebarExpanded ? "justify-center px-0" : ""}`}
              >
                <Icon class="w-4 h-4 shrink-0" aria-hidden="true" />
                <Show when={props.sidebarExpanded}>
                  <span class="truncate flex-1 text-left">{item.label}</span>
                  <Show when={item.badge}>
                    <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-background/30">
                      {item.badge}
                    </span>
                  </Show>
                </Show>
              </A>
            );
          }}
        </For>
      </div>

      <div class="p-2 border-t border-border/70">
        <Button
          variant="ghost"
          size="icon"
          onClick={props.onToggleSidebar}
          title={props.sidebarExpanded ? "Collapse Rail" : "Expand Rail"}
          class="w-full h-9"
        >
          <Show
            when={props.sidebarExpanded}
            fallback={<PanelLeftOpen class="w-4 h-4" />}
          >
            <PanelLeftClose class="w-4 h-4" />
          </Show>
        </Button>
      </div>
    </aside>
  );
};
