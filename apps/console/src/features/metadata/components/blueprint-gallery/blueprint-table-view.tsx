import React, { useState, useMemo } from 'react';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface BlueprintTableViewProps {
  blueprints: BlueprintSummaryDto[];
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

type SortField = 'name' | 'category' | 'entityTypesCount' | 'relationshipTypesCount';

export const BlueprintTableView: React.FC<BlueprintTableViewProps> = ({
  blueprints,
  onPreview,
  onSelect,
  isImporting = false,
}) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedBlueprints = useMemo(() => {
    return [...blueprints].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [blueprints, sortField, sortDirection]);

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse table-fixed">
          <thead>
            <tr className="border-b border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
              <th scope="col" className="p-2.5 pl-4 w-[28%] min-w-[180px]">
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="group flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <span>Template & Name</span>
                  {renderSortIndicator('name')}
                </button>
              </th>
              <th scope="col" className="p-2.5 w-[18%] min-w-[130px]">
                <button
                  type="button"
                  onClick={() => handleSort('category')}
                  className="group flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <span>Category</span>
                  {renderSortIndicator('category')}
                </button>
              </th>
              <th scope="col" className="p-2.5 w-[30%] min-w-[180px]">
                <span>Description</span>
              </th>
              <th scope="col" className="p-2.5 text-center w-[8%] min-w-[65px]">
                <button
                  type="button"
                  onClick={() => handleSort('entityTypesCount')}
                  className="group inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <span>Models</span>
                  {renderSortIndicator('entityTypesCount')}
                </button>
              </th>
              <th scope="col" className="p-2.5 text-center w-[8%] min-w-[65px]">
                <button
                  type="button"
                  onClick={() => handleSort('relationshipTypesCount')}
                  className="group inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <span>Edges</span>
                  {renderSortIndicator('relationshipTypesCount')}
                </button>
              </th>
              <th scope="col" className="p-2.5 pr-4 text-right w-[16%] min-w-[130px]">
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {sortedBlueprints.map((bp) => {
              const IconComponent = iconMap[bp.icon] || Layers;

              return (
                <tr
                  key={bp.id}
                  className="group hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
                >
                  {/* Template & Name */}
                  <td className="p-3 pl-4 font-medium text-foreground">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                          {bp.name}
                        </div>
                        <code className="text-[10px] font-mono text-muted-foreground">
                          {bp.id}
                        </code>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5 whitespace-nowrap">
                      {bp.category}
                    </Badge>
                  </td>

                  {/* Description */}
                  <td className="p-3 text-muted-foreground text-xs max-w-xs">
                    <p className="line-clamp-2" title={bp.description}>
                      {bp.description}
                    </p>
                  </td>

                  {/* Models Count */}
                  <td className="p-3 text-center">
                    <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0.5">
                      {bp.entityTypesCount}
                    </Badge>
                  </td>

                  {/* Edges Count */}
                  <td className="p-3 text-center">
                    <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">
                      {bp.relationshipTypesCount}
                    </Badge>
                  </td>

                  {/* Quick Actions */}
                  <td className="p-3 pr-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onPreview(bp.id)}
                        className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5"
                        title="Preview Blueprint Graph"
                      >
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        <span className="hidden sm:inline">Preview</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onSelect(bp.id)}
                        disabled={isImporting}
                        className="h-7 px-2.5 text-xs gap-1 font-semibold bg-primary/90 hover:bg-primary text-primary-foreground shadow-xs"
                      >
                        <span>Use</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
