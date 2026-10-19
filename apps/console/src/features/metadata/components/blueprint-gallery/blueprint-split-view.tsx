import React, { useState, useEffect } from 'react';
import type { BlueprintSummaryDto } from '../../api/types';
import { useBlueprintDetails } from '../../api/use-blueprints';
import { BlueprintGraphCanvas } from './blueprint-graph-canvas';
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
  Database,
  GitFork,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlueprintSplitViewProps {
  blueprints: BlueprintSummaryDto[];
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

export const BlueprintSplitView: React.FC<BlueprintSplitViewProps> = ({
  blueprints,
  onSelect,
  isImporting = false,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    blueprints[0]?.id || null
  );

  // Sync selectedId if blueprints list changes or if initial is null
  useEffect(() => {
    if ((!selectedId || !blueprints.some((b) => b.id === selectedId)) && blueprints.length > 0) {
      setSelectedId(blueprints[0].id);
    }
  }, [blueprints, selectedId]);

  const activeSummary = blueprints.find((b) => b.id === selectedId) || blueprints[0];
  const { data: blueprintDetails, isLoading: detailsLoading } = useBlueprintDetails(selectedId);

  const entityTypes = blueprintDetails?.entityTypes || [];
  const relationshipTypes = blueprintDetails?.relationshipTypes || [];

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0 h-full rounded-2xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-lg">
      {/* Left Master Rail */}
      <div className="w-full md:w-[32%] lg:w-[28%] flex flex-col border-b md:border-b-0 md:border-r border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-900/20 shrink-0 min-h-0">
        <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Templates ({blueprints.length})
          </span>
          <span className="text-[10px] text-muted-foreground">Select to inspect</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-1.5 space-y-1">
          {blueprints.map((bp) => {
            const isSelected = bp.id === selectedId;
            const IconComponent = iconMap[bp.icon] || Layers;

            return (
              <button
                key={bp.id}
                type="button"
                onClick={() => setSelectedId(bp.id)}
                className={cn(
                  'w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 outline-none',
                  isSelected
                    ? 'bg-primary/10 border border-primary/30 shadow-xs ring-1 ring-primary/20'
                    : 'hover:bg-white/40 dark:hover:bg-white/5 border border-transparent'
                )}
              >
                <div
                  className={cn(
                    'p-2 rounded-lg shrink-0 border transition-transform',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary scale-105'
                      : 'bg-muted/80 text-muted-foreground border-white/10'
                  )}
                >
                  <IconComponent className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-foreground truncate">
                      {bp.name}
                    </span>
                    {isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                    {bp.description}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                      {bp.entityTypesCount} Models
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0">
                      {bp.relationshipTypesCount} Edges
                    </Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Detail Inspector Pane */}
      <div className="flex-1 w-full min-w-0 flex flex-col min-h-0 bg-white/30 dark:bg-slate-900/30">
        {activeSummary ? (
          <>
            {/* Inspector Header */}
            <div className="p-4 border-b border-white/10 flex items-start justify-between gap-4 shrink-0 bg-white/40 dark:bg-slate-900/40">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground truncate">
                    {activeSummary.name}
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {activeSummary.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {activeSummary.description}
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => onSelect(activeSummary.id)}
                disabled={isImporting}
                className="shrink-0 h-8 px-3 text-xs gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
              >
                <span>Use Blueprint</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Topology Graph & Entity Models */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs">Loading blueprint models and graph...</span>
                </div>
              ) : (
                <>
                  {/* Real-time SVG Canvas Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <GitFork className="w-3.5 h-3.5 text-primary" />
                        <span>Topological Relationship Graph</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {relationshipTypes.length} Active Connections
                      </span>
                    </div>

                    <div className="rounded-xl border border-white/20 dark:border-white/10 overflow-hidden bg-white/20 dark:bg-slate-950/40">
                      <BlueprintGraphCanvas
                        entityTypes={entityTypes}
                        relationshipTypes={relationshipTypes}
                      />
                    </div>
                  </div>

                  {/* Included Entity Models */}
                  <div>
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                      <Database className="w-3.5 h-3.5 text-primary" />
                      <span>Included Entity Models ({entityTypes.length})</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {entityTypes.map((ent) => (
                        <div
                          key={ent.systemName}
                          className="p-2.5 rounded-lg border border-white/15 dark:border-white/5 bg-white/40 dark:bg-white/5 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-xs text-foreground block truncate">
                              {ent.name}
                            </span>
                            <code className="text-[10px] font-mono text-muted-foreground">
                              {ent.systemName}
                            </code>
                          </div>
                          <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
                            {ent.attributes?.length || 0} fields
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-xs">
            Select a blueprint from the left rail to inspect.
          </div>
        )}
      </div>
    </div>
  );
};
