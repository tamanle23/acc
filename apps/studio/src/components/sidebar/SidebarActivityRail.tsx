import React from 'react';
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
} from 'lucide-react';
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
  icon: React.ComponentType<{ className?: string }>;
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

export const SidebarActivityRail: React.FC<SidebarActivityRailProps> = ({
  isOpen,
  onToggle,
  activeNav,
  setActiveNav,
  onSelectCategory,
}) => {
  return (
    <aside className="w-12 glass-panel border-r border-border/50 flex flex-col items-center py-3 justify-between shadow-sm z-20">
      <div className="flex flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id && isOpen;
          return (
            <React.Fragment key={item.id}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (activeNav === item.id && isOpen) {
                    onToggle();
                  } else {
                    setActiveNav(item.id);
                    if (item.category) {
                      onSelectCategory(item.category);
                    }
                    if (!isOpen) onToggle();
                  }
                }}
                className={`w-9 h-9 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title={item.title}
              >
                <Icon className="w-4 h-4" />
              </Button>
              {item.dividerAfter && <div className="w-5 h-[1px] bg-border/40 my-0.5" />}
            </React.Fragment>
          );
        })}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title={isOpen ? 'Collapse Left Drawer ([)' : 'Expand Left Drawer ([)'}
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </Button>
    </aside>
  );
};
