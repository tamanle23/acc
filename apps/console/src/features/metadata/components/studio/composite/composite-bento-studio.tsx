import React, { useState, useMemo } from 'react';
import { useEntityType, useUpdateEntityType } from '../../../api/metadata-api';
import type { CompositeSpec, CompositeNode, EntityType } from '../../../api/types';
import { CompositeCatalogRail } from './composite-catalog-rail';
import { CompositeProjectionCanvas } from './composite-projection-canvas';
import { CompositePreviewHub } from './composite-preview-hub';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Boxes, Save, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  entityTypeId: string | number;
}

export const CompositeBentoStudio: React.FC<Props> = ({ entityTypeId }) => {
  const { data: entityType, isLoading } = useEntityType(entityTypeId);
  const updateEntityTypeMutation = useUpdateEntityType(entityTypeId);

  // Maintain local override if user edits, otherwise derive from entityType
  const [specOverride, setSpecOverride] = useState<CompositeSpec | null>(null);

  const initialSpec: CompositeSpec = useMemo(() => {
    if (entityType?.compositeSpec) {
      return entityType.compositeSpec;
    }
    return {
      root_entity_type_id: entityTypeId,
      root_entity_system_name: entityType?.systemName || 'root',
      root_alias: entityType?.systemName || 'root',
      fields: [],
      children: [],
    };
  }, [entityType, entityTypeId]);

  const spec = specOverride ?? initialSpec;
  const setSpec = (updater: CompositeSpec | ((prev: CompositeSpec) => CompositeSpec)) => {
    if (typeof updater === 'function') {
      setSpecOverride((prev) => updater(prev ?? initialSpec));
    } else {
      setSpecOverride(updater);
    }
  };

  // Compute maximum tree depth
  const maxDepth = useMemo(() => {
    const calculateDepth = (nodes: CompositeNode[] = [], currentDepth: number): number => {
      if (!nodes || nodes.length === 0) return currentDepth;
      let maxChild = currentDepth;
      nodes.forEach((n) => {
        const d = calculateDepth(n.children || [], currentDepth + 1);
        if (d > maxChild) maxChild = d;
      });
      return maxChild;
    };
    return calculateDepth(spec.children || [], 1);
  }, [spec]);

  // UI Pre-flight Cycle Detection
  const cycleDetected = useMemo(() => {
    const rootId = String(spec.root_entity_type_id);
    const checkCycle = (nodes: CompositeNode[] = [], visitedPath: string[]): boolean => {
      for (const node of nodes) {
        const id = String(node.target_entity_type_id);
        if (visitedPath.includes(id) || id === rootId) {
          return true;
        }
        if (node.children && checkCycle(node.children, [...visitedPath, id])) {
          return true;
        }
      }
      return false;
    };
    return checkCycle(spec.children || [], []);
  }, [spec]);

  const handleAddChildNode = (
    targetEntity: EntityType,
    pattern: 'PATTERN_B_FOREIGN_KEY' | 'PATTERN_C_ASSOCIATION'
  ) => {
    if (maxDepth >= 4) {
      toast.error('Cannot add join: Maximum hierarchy depth ceiling of 4 levels reached.');
      return;
    }

    if (String(targetEntity.id) === String(spec.root_entity_type_id)) {
      toast.error('Cycle detected: Cannot join root entity to itself.');
      return;
    }

    const newNode: CompositeNode = {
      target_entity_type_id: targetEntity.id,
      target_entity_system_name: targetEntity.systemName,
      alias: targetEntity.systemName.toLowerCase(),
      join_pattern: pattern,
      foreignKeyAttribute: pattern === 'PATTERN_B_FOREIGN_KEY' ? 'root_id' : undefined,
      cardinality: 'ONE_TO_MANY',
      fields: [],
      children: [],
    };

    setSpec((prev) => ({
      ...prev,
      children: [...(prev.children || []), newNode],
    }));

    toast.success(`Attached ${targetEntity.name} join node to composite spec.`);
  };

  const handleSaveSpec = async () => {
    if (cycleDetected) {
      toast.error('Cannot save: Cyclic hierarchy dependency detected in tree.');
      return;
    }

    if (maxDepth > 4) {
      toast.error('Cannot save: Spec exceeds maximum depth ceiling of 4 levels.');
      return;
    }

    try {
      await updateEntityTypeMutation.mutateAsync({
        name: entityType?.name || 'Composite Entity',
        description: entityType?.description,
        version: entityType?.version,
        isComposite: true,
        compositeSpec: spec,
      });
      toast.success('Composite Specification saved successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save composite specification: ${message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-xs text-muted-foreground">
        Loading Composite Studio...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Studio Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/20">
            <Boxes className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                Composite Bento Studio: {entityType?.name || 'Virtual Entity'}
              </h2>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono ${
                  maxDepth <= 4
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                }`}
              >
                Depth: {maxDepth} / 4 Levels
              </Badge>

              {cycleDetected ? (
                <Badge variant="destructive" className="text-[10px] gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Cycle Detected</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Valid Tree AST</span>
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Master-Detail Bento Builder for real-time virtual projection trees across Pattern B and Pattern C joins
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveSpec}
            disabled={updateEntityTypeMutation.isPending || cycleDetected || maxDepth > 4}
            className="h-8 gap-1.5 text-xs bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-sm"
          >
            {updateEntityTypeMutation.isPending ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Save Composite Spec</span>
          </Button>
        </div>
      </div>

      {/* 3-Pane Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* 1. Left Catalog Rail (3 cols) */}
        <div className="lg:col-span-3">
          <CompositeCatalogRail
            rootEntityTypeId={entityTypeId}
            onAddChildNode={handleAddChildNode}
            disabled={updateEntityTypeMutation.isPending || maxDepth >= 4}
          />
        </div>

        {/* 2. Middle Rail: Tree Projection Canvas (5 cols) */}
        <div className="lg:col-span-5">
          <CompositeProjectionCanvas
            spec={spec}
            rootEntity={entityType || null}
            onUpdateSpec={setSpec}
          />
        </div>

        {/* 3. Right Rail: Live Preview Hub (4 cols) */}
        <div className="lg:col-span-4">
          <CompositePreviewHub spec={spec} />
        </div>
      </div>
    </div>
  );
};
