import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useBlueprintDetails,
  useProvisionTenantBlueprint,
} from '../../api/use-blueprints';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import { BlueprintGraphCanvas } from './blueprint-graph-canvas';
import {
  Database,
  GitFork,
  LayoutTemplate,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useReactTable,
  getCoreRowModel,
} from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import type { AttributeDefinitionDto } from '../../api/types';

interface Props {
  blueprintId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function BlueprintAttributesDataTable({ attributes }: { attributes: AttributeDefinitionDto[] }) {
  const columns = React.useMemo<ColumnDef<AttributeDefinitionDto>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Attribute Name',
        cell: ({ row }) => (
          <span className="font-medium text-foreground text-xs">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'systemName',
        header: 'System Name',
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">{row.original.systemName}</span>
        ),
      },
      {
        accessorKey: 'dataType',
        header: 'Data Type',
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-[10px] font-mono">
            {row.original.dataType}
          </Badge>
        ),
      },
      {
        accessorKey: 'uiComponent',
        header: 'UI Widget',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.original.uiComponent}</span>
        ),
      },
      {
        accessorKey: 'isRequired',
        header: () => <div className="text-center">Required</div>,
        cell: ({ row }) => (
          <div className="text-center text-xs">
            {row.original.isRequired ? (
              <span className="text-amber-500 font-bold">Yes</span>
            ) : (
              <span className="text-muted-foreground">Optional</span>
            )}
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: attributes,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataTable
      showRowIndex
      table={table}
      noResultsMessage="No attributes defined for this model."
    />
  );
}

export const TemplatePreviewModal: React.FC<Props> = ({
  blueprintId,
  isOpen,
  onClose,
}) => {
  const { data: blueprint, isLoading } = useBlueprintDetails(blueprintId);
  const provisionMutation = useProvisionTenantBlueprint();
  const { activeTenantId, activeTenantName, closeBlueprintGallery } = useMetadataUiStore();

  const [selectedEntityIndex, setSelectedEntityIndex] = useState(0);

  if (!isOpen || !blueprintId) return null;

  const entityTypes = blueprint?.entityTypes || [];
  const relationshipTypes = blueprint?.relationshipTypes || [];
  const activeEntity = entityTypes[selectedEntityIndex] || entityTypes[0];

  const handleImport = async () => {
    if (!blueprint) return;
    await provisionMutation.mutateAsync({
      tenantId: activeTenantId,
      tenantName: activeTenantName,
      blueprintId: blueprint.id,
    });
    onClose();
    closeBlueprintGallery();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[88vh] flex flex-col p-4 sm:p-6 rounded-3xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-2xl overflow-hidden">
        <DialogHeader className="space-y-1 shrink-0 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  {blueprint?.name || 'Loading Blueprint Details...'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                  {blueprint?.description}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono font-medium">
                {entityTypes.length} Models
              </Badge>
              <Badge variant="outline" className="text-xs font-mono font-medium">
                {relationshipTypes.length} Edges
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground flex-1">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs">Inspecting blueprint manifest & schema definitions...</span>
          </div>
        ) : (
          <Tabs defaultValue="models" className="flex flex-col flex-1 min-h-0 pt-2">
            <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-4 bg-muted/60 backdrop-blur-md">
              <TabsTrigger value="models" className="text-xs gap-1.5">
                <Database className="h-3.5 w-3.5 text-blue-500" />
                <span>Models & Fields</span>
              </TabsTrigger>
              <TabsTrigger value="graph" className="text-xs gap-1.5">
                <GitFork className="h-3.5 w-3.5 text-violet-500" />
                <span>Relationship Graph</span>
              </TabsTrigger>
              <TabsTrigger value="form" className="text-xs gap-1.5">
                <LayoutTemplate className="h-3.5 w-3.5 text-emerald-500" />
                <span>Dynamic Form</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Models & Field Attribute Explorer */}
            <TabsContent value="models" className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 overflow-hidden">
              {/* Left Models Rail */}
              <div className="w-full md:w-56 shrink-0 flex flex-col gap-1.5 overflow-y-auto pr-1">
                {entityTypes.map((et, index) => (
                  <button
                    key={et.systemName}
                    type="button"
                    onClick={() => setSelectedEntityIndex(index)}
                    className={cn(
                      'p-2.5 rounded-xl text-left transition-all border text-xs flex items-center justify-between',
                      selectedEntityIndex === index
                        ? 'bg-primary/15 border-primary/40 font-semibold text-primary shadow-xs'
                        : 'bg-white/40 dark:bg-white/5 border-white/20 hover:bg-white/60 dark:hover:bg-white/10 text-foreground'
                    )}
                  >
                    <span className="truncate">{et.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {et.attributes.length} f
                    </span>
                  </button>
                ))}
              </div>

              {/* Right Attributes Table */}
              <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20 p-4">
                {activeEntity ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{activeEntity.name}</h4>
                        <p className="text-[11px] text-muted-foreground">{activeEntity.description}</p>
                      </div>
                      <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        {activeEntity.systemName}
                      </code>
                    </div>

                    <BlueprintAttributesDataTable attributes={activeEntity.attributes} />
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Select a model from the left to inspect attributes.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 2: Relationship Architecture Graph */}
            <TabsContent value="graph" className="flex-1 min-h-0 flex flex-col justify-center">
              <BlueprintGraphCanvas
                entityTypes={entityTypes}
                relationshipTypes={relationshipTypes}
              />
            </TabsContent>

            {/* Tab 3: Dynamic Form Mockup Preview */}
            <TabsContent value="form" className="flex-1 min-h-0 overflow-y-auto p-4 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20">
              {activeEntity ? (
                <div className="max-w-lg mx-auto space-y-4">
                  <div className="border-b border-border/40 pb-2">
                    <h4 className="font-semibold text-sm text-foreground">
                      Sample Form: {activeEntity.name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Auto-generated form layout matching the blueprint attribute specifications.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {activeEntity.attributes.slice(0, 5).map((attr) => (
                      <div key={attr.systemName} className="space-y-1">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          <span>{attr.name}</span>
                          {attr.isRequired && <span className="text-destructive">*</span>}
                        </label>
                        {attr.uiComponent === 'textarea' ? (
                          <textarea
                            readOnly
                            disabled
                            placeholder={`Enter ${attr.name.toLowerCase()}...`}
                            rows={2}
                            className="w-full text-xs p-2.5 rounded-lg border bg-muted/40 cursor-not-allowed opacity-80"
                          />
                        ) : attr.uiComponent === 'switch' ? (
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-9 rounded-full bg-primary/40 relative">
                              <div className="h-4 w-4 rounded-full bg-white absolute top-0.5 right-0.5 shadow-xs" />
                            </div>
                            <span className="text-[11px] text-muted-foreground">Toggle flag</span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            readOnly
                            disabled
                            placeholder={`Enter ${attr.name.toLowerCase()}...`}
                            className="w-full text-xs p-2 rounded-lg border bg-muted/40 cursor-not-allowed opacity-80"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        )}

        {/* Modal Action Footer */}
        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={provisionMutation.isPending || !blueprint}
            className="text-xs gap-1.5 font-semibold bg-primary text-primary-foreground shadow-md hover:shadow-lg"
          >
            {provisionMutation.isPending ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Pre-warming Cache & Seeding...</span>
              </>
            ) : (
              <>
                <span>Import This Blueprint</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
