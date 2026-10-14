import React, { useEffect, useState } from 'react';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import { useCreateEntityType, useUpdateEntityType } from '../../api/metadata-api';
import { metadataService } from '../../api/metadata-service';
import { ConflictBanner, isConflictError } from '../conflict-banner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export const EntityTypeDialog: React.FC = () => {
  const {
    isEntityTypeDialogOpen,
    editingEntityType,
    closeEntityTypeDialog,
    setSelectedEntityTypeId,
  } = useMetadataUiStore();

  const queryClient = useQueryClient();
  const createMutation = useCreateEntityType();
  const updateMutation = useUpdateEntityType(editingEntityType?.id || '');

  const isEditMode = Boolean(editingEntityType);

  const [name, setName] = useState('');
  const [systemName, setSystemName] = useState('');
  const [isSystemNameCustom, setIsSystemNameCustom] = useState(false);
  const [description, setDescription] = useState('');

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  useEffect(() => {
    if (editingEntityType) {
      setName(editingEntityType.name);
      setSystemName(editingEntityType.systemName);
      setIsSystemNameCustom(true);
      setDescription(editingEntityType.description || '');
    } else {
      setName('');
      setSystemName('');
      setIsSystemNameCustom(false);
      setDescription('');
    }
  }, [editingEntityType, isEntityTypeDialogOpen]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isSystemNameCustom && !isEditMode) {
      setSystemName(slugify(val));
    }
  };

  const [isConflict, setIsConflict] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVersion, setLatestVersion] = useState<number | undefined>(undefined);

  useEffect(() => {
    setIsConflict(false);
    setLatestVersion(undefined);
  }, [editingEntityType, isEntityTypeDialogOpen]);

  const handleRefresh = async () => {
    if (!editingEntityType) return;
    setIsRefreshing(true);
    try {
      const latest = await metadataService.getEntityTypeById(editingEntityType.id);
      if (latest) {
        setName(latest.name);
        setSystemName(latest.systemName);
        setDescription(latest.description || '');
        setLatestVersion(latest.version);
        setIsConflict(false);
        queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-types'] });
        queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-type', editingEntityType.id] });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemName.trim()) return;

    if (isEditMode && editingEntityType) {
      updateMutation.mutate(
        {
          name: name.trim(),
          systemName: systemName.trim(),
          description: description.trim(),
          version: latestVersion ?? editingEntityType.version,
        },
        {
          onSuccess: () => closeEntityTypeDialog(),
          onError: (err: unknown) => {
            if (isConflictError(err)) setIsConflict(true);
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          name: name.trim(),
          systemName: systemName.trim(),
          description: description.trim(),
        },
        {
          onSuccess: (newEntity) => {
            closeEntityTypeDialog();
            if (newEntity?.id) {
              setSelectedEntityTypeId(String(newEntity.id));
            }
          },
        }
      );
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isEntityTypeDialogOpen} onOpenChange={(open) => !open && closeEntityTypeDialog()}>
      <DialogContent className="max-w-lg w-[90vw] p-6 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">
              {isEditMode ? 'Edit Entity Type' : 'Create Entity Type'}
            </DialogTitle>
            <DialogDescription>
              Define a new data model schema domain for managing dynamic attributes and records.
            </DialogDescription>
          </DialogHeader>

          {isConflict && <ConflictBanner onRefresh={handleRefresh} isRefreshing={isRefreshing} />}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entity-name">Model Name *</Label>
              <Input
                id="entity-name"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. Cloud Resource Spec"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity-sysname">System Identifier *</Label>
              <Input
                id="entity-sysname"
                value={systemName}
                onChange={(e) => {
                  setIsSystemNameCustom(true);
                  setSystemName(slugify(e.target.value));
                }}
                placeholder="e.g. cloud_resource_spec"
                required
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity-desc">Description</Label>
              <Textarea
                id="entity-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Purpose, domain context, and usage documentation..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeEntityTypeDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Entity' : 'Create Entity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
