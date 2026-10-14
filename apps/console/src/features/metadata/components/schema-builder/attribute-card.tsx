import React from 'react';
import type { AttributeDefinition } from '../../api/types';
import { FIELD_TYPE_REGISTRY } from '../../data/field-types';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import {
  useCreateAttributeDefinition,
  useArchiveAttributeDefinition,
  useUnarchiveAttributeDefinition,
} from '../../api/metadata-api';
import { Edit2, Trash2, Copy, Archive, ArchiveRestore, Lock, Sparkles, ArrowUp, ArrowDown, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/spring-auth';

interface Props {
  attribute: AttributeDefinition;
  entityTypeId: string | number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export const AttributeCard: React.FC<Props> = ({
  attribute,
  entityTypeId,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}) => {
  const { openEditAttributeDialog, openDeleteAttributeDialog } = useMetadataUiStore();
  const { isSovereignCustodian: isSovereign } = usePermissions();

  const createAttributeMutation = useCreateAttributeDefinition(entityTypeId);
  const archiveMutation = useArchiveAttributeDefinition(entityTypeId);
  const unarchiveMutation = useUnarchiveAttributeDefinition(entityTypeId);

  const isArchiving = archiveMutation.isPending || unarchiveMutation.isPending;
  const isSystemField = attribute.tenantId === 'SYSTEM';
  const isLocked = isSystemField && !isSovereign;

  const handleToggleArchive = () => {
    if (isLocked) return;
    if (attribute.isArchived) {
      unarchiveMutation.mutate(attribute.id);
    } else {
      archiveMutation.mutate(attribute.id);
    }
  };

  const fieldMeta = FIELD_TYPE_REGISTRY[attribute.uiComponent] || FIELD_TYPE_REGISTRY.text;
  const IconComponent = fieldMeta.icon;

  const handleDuplicate = () => {
    createAttributeMutation.mutate({
      name: `${attribute.name} (Copy)`,
      systemName: `${attribute.systemName}_copy_${Math.floor(Math.random() * 1000)}`,
      dataType: attribute.dataType,
      uiComponent: attribute.uiComponent,
      isRequired: attribute.isRequired,
      options: attribute.options,
      defaultValue: attribute.defaultValue,
    });
  };

  return (
    <div className={`group relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl backdrop-blur-xl border transition-all ${
      attribute.isArchived
        ? 'bg-white/20 dark:bg-slate-900/25 border-dashed border-amber-500/30 opacity-75'
        : isSystemField
        ? 'bg-sky-500/5 dark:bg-sky-950/20 border-sky-500/25 shadow-sm hover:border-sky-500/40'
        : 'bg-white/45 dark:bg-slate-900/45 border-white/30 dark:border-white/10 shadow-sm hover:shadow-md hover:border-white/50'
    }`}>
      <div className="flex items-start md:items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-inner ${
          attribute.isArchived
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            : isSystemField
            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30'
            : 'bg-primary/10 text-primary border-primary/20'
        }`}>
          <IconComponent className="h-5 w-5" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-semibold text-sm md:text-base ${attribute.isArchived ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {attribute.name}
            </span>
            <code className="text-xs font-mono text-muted-foreground bg-muted/60 dark:bg-white/5 px-2 py-0.5 rounded border border-white/20">
              {attribute.systemName}
            </code>

            {/* System Locked Badge vs Custom Attribute Badge */}
            {isSystemField ? (
              <Badge
                variant="outline"
                className={`text-[10px] gap-1 px-1.5 py-0 font-medium ${
                  isSovereign
                    ? 'text-primary dark:text-primary-foreground bg-primary/10 border-primary/30'
                    : 'text-sky-700 dark:text-sky-300 bg-sky-500/15 border-sky-500/30'
                }`}
              >
                {isSovereign ? <ShieldCheck className="h-2.5 w-2.5 text-primary" /> : <Lock className="h-2.5 w-2.5" />}
                <span>{isSovereign ? 'Canonical (Editable)' : 'System Field'}</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 font-medium text-purple-700 dark:text-purple-300 bg-purple-500/15 border-purple-500/30">
                <Sparkles className="h-2.5 w-2.5" />
                <span>Custom</span>
              </Badge>
            )}

            {attribute.isRequired ? (
              <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0">
                Required
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider px-1.5 py-0">
                Optional
              </Badge>
            )}
            {attribute.isArchived && (
              <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                Archived
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{fieldMeta.label}</span>
            <span>•</span>
            <span className="font-mono">{attribute.dataType}</span>
            {attribute.options?.choices && attribute.options.choices.length > 0 && (
              <>
                <span>•</span>
                <span>{attribute.options.choices.length} options</span>
              </>
            )}
            {attribute.defaultValue && (
              <>
                <span>•</span>
                <span>Default: <code className="font-mono text-foreground">{attribute.defaultValue}</code></span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 self-end md:self-center">
        {/* Single-Pointer / Keyboard Reorder Controls (WCAG 2.2 SC 2.5.7) */}
        {onMoveUp && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Move field ${attribute.name} up`}
            className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/30 dark:hover:bg-white/10 disabled:opacity-30"
            title="Move field up"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
        {onMoveDown && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move field ${attribute.name} down`}
            className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/30 dark:hover:bg-white/10 disabled:opacity-30"
            title="Move field down"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {/* Archive Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleArchive}
          disabled={isArchiving || isLocked}
          className={`h-8 px-2 transition-colors ${
            isLocked
              ? 'opacity-40 cursor-not-allowed text-muted-foreground'
              : attribute.isArchived
              ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
              : 'text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10'
          }`}
          title={
            isLocked
              ? 'System attributes are protected and cannot be archived'
              : attribute.isArchived
              ? 'Restore / Unarchive attribute'
              : 'Archive attribute'
          }
        >
          {attribute.isArchived ? (
            <ArchiveRestore className="h-4 w-4" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
        </Button>

        {/* Edit Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => !isLocked && openEditAttributeDialog(attribute)}
          disabled={isLocked}
          className={`h-8 px-2 text-muted-foreground ${
            isLocked
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:text-foreground hover:bg-white/30 dark:hover:bg-white/10'
          }`}
          title={isLocked ? 'System attributes are protected and cannot be modified' : 'Edit attribute definition'}
        >
          <Edit2 className="h-4 w-4" />
        </Button>

        {/* Duplicate Button (allowed even for system fields) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDuplicate}
          disabled={createAttributeMutation.isPending}
          className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/30 dark:hover:bg-white/10"
          title="Duplicate attribute as new custom field"
        >
          <Copy className="h-4 w-4" />
        </Button>

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => !isLocked && openDeleteAttributeDialog(attribute)}
          disabled={isLocked}
          className={`h-8 px-2 text-destructive ${
            isLocked
              ? 'opacity-40 cursor-not-allowed text-muted-foreground'
              : 'hover:text-destructive hover:bg-destructive/10'
          }`}
          title={isLocked ? 'System attributes are immutable and cannot be deleted' : 'Delete attribute'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
