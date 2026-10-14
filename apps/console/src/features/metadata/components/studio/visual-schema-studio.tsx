import React, { useState } from 'react';
import { useEntityType, useAttributeDefinitions, useCreateAttributeDefinition, useUpdateAttributeDefinition } from '../../api/metadata-api';
import type { AttributeDefinition } from '../../api/types';
import { AttributePalette } from './attribute-palette';
import { AttributePropertyInspector } from './attribute-property-inspector';
import { DynamicFormLivePreview } from './dynamic-form-live-preview';
import { FsmWorkflowDesigner } from './fsm-workflow-designer';
import type { PaletteFieldItem } from './studio-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles, Layers, Eye, GitFork, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  entityTypeId: string | number;
}

export const VisualSchemaStudio: React.FC<Props> = ({ entityTypeId }) => {
  const { data: entityType } = useEntityType(entityTypeId);
  const { data: attributesResponse, refetch: refetchAttributes } = useAttributeDefinitions(entityTypeId);
  const createAttributeMutation = useCreateAttributeDefinition(entityTypeId);
  const updateAttributeMutation = useUpdateAttributeDefinition(entityTypeId);

  const attributes = attributesResponse?.content || [];
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | number | null>(
    attributes[0]?.id || null
  );
  const [activeStudioTab, setActiveStudioTab] = useState<'canvas' | 'workflow'>('canvas');

  const selectedAttribute = attributes.find((a) => String(a.id) === String(selectedAttributeId)) || null;

  // Handle dropping or clicking a field item from the palette
  const handleSelectPaletteItem = async (item: PaletteFieldItem) => {
    try {
      const generatedSystemName = `${item.id}_${Date.now().toString(36).slice(-4)}`;
      const created = await createAttributeMutation.mutateAsync({
        name: item.label,
        systemName: generatedSystemName,
        dataType: item.defaultDataType,
        uiComponent: item.uiComponent,
        isRequired: false,
        displayOrder: attributes.length + 1,
      });

      setSelectedAttributeId(created.id);
      toast.success(`Added new ${item.label} attribute to schema.`);
    } catch (err: any) {
      toast.error(`Failed to create attribute: ${err.message || 'Unknown error'}`);
    }
  };

  const handleUpdateSelectedAttribute = (updated: Partial<AttributeDefinition>) => {
    if (!selectedAttribute) return;
    updateAttributeMutation.mutate({
      attributeId: selectedAttribute.id,
      dto: updated,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Studio Navigation & Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                Visual Studio: {entityType?.name || 'Entity Model'}
              </h2>
              <Badge variant="outline" className="text-[10px] font-mono bg-sky-500/10 text-sky-700 dark:text-sky-300">
                v{entityType?.schemaVersion || 1}.0
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dynamic schema attributes, JSON Schema constraints, and FSM lifecycle workflow canvas
            </p>
          </div>
        </div>

        <Tabs
          value={activeStudioTab}
          onValueChange={(val) => setActiveStudioTab(val as 'canvas' | 'workflow')}
          className="w-auto"
        >
          <TabsList className="bg-white/40 dark:bg-slate-800/40 border border-white/20 dark:border-white/10 p-1 rounded-xl">
            <TabsTrigger
              value="canvas"
              className="text-xs gap-1.5 px-3 py-1.5 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs"
            >
              <Layers className="h-3.5 w-3.5 text-sky-500" />
              <span>Schema Canvas & Live Preview</span>
            </TabsTrigger>
            <TabsTrigger
              value="workflow"
              className="text-xs gap-1.5 px-3 py-1.5 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs"
            >
              <GitFork className="h-3.5 w-3.5 text-indigo-500" />
              <span>FSM Workflow Studio</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeStudioTab === 'canvas' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* 1. Left Rail: Attribute Palette (3 cols) */}
          <div className="lg:col-span-3">
            <AttributePalette
              onSelectFieldType={handleSelectPaletteItem}
              disabled={createAttributeMutation.isPending}
            />
          </div>

          {/* 2. Middle Rail: Attribute Property Inspector (4 cols) */}
          <div className="lg:col-span-4">
            <AttributePropertyInspector
              attribute={selectedAttribute}
              onUpdateAttribute={handleUpdateSelectedAttribute}
              disabled={updateAttributeMutation.isPending}
            />
          </div>

          {/* 3. Right Rail: Instant Live Dynamic Form Preview (5 cols) */}
          <div className="lg:col-span-5">
            <DynamicFormLivePreview
              entityTypeName={entityType?.name || 'Record'}
              attributes={attributes}
            />
          </div>
        </div>
      ) : (
        /* FSM State Machine Workflow Designer with React Flow */
        <FsmWorkflowDesigner
          entityTypeName={entityType?.name || 'Entity'}
          workflow={
            entityType?.lifecycleConfig
              ? {
                  entityTypeId: entityType.id,
                  entityTypeSystemName: entityType.systemName,
                  version: entityType.version || 1,
                  initialState: entityType.lifecycleConfig.initial_state || 'DRAFT',
                  states: (entityType.lifecycleConfig.states || []).map((s, idx) => ({
                    id: s,
                    label: s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' '),
                    isInitial: s === (entityType.lifecycleConfig?.initial_state || 'DRAFT'),
                    isTerminal: ['ARCHIVED', 'DECOMMISSIONED', 'RETIRED', 'CANCELLED', 'CLOSED'].includes(s),
                    color: ['#38BDF8', '#34D399', '#818CF8', '#F59E0B', '#F472B6', '#10B981'][idx % 6],
                  })),
                  transitions: (entityType.lifecycleConfig.transitions || []).map((t, idx) => ({
                    id: `trans-${idx}-${t.action.toLowerCase()}`,
                    sourceState: t.from === '*' ? (entityType.lifecycleConfig?.initial_state || 'DRAFT') : t.from,
                    targetState: t.to,
                    triggerEvent: t.action,
                    label: t.action,
                    guardExpression: t.guard_expression,
                    requiredRole: t.allowed_roles?.[0],
                  })),
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
