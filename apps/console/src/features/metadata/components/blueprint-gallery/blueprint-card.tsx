import React from 'react';
import type { BlueprintSummaryDto } from '../../api/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  Newspaper,
  Briefcase,
  Layers,
  HeartPulse,
  Home,
  ArrowRight,
  Eye,
} from 'lucide-react';

interface Props {
  blueprint: BlueprintSummaryDto;
  isSelected?: boolean;
  onPreview: (id: string) => void;
  onSelect: (id: string) => void;
  isImporting?: boolean;
}

const iconMap: Record<string, any> = {
  Truck,
  Newspaper,
  Briefcase,
  Layers,
  HeartPulse,
  Home,
};

export const BlueprintCard: React.FC<Props> = ({
  blueprint,
  isSelected,
  onPreview,
  onSelect,
  isImporting,
}) => {
  const IconComponent = iconMap[blueprint.icon] || Layers;

  return (
    <div
      className={`group relative p-4 sm:p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 min-w-0 overflow-hidden
        backdrop-blur-xl border 
        ${
          isSelected
            ? 'bg-blue-500/15 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/30'
            : 'bg-white/60 dark:bg-slate-900/60 border-white/30 dark:border-white/10 hover:border-white/60 hover:bg-white/80 dark:hover:bg-slate-900/80 shadow-md shadow-black/5'
        }
      `}
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
            <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0.5">
              {blueprint.entityTypesCount} Models
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5">
              {blueprint.relationshipTypesCount} Edges
            </Badge>
          </div>
        </div>

        <h4 className="mt-3 font-bold text-slate-900 dark:text-white text-base tracking-tight truncate" title={blueprint.name}>
          {blueprint.name}
        </h4>
        <div className="mt-0.5 mb-1.5">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {blueprint.category}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed" title={blueprint.description}>
          {blueprint.description}
        </p>
      </div>

      <div className="mt-5 pt-3 border-t border-white/20 dark:border-white/10 flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onPreview(blueprint.id)}
          className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5"
        >
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span>Preview</span>
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={() => onSelect(blueprint.id)}
          disabled={isImporting}
          className="h-8 px-3 text-xs gap-1.5 font-semibold bg-primary/90 hover:bg-primary text-primary-foreground shadow-xs"
        >
          <span>Use Blueprint</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
