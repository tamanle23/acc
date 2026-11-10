import { For, Show, type Component } from 'solid-js';
import {
  Folder,
  Type,
  Square,
  Sparkles,
  Volume2,
  Film,
  Music,
  ChevronLeft,
  ChevronRight,
} from 'lucide-solid';
import { Button } from '../ui/button';
import type { LeftNavTab } from '../LeftSidebar';
import type { PresetCategory } from '../../lib/library/stagingPresets';

export interface SidebarActivityRailProps {
  isOpen: boolean;
  onToggle: () => void;
  activeNav: LeftNavTab;
  setActiveNav: (nav: LeftNavTab) => void;
  onSelectCategory: (cat: 'all' | PresetCategory) => void;
}

const NAV_ITEMS: Array<{
  id: LeftNavTab;
  category?: PresetCategory;
  title: string;
  icon: Component<{ class?: string }>;
  dividerAfter?: boolean;
}> = [
  {
    id: 'vault',
    title: 'Assets Vault (Upload & Media) ([)',
    icon: Folder,
    dividerAfter: true,
  },
  {
    id: 'typography',
    category: 'text',
    title: 'Typography Library (16+ Styles)',
    icon: Type,
  },
  {
    id: 'shapes',
    category: 'shape',
    title: 'Designer Shapes (16+ Vector Geometries)',
    icon: Square,
  },
  {
    id: 'vfx',
    category: 'vfx',
    title: 'Cinematic VFX Overlays (16+ Atmospheric Layers)',
    icon: Sparkles,
  },
  {
    id: 'sfx',
    category: 'sfx',
    title: 'Sound FX Catalog (104+ Curated SFX)',
    icon: Volume2,
  },
  {
    id: 'video',
    category: 'video',
    title: 'Production Video Footages (Curated 4K/HD Plates)',
    icon: Film,
  },
  {
    id: 'audio',
    category: 'audio',
    title: 'Audio Clips (BGM & Soundtracks)',
    icon: Music,
  },
];

export function SidebarActivityRail(props: SidebarActivityRailProps) {
  return (
    <aside class="w-12 glass-panel border-r border-border/50 flex flex-col items-center py-3 justify-between shadow-glass z-20">
      <div class="flex flex-col items-center gap-2">
        <For each={NAV_ITEMS}>
          {(item) => {
            const Icon = item.icon;
            const isActive = () => props.activeNav === item.id && props.isOpen;
            return (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (props.activeNav === item.id && props.isOpen) {
                      props.onToggle();
                    } else {
                      props.setActiveNav(item.id);
                      if (item.category) {
                        props.onSelectCategory(item.category);
                      }
                      if (!props.isOpen) props.onToggle();
                    }
                  }}
                  class={`w-9 h-9 rounded-lg transition-colors ${
                    isActive()
                      ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title={item.title}
                >
                  <Icon class="w-4 h-4" />
                </Button>
                <Show when={item.dividerAfter}>
                  <div class="w-5 h-[1px] bg-border/40 my-0.5" />
                </Show>
              </>
            );
          }}
        </For>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={props.onToggle}
        class="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title={props.isOpen ? 'Collapse Left Drawer ([)' : 'Expand Left Drawer ([)'}
      >
        <Show when={props.isOpen} fallback={<ChevronRight class="w-4 h-4" />}>
          <ChevronLeft class="w-4 h-4" />
        </Show>
      </Button>
    </aside>
  );
}
