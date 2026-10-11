import React, { useMemo, useState } from 'react';
import { useAttributeDefinitions, useEntityType } from '../../api/metadata-api';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import { AttributeCard } from './attribute-card';
import { AttributeDialog } from './attribute-dialog';
import { AttributeDeleteDialog } from './attribute-delete-dialog';
import { SchemaJsonPreview } from './schema-json-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Code, Search, Layers, Sparkles } from 'lucide-react';

interface Props {
  entityTypeId: string | number;
}

export const SchemaBuilder: React.FC<Props> = ({ entityTypeId }) => {
  const { data: attributesResponse, isLoading } = useAttributeDefinitions(entityTypeId);
  const { data: entityType } = useEntityType(entityTypeId);
  const { openCreateAttributeDialog, openJsonSchemaPreview } = useMetadataUiStore();

  const [fieldSearch, setFieldSearch] = useState('');
  const [orderedAttributes, setOrderedAttributes] = useState<AttributeDefinition[]>([]);
  const [a11yStatus, setA11yStatus] = useState<string>('');

  const serverAttributes = useMemo(() => {
    return attributesResponse?.content || [];
  }, [attributesResponse]);

  // Keep local ordered state synchronized with fetched response
  React.useEffect(() => {
    setOrderedAttributes(serverAttributes);
  }, [serverAttributes]);

  const attributes = orderedAttributes.length > 0 ? orderedAttributes : serverAttributes;

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newOrdered = [...attributes];
    const item = newOrdered[index];
    newOrdered[index] = newOrdered[index - 1];
    newOrdered[index - 1] = item;
    setOrderedAttributes(newOrdered);
    setA11yStatus(`Moved field ${item.name} up to position ${index} of ${newOrdered.length}.`);
  };

  const handleMoveDown = (index: number) => {
    if (index >= attributes.length - 1) return;
    const newOrdered = [...attributes];
    const item = newOrdered[index];
    newOrdered[index] = newOrdered[index + 1];
    newOrdered[index + 1] = item;
    setOrderedAttributes(newOrdered);
    setA11yStatus(`Moved field ${item.name} down to position ${index + 2} of ${newOrdered.length}.`);
  };

  const filteredAttributes = useMemo(() => {
    if (!fieldSearch.trim()) return attributes;
    const query = fieldSearch.toLowerCase();
    return attributes.filter(
      (attr) =>
        attr.name.toLowerCase().includes(query) ||
        attr.systemName.toLowerCase().includes(query) ||
        attr.dataType.toLowerCase().includes(query) ||
        attr.uiComponent.toLowerCase().includes(query)
    );
  }, [attributes, fieldSearch]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Loading schema definitions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0 flex flex-col flex-1 min-h-0 overflow-y-auto pr-1">
      {/* Schema Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/25">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {entityType ? entityType.name : 'Entity'} Schema
            </h2>
            <Badge 
              variant={attributes.length >= 100 ? "destructive" : "secondary"} 
              className="px-2 py-0.5 text-xs font-semibold"
              title={attributes.length >= 100 ? "Maximum limit of 100 attributes reached" : `${attributes.length} of 100 attributes used`}
            >
              {attributes.length}/100 Fields
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Define attributes, data constraints, and UI presentation components for this model.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              placeholder="Filter fields..."
              className="pl-8 h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={openJsonSchemaPreview}
            className="h-9 gap-1.5 text-xs bg-white/40 dark:bg-white/5 border-white/20 hover:bg-white/60"
          >
            <Code className="h-4 w-4 text-primary" />
            <span>Draft-07 JSON</span>
          </Button>

          <Button
            size="sm"
            onClick={openCreateAttributeDialog}
            disabled={attributes.length >= 100}
            className="h-9 gap-1.5 text-xs shadow-md shadow-primary/20 disabled:opacity-50"
            title={attributes.length >= 100 ? "Maximum limit of 100 attributes reached for this model" : "Add Field"}
          >
            <Plus className="h-4 w-4" />
            <span>Add Field</span>
          </Button>
        </div>
      </div>

      {/* Accessible Live Region for Reordering Announcements (SC 2.5.7) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {a11yStatus}
      </div>

      {/* Attributes List */}
      <div className="space-y-3">
        {attributes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-white/30 dark:bg-slate-900/30 backdrop-blur-md border border-dashed border-white/30 dark:border-white/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No Fields Defined</h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              This entity type currently has no schema properties. Add attributes to start capturing structured data.
            </p>
            <Button size="sm" onClick={openCreateAttributeDialog} className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Define First Field
            </Button>
          </div>
        ) : filteredAttributes.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-white/20 dark:bg-slate-900/20 text-muted-foreground text-xs">
            No fields match your search filter "{fieldSearch}".
          </div>
        ) : (
          filteredAttributes.map((attr, idx) => (
            <AttributeCard
              key={attr.id}
              attribute={attr}
              entityTypeId={entityTypeId}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
              isFirst={idx === 0}
              isLast={idx === filteredAttributes.length - 1}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <AttributeDialog entityTypeId={entityTypeId} />
      <AttributeDeleteDialog entityTypeId={entityTypeId} />
      <SchemaJsonPreview
        entityTypeId={entityTypeId}
        entityTypeName={entityType?.name}
      />
    </div>
  );
};
