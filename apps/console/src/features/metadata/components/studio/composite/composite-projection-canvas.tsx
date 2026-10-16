import React from 'react';
import { useAttributeDefinitions } from '../../../api/metadata-api';
import type { CompositeSpec, CompositeNode, EntityType } from '../../../api/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Layers,
  Link2,
  GitMerge,
  Trash2,
  CornerDownRight,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

interface Props {
  spec: CompositeSpec;
  rootEntity: EntityType | null;
  onUpdateSpec: (updated: CompositeSpec) => void;
  onSelectEntityForNestedJoin?: (parentNode: CompositeNode, depth: number) => void;
}

export const CompositeProjectionCanvas: React.FC<Props> = ({
  spec,
  rootEntity,
  onUpdateSpec,
}) => {
  const { data: rootAttrsResponse } = useAttributeDefinitions(spec.root_entity_type_id);
  const rootAttributes = rootAttrsResponse?.content || [];

  const handleRootAliasChange = (newAlias: string) => {
    onUpdateSpec({
      ...spec,
      root_alias: newAlias,
    });
  };

  const handleToggleRootField = (sourceAttr: string, checked: boolean) => {
    const existing = spec.fields || [];
    if (checked) {
      if (!existing.some((f) => f.source_attribute === sourceAttr)) {
        onUpdateSpec({
          ...spec,
          fields: [
            ...existing,
            { source_attribute: sourceAttr, alias: sourceAttr, data_type: 'string', required: false },
          ],
        });
      }
    } else {
      onUpdateSpec({
        ...spec,
        fields: existing.filter((f) => f.source_attribute !== sourceAttr),
      });
    }
  };

  const handleUpdateRootFieldAlias = (sourceAttr: string, alias: string) => {
    onUpdateSpec({
      ...spec,
      fields: (spec.fields || []).map((f) =>
        f.source_attribute === sourceAttr ? { ...f, alias } : f
      ),
    });
  };

  const handleRemoveChildNode = (index: number) => {
    const newChildren = [...(spec.children || [])];
    newChildren.splice(index, 1);
    onUpdateSpec({
      ...spec,
      children: newChildren,
    });
  };

  const handleUpdateChildNode = (index: number, updatedNode: CompositeNode) => {
    const newChildren = [...(spec.children || [])];
    newChildren[index] = updatedNode;
    onUpdateSpec({
      ...spec,
      children: newChildren,
    });
  };

  return (
    <div className="flex flex-col h-[750px] rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 p-4 overflow-hidden">
      {/* Canvas Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Tree Projection Canvas
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Map and synthesize root attributes & lateral child joins
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[11px] font-mono px-2 py-0.5 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
          >
            Root: {spec.root_entity_system_name || 'root'}
          </Badge>
        </div>
      </div>

      {/* Canvas Body (Scrollable Tree) */}
      <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 custom-scrollbar">
        {/* ========================================== */}
        {/* 1. Root Entity Node Card (Depth Level 1)   */}
        {/* ========================================== */}
        <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-sky-500/30 shadow-xs relative">
          <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-500 text-[10px] font-bold text-white">
                1
              </span>
              <span className="text-xs font-bold text-foreground">
                Root: {rootEntity?.name || spec.root_entity_system_name}
              </span>
              <Badge variant="secondary" className="text-[9px] uppercase font-semibold">
                Level 1 • Base Root
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Root Alias:</span>
              <Input
                value={spec.root_alias || ''}
                placeholder={spec.root_entity_system_name}
                onChange={(e) => handleRootAliasChange(e.target.value)}
                className="h-6 w-32 text-xs bg-white dark:bg-slate-900 border-border/60 rounded-lg px-2"
              />
            </div>
          </div>

          {/* Root Fields Checklist */}
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground mb-2">
              Projected Root Attributes:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {rootAttributes.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic col-span-2">
                  No attributes defined for root entity.
                </div>
              ) : (
                rootAttributes.map((attr) => {
                  const isChecked = (spec.fields || []).some(
                    (f) => f.source_attribute === attr.systemName
                  );
                  const matchedField = (spec.fields || []).find(
                    (f) => f.source_attribute === attr.systemName
                  );

                  return (
                    <div
                      key={attr.id}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
                        isChecked
                          ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-400/30'
                          : 'bg-slate-50/50 dark:bg-slate-900/40 border-border/30 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(c) => handleToggleRootField(attr.systemName, Boolean(c))}
                          id={`attr-root-${attr.id}`}
                        />
                        <label
                          htmlFor={`attr-root-${attr.id}`}
                          className="font-medium truncate cursor-pointer text-foreground"
                          title={attr.name}
                        >
                          {attr.name}
                          <span className="text-[10px] text-muted-foreground font-mono ml-1">
                            ({attr.systemName})
                          </span>
                        </label>
                      </div>

                      {isChecked && (
                        <div className="flex items-center gap-1 shrink-0">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Input
                            value={matchedField?.alias || ''}
                            onChange={(e) =>
                              handleUpdateRootFieldAlias(attr.systemName, e.target.value)
                            }
                            placeholder={attr.systemName}
                            className="h-6 w-24 text-[10px] bg-white dark:bg-slate-900 border-border/50 rounded-md px-1.5"
                            title="Alias in composite projection"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. Child Nodes Tree (Depth Levels 2 - 4)  */}
        {/* ========================================== */}
        <div className="space-y-3 pl-3 border-l-2 border-indigo-500/30 ml-2">
          {(!spec.children || spec.children.length === 0) ? (
            <div className="p-6 rounded-xl border border-dashed border-border/60 text-center bg-white/20 dark:bg-slate-800/20">
              <CornerDownRight className="h-5 w-5 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-xs font-semibold text-foreground">No Child Joins Configured</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto mt-1">
                Select an entity from the Base Entity Catalog on the left rail to attach a Pattern B (🔗 Foreign Key) or Pattern C (ᛦ Association) projection.
              </p>
            </div>
          ) : (
            spec.children.map((childNode, idx) => (
              <ChildNodeRenderer
                key={`${childNode.target_entity_type_id}-${idx}`}
                node={childNode}
                depth={2}
                onUpdate={(updated) => handleUpdateChildNode(idx, updated)}
                onRemove={() => handleRemoveChildNode(idx)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-component for rendering Child Join Nodes recursively up to Level 4
interface ChildNodeRendererProps {
  node: CompositeNode;
  depth: number;
  onUpdate: (updated: CompositeNode) => void;
  onRemove: () => void;
}

const ChildNodeRenderer: React.FC<ChildNodeRendererProps> = ({
  node,
  depth,
  onUpdate,
  onRemove,
}) => {
  const { data: childAttrsResponse } = useAttributeDefinitions(node.target_entity_type_id);
  const childAttributes = childAttrsResponse?.content || [];

  const handleToggleField = (sourceAttr: string, checked: boolean) => {
    const existing = node.fields || [];
    if (checked) {
      if (!existing.some((f) => f.source_attribute === sourceAttr)) {
        onUpdate({
          ...node,
          fields: [
            ...existing,
            { source_attribute: sourceAttr, alias: sourceAttr, data_type: 'string', required: false },
          ],
        });
      }
    } else {
      onUpdate({
        ...node,
        fields: existing.filter((f) => f.source_attribute !== sourceAttr),
      });
    }
  };

  const handleUpdateFieldAlias = (sourceAttr: string, alias: string) => {
    onUpdate({
      ...node,
      fields: (node.fields || []).map((f) =>
        f.source_attribute === sourceAttr ? { ...f, alias } : f
      ),
    });
  };

  const isMaxDepth = depth >= 4;

  return (
    <div className="p-3.5 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-indigo-500/20 shadow-xs relative">
      {/* Node Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500 text-[10px] font-bold text-white">
            {depth}
          </span>
          <span className="text-xs font-bold text-foreground">
            Join: {node.target_entity_system_name}
          </span>

          {node.join_pattern === 'PATTERN_B_FOREIGN_KEY' ? (
            <Badge
              variant="outline"
              className="text-[9px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 flex items-center gap-1"
            >
              <Link2 className="h-2.5 w-2.5" />
              <span>Pattern B 🔗</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[9px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 flex items-center gap-1"
            >
              <GitMerge className="h-2.5 w-2.5" />
              <span>Pattern C ᛦ</span>
            </Badge>
          )}

          <Badge
            variant="secondary"
            className="text-[9px] font-mono px-1.5 py-0"
          >
            Level {depth} {isMaxDepth ? '(Max Ceiling)' : ''}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={onRemove}
            className="h-6 w-6 text-muted-foreground hover:text-rose-500"
            title="Remove Join Node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Join Parameters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 bg-slate-50/60 dark:bg-slate-900/60 p-2 rounded-lg border border-border/20 text-xs">
        <div>
          <label htmlFor={`node-alias-${node.target_entity_type_id}-${depth}`} className="text-[10px] text-muted-foreground block mb-0.5">Projection Alias:</label>
          <Input
            id={`node-alias-${node.target_entity_type_id}-${depth}`}
            value={node.alias || ''}
            placeholder={node.target_entity_system_name}
            onChange={(e) => onUpdate({ ...node, alias: e.target.value })}
            className="h-6 text-xs bg-white dark:bg-slate-800"
          />
        </div>

        <div>
          <label htmlFor={`node-cardinality-${node.target_entity_type_id}-${depth}`} className="text-[10px] text-muted-foreground block mb-0.5">Cardinality:</label>
          <select
            id={`node-cardinality-${node.target_entity_type_id}-${depth}`}
            value={node.cardinality || 'ONE_TO_MANY'}
            onChange={(e) =>
              onUpdate({
                ...node,
                cardinality: e.target.value as 'ONE_TO_ONE' | 'ONE_TO_MANY',
              })
            }
            className="h-6 w-full text-xs bg-white dark:bg-slate-800 border border-border rounded-md px-1"
          >
            <option value="ONE_TO_MANY">1:N (Array Object)</option>
            <option value="ONE_TO_ONE">1:1 (Single Object)</option>
          </select>
        </div>

        {node.join_pattern === 'PATTERN_B_FOREIGN_KEY' && (
          <div>
            <label htmlFor={`node-fk-${node.target_entity_type_id}-${depth}`} className="text-[10px] text-muted-foreground block mb-0.5">FK Attribute Key:</label>
            <Input
              id={`node-fk-${node.target_entity_type_id}-${depth}`}
              value={node.foreign_key_attribute || ''}
              placeholder="e.g. customer_id"
              onChange={(e) => onUpdate({ ...node, foreign_key_attribute: e.target.value })}
              className="h-6 text-xs bg-white dark:bg-slate-800"
            />
          </div>
        )}
      </div>

      {/* Child Fields Selection */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground mb-1.5">
          Projected Child Fields:
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {childAttributes.map((attr) => {
            const isChecked = (node.fields || []).some(
              (f) => f.source_attribute === attr.systemName
            );
            const matchedField = (node.fields || []).find(
              (f) => f.source_attribute === attr.systemName
            );

            return (
              <div
                key={attr.id}
                className={`p-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-1.5 ${
                  isChecked
                    ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-400/30'
                    : 'bg-slate-50/40 dark:bg-slate-900/40 border-border/30 opacity-70'
                }`}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(c) => handleToggleField(attr.systemName, Boolean(c))}
                    id={`attr-${node.target_entity_type_id}-${attr.id}`}
                  />
                  <label
                    htmlFor={`attr-${node.target_entity_type_id}-${attr.id}`}
                    className="truncate cursor-pointer font-medium"
                    title={attr.name}
                  >
                    {attr.name}
                  </label>
                </div>

                {isChecked && (
                  <Input
                    value={matchedField?.alias || ''}
                    onChange={(e) => handleUpdateFieldAlias(attr.systemName, e.target.value)}
                    placeholder={attr.systemName}
                    className="h-5 w-20 text-[10px] bg-white dark:bg-slate-900 border-border/50 rounded px-1"
                    title="Alias in projection"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Max Depth Notice */}
      {isMaxDepth && (
        <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          <span>Maximum hierarchy depth ceiling of 4 levels reached. Further nested joins disabled.</span>
        </div>
      )}
    </div>
  );
};
