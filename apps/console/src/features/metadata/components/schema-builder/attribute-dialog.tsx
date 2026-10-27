import React, { useEffect, useState } from 'react';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import {
  useCreateAttributeDefinition,
  useUpdateAttributeDefinition,
  useEntityTypes,
} from '../../api/metadata-api';
import { metadataService } from '../../api/metadata-service';
import { ConflictBanner, isConflictError } from '../conflict-banner';
import { useQueryClient } from '@tanstack/react-query';
import {
  FIELD_TYPE_LIST,
  FIELD_TYPE_REGISTRY,
} from '../../data/field-types';
import type { DataType, UiComponentType } from '../../api/types';
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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  entityTypeId: string | number;
}

export const AttributeDialog: React.FC<Props> = ({ entityTypeId }) => {
  const { isAttributeDialogOpen, editingAttribute, closeAttributeDialog } =
    useMetadataUiStore();

  const queryClient = useQueryClient();
  const createMutation = useCreateAttributeDefinition(entityTypeId);
  const updateMutation = useUpdateAttributeDefinition(entityTypeId);

  const isEditMode = Boolean(editingAttribute);

  // Form states
  const [name, setName] = useState('');
  const [systemName, setSystemName] = useState('');
  const [isSystemNameCustom, setIsSystemNameCustom] = useState(false);
  const [uiComponent, setUiComponent] = useState<UiComponentType>('text');
  const [dataType, setDataType] = useState<DataType>('STRING');
  const [isRequired, setIsRequired] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isIndexed, setIsIndexed] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [choices, setChoices] = useState<string[]>([]);
  const [newChoice, setNewChoice] = useState('');
  const [minVal, setMinVal] = useState<string>('');
  const [maxVal, setMaxVal] = useState<string>('');
  const [placeholder, setPlaceholder] = useState('');
  const [pattern, setPattern] = useState('');
  const [targetEntityTypeId, setTargetEntityTypeId] = useState<string>('');

  const { data: entityTypesResponse } = useEntityTypes();
  const entityTypes = entityTypesResponse?.content || [];

  // Auto-slug helper
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  useEffect(() => {
    if (editingAttribute) {
      setName(editingAttribute.name);
      setSystemName(editingAttribute.systemName);
      setIsSystemNameCustom(true);
      setUiComponent(editingAttribute.uiComponent);
      setDataType(editingAttribute.dataType);
      setIsRequired(Boolean(editingAttribute.isRequired));
      setIsArchived(Boolean(editingAttribute.isArchived));
      setIsIndexed(Boolean(editingAttribute.options?.indexed));
      setDefaultValue(editingAttribute.defaultValue || '');
      setChoices(editingAttribute.options?.choices || []);
      setMinVal(
        editingAttribute.options?.min !== undefined
          ? String(editingAttribute.options.min)
          : ''
      );
      setMaxVal(
        editingAttribute.options?.max !== undefined
          ? String(editingAttribute.options.max)
          : ''
      );
      setPlaceholder(editingAttribute.options?.placeholder || '');
      setPattern(editingAttribute.options?.pattern || '');
      setTargetEntityTypeId(
        editingAttribute.options?.targetEntityTypeId !== undefined
          ? String(editingAttribute.options.targetEntityTypeId)
          : ''
      );
    } else {
      setName('');
      setSystemName('');
      setIsSystemNameCustom(false);
      setUiComponent('text');
      setDataType('STRING');
      setIsRequired(false);
      setIsArchived(false);
      setIsIndexed(false);
      setDefaultValue('');
      setChoices([]);
      setMinVal('');
      setMaxVal('');
      setPlaceholder('');
      setPattern('');
      setTargetEntityTypeId('');
    }
  }, [editingAttribute, isAttributeDialogOpen]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isSystemNameCustom && !isEditMode) {
      setSystemName(slugify(val));
    }
  };

  const handleUiComponentChange = (newComp: UiComponentType) => {
    setUiComponent(newComp);
    const meta = FIELD_TYPE_REGISTRY[newComp];
    if (meta && !meta.compatibleDataTypes.includes(dataType)) {
      setDataType(meta.defaultDataType);
    }
  };

  const handleAddChoice = () => {
    const trimmed = newChoice.trim();
    if (trimmed && !choices.includes(trimmed)) {
      setChoices([...choices, trimmed]);
      setNewChoice('');
    }
  };

  const handleRemoveChoice = (index: number) => {
    setChoices(choices.filter((_, i) => i !== index));
  };

  const [isConflict, setIsConflict] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVersion, setLatestVersion] = useState<number | undefined>(undefined);

  useEffect(() => {
    setIsConflict(false);
    setLatestVersion(undefined);
  }, [editingAttribute, isAttributeDialogOpen]);

  const handleRefresh = async () => {
    if (!editingAttribute) return;
    setIsRefreshing(true);
    try {
      const latest = await metadataService.getAttributeDefinition(
        entityTypeId,
        editingAttribute.id
      );
      if (latest) {
        setName(latest.name);
        setSystemName(latest.systemName);
        setUiComponent(latest.uiComponent);
        setDataType(latest.dataType);
        setIsRequired(Boolean(latest.isRequired));
        setIsArchived(Boolean(latest.isArchived));
        setDefaultValue(latest.defaultValue || '');
        setChoices(latest.options?.choices || []);
        setMinVal(latest.options?.min !== undefined ? String(latest.options.min) : '');
        setMaxVal(latest.options?.max !== undefined ? String(latest.options.max) : '');
        setPlaceholder(latest.options?.placeholder || '');
        setPattern(latest.options?.pattern || '');
        setLatestVersion(latest.version);
        setIsConflict(false);
        queryClient.invalidateQueries({ queryKey: ['metadata', 'attributes', entityTypeId] });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const isDangerousRegex = (reg: string) => {
    if (!reg) return false;
    return /(\(.*[+*]\)[+*]|\([a-zA-Z0-9_[\]|-]+[+*]\)[+*])/.test(reg);
  };

  const hasDangerousPattern = isDangerousRegex(pattern);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemName.trim()) return;
    if (hasDangerousPattern) {
      alert('Regular expression pattern rejected: Catastrophic nested quantifier detected (potential ReDoS vulnerability).');
      return;
    }

    const options: Record<string, unknown> = {};
    if (choices.length > 0) options.choices = choices;
    if (minVal !== '') options.min = Number(minVal);
    if (maxVal !== '') options.max = Number(maxVal);
    if (placeholder.trim()) options.placeholder = placeholder.trim();
    if (isIndexed) options.indexed = true;
    if (uiComponent === 'relation_picker') {
      if (!targetEntityTypeId) {
        alert('Please select a Target Entity Model for the relation picker.');
        return;
      }
      options.targetEntityTypeId = targetEntityTypeId;
    }

    if (isEditMode && editingAttribute) {
      updateMutation.mutate(
        {
          attributeId: editingAttribute.id,
          dto: {
            name: name.trim(),
            systemName: systemName.trim(),
            uiComponent,
            dataType,
            isRequired,
            isArchived,
            defaultValue: defaultValue.trim(),
            options,
            version: latestVersion ?? editingAttribute.version,
          },
        },
        {
          onSuccess: () => closeAttributeDialog(),
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
          uiComponent,
          dataType,
          isRequired,
          isArchived: false,
          defaultValue: defaultValue.trim(),
          options,
        },
        {
          onSuccess: () => closeAttributeDialog(),
        }
      );
    }
  };

  const currentMeta = FIELD_TYPE_REGISTRY[uiComponent] || FIELD_TYPE_REGISTRY.text;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isAttributeDialogOpen} onOpenChange={(open) => !open && closeAttributeDialog()}>
      <DialogContent className="max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">
              {isEditMode ? 'Edit Attribute Definition' : 'Add New Attribute'}
            </DialogTitle>
            <DialogDescription>
              Configure the metadata schema specification, storage types, and validation constraints.
            </DialogDescription>
          </DialogHeader>

          {isConflict && <ConflictBanner onRefresh={handleRefresh} isRefreshing={isRefreshing} />}

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid grid-cols-2 mb-4 bg-muted/60 dark:bg-white/5 border border-white/10">
              <TabsTrigger value="general">General & Types</TabsTrigger>
              <TabsTrigger value="validation">Validation & Options</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="attr-name">Display Name *</Label>
                  <Input
                    id="attr-name"
                    value={name}
                    onChange={handleNameChange}
                    placeholder="e.g. Account Legal Name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attr-sysname">System Identifier (Key) *</Label>
                  <Input
                    id="attr-sysname"
                    value={systemName}
                    onChange={(e) => {
                      setIsSystemNameCustom(true);
                      setSystemName(slugify(e.target.value));
                    }}
                    placeholder="e.g. legal_name"
                    required
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>UI Component *</Label>
                  <Select
                    value={uiComponent}
                    onValueChange={(val) => handleUiComponentChange(val as UiComponentType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPE_LIST.map((typeDef) => (
                        <SelectItem key={typeDef.type} value={typeDef.type}>
                          <div className="flex items-center gap-2">
                            <typeDef.icon className="h-4 w-4 text-muted-foreground" />
                            <span>{typeDef.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Storage Data Type *</Label>
                  <Select
                    value={dataType}
                    onValueChange={(val) => setDataType(val as DataType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentMeta.compatibleDataTypes.map((dt) => (
                        <SelectItem key={dt} value={dt}>
                          <span className="font-mono text-xs">{dt}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {uiComponent === 'relation_picker' && (
                <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="attr-target-entity" className="text-sm font-semibold text-primary">
                      Target Entity Model *
                    </Label>
                    <span className="text-[11px] text-muted-foreground">Foreign Model Reference</span>
                  </div>
                  <Select
                    value={targetEntityTypeId}
                    onValueChange={setTargetEntityTypeId}
                  >
                    <SelectTrigger id="attr-target-entity" className="bg-white/70 dark:bg-slate-850/70 backdrop-blur-sm border-primary/30">
                      <SelectValue placeholder="Select Referenced Entity Model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {entityTypes.map((et) => (
                        <SelectItem key={et.id} value={String(et.id)}>
                          <span className="font-medium">{et.name}</span>{' '}
                          <span className="font-mono text-xs text-muted-foreground">({et.systemName})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Required. Defines which entity records can be selected as references for this attribute.
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/40 border border-white/10 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">{currentMeta.label}</p>
                <p>{currentMeta.description}</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/30 dark:bg-slate-800/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Required Field</Label>
                  <p className="text-xs text-muted-foreground">
                    Payload will be rejected during JSON schema validation if missing.
                  </p>
                </div>
                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              </div>

              {isEditMode && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/30 dark:bg-slate-800/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Archived</Label>
                    <p className="text-xs text-muted-foreground">
                      Deprecate this field from new inputs while preserving historical values.
                    </p>
                  </div>
                  <Switch checked={isArchived} onCheckedChange={setIsArchived} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="attr-default">Default Value</Label>
                <Input
                  id="attr-default"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="e.g. true, Enterprise, or 100"
                />
              </div>

              {currentMeta.hasChoices && (
                <div className="space-y-3 p-3 rounded-lg border border-white/10 bg-white/30 dark:bg-slate-800/30">
                  <Label className="text-sm font-semibold">Select Options / Choices</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newChoice}
                      onChange={(e) => setNewChoice(e.target.value)}
                      placeholder="Add an option (e.g. Enterprise)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddChoice();
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddChoice} variant="secondary" size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>

                  {choices.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {choices.map((choice, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                        >
                          <span>{choice}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveChoice(idx)}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No choices added yet.</p>
                  )}
                </div>
              )}

              {/* Functional Index Optimization */}
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3.5 backdrop-blur-sm">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="attr-indexed" className="text-sm font-medium cursor-pointer">
                    PostgreSQL Functional Index
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Accelerates queries and faceted search on this attribute with an automated PostgreSQL JSONB expression index.
                  </p>
                </div>
                <Switch
                  id="attr-indexed"
                  checked={isIndexed}
                  onCheckedChange={setIsIndexed}
                />
              </div>

              {currentMeta.hasMinMax && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="attr-min">Minimum Value</Label>
                    <Input
                      id="attr-min"
                      type="number"
                      value={minVal}
                      onChange={(e) => setMinVal(e.target.value)}
                      placeholder="e.g. 0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="attr-max">Maximum Value</Label>
                    <Input
                      id="attr-max"
                      type="number"
                      value={maxVal}
                      onChange={(e) => setMaxVal(e.target.value)}
                      placeholder="e.g. 1000"
                    />
                  </div>
                </div>
              )}

              {currentMeta.supportsOptions && !currentMeta.hasChoices && uiComponent !== 'relation_picker' && (
                <div className="space-y-2">
                  <Label htmlFor="attr-placeholder">Input Placeholder</Label>
                  <Input
                    id="attr-placeholder"
                    value={placeholder}
                    onChange={(e) => setPlaceholder(e.target.value)}
                    placeholder="Helper text displayed inside the empty field"
                  />
                </div>
              )}

              {currentMeta.hasPattern && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="attr-pattern">Regex Validation Pattern</Label>
                    {hasDangerousPattern && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-destructive">
                        <ShieldAlert className="h-3.5 w-3.5" /> ReDoS nested quantifier detected!
                      </span>
                    )}
                  </div>
                  <Input
                    id="attr-pattern"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g. ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                    className={cn(
                      "font-mono text-xs",
                      hasDangerousPattern && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {hasDangerousPattern ? (
                    <p className="text-[11px] text-destructive leading-tight">
                      Catastrophic nested quantifiers like <code>(a+)+</code> or <code>([a-z]+)*</code> are prohibited to prevent Regular Expression Denial of Service.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Client and server validate this regex with a strict 50ms timeout budget.
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeAttributeDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Attribute' : 'Create Attribute'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
