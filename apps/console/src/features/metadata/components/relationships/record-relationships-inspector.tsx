import React, { useState, useMemo, useCallback } from 'react';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import {
  useRecordRelationships,
  useCreateEntityRelationship,
  useDeleteEntityRelationship,
  useRelationshipTypes,
  useEntityTypes,
  useEntityRecords,
} from '../../api/metadata-api';
import type { EntityRelationship } from '../../api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitFork, Link as LinkIcon, Trash2, Plus, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export const RecordRelationshipsInspector: React.FC = () => {
  const { inspectingRecordRelationships, closeRecordRelationshipsInspector } =
    useMetadataUiStore();

  const record = inspectingRecordRelationships;
  const recordId = record?.id || null;

  const { data: relationshipsResponse, isLoading } = useRecordRelationships(recordId, {
    direction: 'both',
  });
  const { data: relTypesResponse } = useRelationshipTypes();
  const { data: entityTypesResponse } = useEntityTypes();

  const relationships = relationshipsResponse?.content || [];
  const relationshipTypes = relTypesResponse?.content || [];
  const entityTypes = entityTypesResponse?.content || [];

  // Optimization: Pre-index entityTypes and relationshipTypes into Map lookups
  // to convert O(N) array scans into O(1) constant-time lookups during list rendering.
  const entityTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const et of entityTypes) {
      map.set(String(et.id), et.name);
    }
    return map;
  }, [entityTypes]);

  const relTypeMap = useMemo(() => {
    const map = new Map<string, { name: string; targetEntityTypeId: string | number }>();
    for (const rt of relationshipTypes) {
      map.set(String(rt.id), { name: rt.name, targetEntityTypeId: rt.targetEntityTypeId });
    }
    return map;
  }, [relationshipTypes]);

  const createRelMutation = useCreateEntityRelationship(recordId || '');
  const deleteRelMutation = useDeleteEntityRelationship(recordId || '');

  // Form state for linking a new record
  const [selectedRelTypeId, setSelectedRelTypeId] = useState<string>('');
  const [targetRecordId, setTargetRecordId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  // O(1) lookup for selected relationship type
  const selectedRelType = selectedRelTypeId ? relTypeMap.get(String(selectedRelTypeId)) : null;

  const targetEntityTypeId = selectedRelType ? selectedRelType.targetEntityTypeId : null;
  const { data: targetRecordsResponse } = useEntityRecords(
    targetEntityTypeId || '',
    { size: 50 }
  );
  const targetRecords = targetRecordsResponse?.content || [];

  const handleCreateLink = () => {
    if (!recordId || !selectedRelTypeId || !targetRecordId) {
      toast.error('Please select both a relationship type and a target record.');
      return;
    }

    createRelMutation.mutate(
      {
        relationshipTypeId: selectedRelTypeId,
        sourceRecordId: recordId,
        targetRecordId: targetRecordId,
      },
      {
        onSuccess: () => {
          toast.success('Relationship link created successfully');
          setIsAdding(false);
          setSelectedRelTypeId('');
          setTargetRecordId('');
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : 'Failed to link record');
        },
      }
    );
  };

  const handleDeleteLink = (relId: string | number) => {
    deleteRelMutation.mutate(relId, {
      onSuccess: () => {
        toast.success('Relationship link removed');
      },
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Failed to remove link');
      },
    });
  };

  const getEntityName = useCallback((id: string | number) => {
    return entityTypeMap.get(String(id)) || `Entity #${id}`;
  }, [entityTypeMap]);

  const getRelTypeName = useCallback((id: string | number) => {
    const found = relTypeMap.get(String(id));
    return found ? found.name : `Edge #${id}`;
  }, [relTypeMap]);

  return (
    <Dialog
      open={Boolean(record)}
      onOpenChange={(open) => !open && closeRecordRelationshipsInspector()}
    >
      <DialogContent className="max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <GitFork className="h-5 w-5 text-primary" />
            Connected Edges
          </DialogTitle>
          <DialogDescription>
            Inspect and manage connected entity edges for Record #{record?.id}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick link action / toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/20">
            <div className="text-xs">
              <span className="font-semibold text-foreground">Active Connections:</span>{' '}
              <span className="text-muted-foreground">{relationships.length} links</span>
            </div>
            <Button
              size="sm"
              variant={isAdding ? 'secondary' : 'default'}
              onClick={() => setIsAdding(!isAdding)}
              className="text-xs gap-1.5 h-8"
            >
              {isAdding ? 'Cancel' : <><Plus className="h-3.5 w-3.5" /> Link New Record</>}
            </Button>
          </div>

          {/* Add relationship link inline card */}
          {isAdding && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" /> Link Target Record
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Relationship Edge Type</Label>
                  <Select
                    value={selectedRelTypeId}
                    onValueChange={(val) => {
                      setSelectedRelTypeId(val);
                      setTargetRecordId('');
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white/60 dark:bg-slate-800/60 border-white/20">
                      <SelectValue placeholder="Select Relationship Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {relationshipTypes.map((rt) => (
                        <SelectItem key={rt.id} value={String(rt.id)}>
                          {rt.name} ({rt.cardinality})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    Target Record {selectedRelType ? `(${getEntityName(selectedRelType.targetEntityTypeId)})` : ''}
                  </Label>
                  {targetRecords.length > 0 ? (
                    <Select
                      value={targetRecordId}
                      onValueChange={setTargetRecordId}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white/60 dark:bg-slate-800/60 border-white/20">
                        <SelectValue placeholder="Select Target Record" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetRecords.map((tr) => {
                          const displayLabel =
                            (tr.attributes?.legal_name as string) ||
                            (tr.attributes?.resource_code as string) ||
                            (tr.attributes?.policy_id as string) ||
                            `Record #${tr.id}`;
                          return (
                            <SelectItem key={tr.id} value={String(tr.id)}>
                              #{tr.id} - {displayLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="text"
                      placeholder="Target Record ID..."
                      value={targetRecordId}
                      onChange={(e) => setTargetRecordId(e.target.value)}
                      className="h-8 text-xs bg-white/60 dark:bg-slate-800/60 border-white/20 font-mono"
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={handleCreateLink}
                  disabled={createRelMutation.isPending || !selectedRelTypeId || !targetRecordId}
                  className="text-xs h-8"
                >
                  {createRelMutation.isPending ? 'Linking...' : 'Confirm Edge Link'}
                </Button>
              </div>
            </div>
          )}

          {/* Relationships list */}
          <ScrollArea className="max-h-[50vh] pr-2">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Loading connected records...
              </div>
            ) : relationships.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No active relationship edges connected to this record.
              </div>
            ) : (
              <div className="space-y-2 py-1">
                {relationships.map((rel: EntityRelationship) => {
                  const isSource = String(rel.sourceRecordId) === String(recordId);
                  const connectedRecordId = isSource ? rel.targetRecordId : rel.sourceRecordId;

                  return (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-white/20 hover:border-white/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                          {isSource ? (
                            <ArrowRight className="h-4 w-4" />
                          ) : (
                            <ArrowLeft className="h-4 w-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">
                              {getRelTypeName(rel.relationshipTypeId)}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {isSource ? 'Outbound' : 'Inbound'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            Connected Record ID: <span className="font-bold text-foreground">#{connectedRecordId}</span>
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLink(rel.id)}
                        disabled={deleteRelMutation.isPending}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Unlink record relationship"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
