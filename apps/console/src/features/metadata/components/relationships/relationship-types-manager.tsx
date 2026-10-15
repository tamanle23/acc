import React, { useMemo, useCallback } from 'react';
import {
  useRelationshipTypes,
  useEntityTypes,
} from '../../api/metadata-api';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import type { RelationshipType } from '../../api/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GitFork,
  Plus,
  ArrowRight,
  Edit2,
  Trash2,
  Info,
} from 'lucide-react';

interface Props {
  entityTypeId: string | number;
}

export const RelationshipTypesManager: React.FC<Props> = ({ entityTypeId }) => {
  const {
    openCreateRelationshipTypeDialog,
    openEditRelationshipTypeDialog,
    openDeleteRelationshipTypeDialog,
  } = useMetadataUiStore();

  const { data: relTypesResponse, isLoading } = useRelationshipTypes();
  const { data: entityTypesResponse } = useEntityTypes();

  const entityTypes = entityTypesResponse?.content || [];
  const allRelTypes = relTypesResponse?.content || [];

  // Optimization: Pre-index entityTypes into Map lookup to avoid O(N) scans per item in render loop
  const entityTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const et of entityTypes) {
      map.set(String(et.id), et.name);
    }
    return map;
  }, [entityTypes]);

  // Filter relationship types relevant to this entity model (either as source or target)
  const currentRelTypes = useMemo(() => {
    const idStr = String(entityTypeId);
    return allRelTypes.filter(
      (rt) =>
        String(rt.sourceEntityTypeId) === idStr ||
        String(rt.targetEntityTypeId) === idStr
    );
  }, [allRelTypes, entityTypeId]);

  const getEntityName = useCallback((id: string | number) => {
    return entityTypeMap.get(String(id)) || `Entity #${id}`;
  }, [entityTypeMap]);

  const getCardinalityBadge = (cardinality: string) => {
    switch (cardinality) {
      case 'ONE_TO_ONE':
        return <Badge variant="secondary" className="text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">1 : 1</Badge>;
      case 'ONE_TO_MANY':
        return <Badge variant="secondary" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">1 : N</Badge>;
      case 'MANY_TO_ONE':
        return <Badge variant="secondary" className="text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">N : 1</Badge>;
      case 'MANY_TO_MANY':
        return <Badge variant="secondary" className="text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">N : N</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] font-mono">{cardinality}</Badge>;
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0 flex flex-col flex-1 min-h-0 overflow-y-auto pr-1">
      {/* Architectural Guidance Banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200">
        <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-700 dark:text-blue-300">
            Relationship Architecture: Graph Edges vs. Field Lookups
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong>Graph Edges (configured here):</strong> Manage multi-cardinality (<code className="text-[11px] font-mono">1:1, 1:N, N:1, N:N</code>) connections with bidirectional indexing, lifecycle cascade rules, and edge metadata.
            <br />
            <strong>Field Lookups (<code className="text-[11px] font-mono">relation_picker</code>):</strong> Configured in the <em>Schema Builder</em> as lightweight single foreign key references inside record JSON attributes (e.g., <code className="text-[11px] font-mono">default_policy_id</code>).
          </p>
        </div>
      </div>

      {/* Top action bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm">
        <div>
          <h2 className="font-bold text-sm md:text-base text-foreground flex items-center gap-2">
            <GitFork className="h-4 w-4 text-primary" />
            Model Graph Relationships
          </h2>
          <p className="text-xs text-muted-foreground">
            Define edge schema connections, cardinality rules, and referential constraints.
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateRelationshipTypeDialog}
          className="gap-1.5 h-9 text-xs shadow-md shadow-primary/20"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Relationship Edge</span>
        </Button>
      </div>

      {/* Relationships List Canvas */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-muted-foreground">
          Loading relationships...
        </div>
      ) : currentRelTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-white/30 dark:bg-slate-900/30 backdrop-blur-md border border-dashed border-white/30 dark:border-white/10 text-muted-foreground">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
            <GitFork className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-foreground mb-1 text-sm md:text-base">
            No Relationship Types Configured
          </h3>
          <p className="text-xs max-w-sm mb-4">
            Connect this entity model to other entities (e.g. Orders, Profiles, Deployments) by defining relationship edge types.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={openCreateRelationshipTypeDialog}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Create First Relationship
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentRelTypes.map((rel: RelationshipType) => {
            const isSource = String(rel.sourceEntityTypeId) === String(entityTypeId);
            return (
              <div
                key={rel.id}
                className="group relative flex flex-col justify-between gap-3 p-4 rounded-xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm hover:shadow-md hover:border-white/50 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-sm">
                      {rel.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {getCardinalityBadge(rel.cardinality)}
                      <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                        {isSource ? 'Outgoing Edge' : 'Incoming Edge'}
                      </Badge>
                    </div>
                  </div>

                  <code className="text-xs font-mono text-muted-foreground bg-muted/60 dark:bg-white/5 px-2 py-0.5 rounded border border-white/20 inline-block">
                    {rel.systemName}
                  </code>

                  {rel.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {rel.description}
                    </p>
                  )}

                  {/* Flow Diagram */}
                  <div className="flex items-center gap-2 pt-2 text-xs font-medium">
                    <span className={`px-2 py-1 rounded-md border ${
                      isSource
                        ? 'bg-primary/10 text-primary border-primary/20 font-bold'
                        : 'bg-muted/50 text-foreground border-white/10'
                    }`}>
                      {getEntityName(rel.sourceEntityTypeId)}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className={`px-2 py-1 rounded-md border ${
                      !isSource
                        ? 'bg-primary/10 text-primary border-primary/20 font-bold'
                        : 'bg-muted/50 text-foreground border-white/10'
                    }`}>
                      {getEntityName(rel.targetEntityTypeId)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-white/10 mt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditRelationshipTypeDialog(rel)}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/30 dark:hover:bg-white/10"
                    title="Edit relationship type"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteRelationshipTypeDialog(rel)}
                    className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Delete relationship type"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
