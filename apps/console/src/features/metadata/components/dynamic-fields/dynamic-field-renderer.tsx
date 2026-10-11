import React from 'react';
import type { AttributeDefinition } from '../../api/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useEntityRecords } from '../../api/metadata-api';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import { WidgetRegistry, registerStandardWidgets } from '@unipost/ui';

// Initialize standard pluggable widgets once
registerStandardWidgets();

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { X, Lock, Sparkles, Check, ChevronsUpDown, AlertTriangle, Link2 } from 'lucide-react';

interface RelationPickerControlProps {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  targetEntityTypeId?: string | number;
  placeholder?: string;
  errorClass: string;
}

const RelationPickerControl: React.FC<RelationPickerControlProps> = ({
  id,
  value,
  onChange,
  targetEntityTypeId,
  placeholder,
  errorClass,
}) => {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data: recordsResponse, isLoading } = useEntityRecords(targetEntityTypeId || '', {
    size: 100,
  });
  const records = recordsResponse?.content || [];

  const stringVal = value !== undefined && value !== null ? String(value) : '';

  const selectedRecord = records.find(
    (r) => String(r.id) === stringVal
  );

  // If a value exists but is not found in the current active records
  const isDanglingReference = Boolean(stringVal && !selectedRecord && !isLoading);

  const formatLabel = (r: (typeof records)[0]) => {
    return (
      (r.attributes?.legal_name as string) ||
      (r.attributes?.resource_code as string) ||
      (r.attributes?.policy_id as string) ||
      (r.attributes?.name as string) ||
      `Record #${r.id}`
    );
  };

  return (
    <div className="space-y-2">
      {targetEntityTypeId ? (
        <Popover open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-1.5">
            <PopoverTrigger asChild>
              <Button
                id={id}
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn(
                  'w-full justify-between font-normal bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-left h-9 text-xs',
                  !stringVal && 'text-muted-foreground',
                  errorClass
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {selectedRecord ? (
                    <span className="truncate">
                      <span className="font-mono font-semibold">#{selectedRecord.id}</span> -{' '}
                      {formatLabel(selectedRecord)}
                    </span>
                  ) : stringVal ? (
                    <span className="font-mono text-amber-500 truncate">
                      #{stringVal} (External / Custom)
                    </span>
                  ) : (
                    <span>{placeholder || 'Search target entity record...'}</span>
                  )}
                </div>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>

            {stringVal && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => onChange('')}
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <PopoverContent className="w-[360px] p-0 shadow-2xl border-white/20 dark:border-white/10" align="start">
            <Command>
              <CommandInput
                placeholder="Search by ID, name, or code..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="text-xs"
              />
              <CommandList>
                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                  {isLoading ? 'Loading records...' : 'No matching records found.'}
                </CommandEmpty>
                <CommandGroup heading="Available Target Records">
                  {records.map((r) => {
                    const isSelected = String(r.id) === stringVal;
                    const label = formatLabel(r);
                    return (
                      <CommandItem
                        key={r.id}
                        value={`${r.id} ${label} ${r.tenantId || ''}`}
                        onSelect={() => {
                          onChange(isSelected ? '' : String(r.id));
                          setOpen(false);
                        }}
                        className="text-xs cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Check
                            className={cn(
                              'h-3.5 w-3.5 text-primary shrink-0',
                              isSelected ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span className="font-mono font-semibold text-[11px]">#{r.id}</span>
                          <span className="truncate">{label}</span>
                        </div>
                        {r.tenantId && (
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                            {r.tenantId}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <Input
          id={id}
          type="text"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Target Entity Record ID...'}
          className={cn('bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm font-mono text-xs', errorClass)}
        />
      )}

      {/* Target Record Live Preview Card */}
      {selectedRecord && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs animate-in fade-in-50">
          <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 bg-primary/10 text-primary shrink-0">
            #{selectedRecord.id}
          </Badge>
          <span className="font-semibold text-foreground truncate">
            {formatLabel(selectedRecord)}
          </span>
          {selectedRecord.tenantId && (
            <span className="text-[10px] text-muted-foreground ml-auto font-mono shrink-0">
              {selectedRecord.tenantId}
            </span>
          )}
        </div>
      )}

      {/* Dangling Reference Warning Card */}
      {isDanglingReference && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 animate-in fade-in-50">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="truncate">
            Referenced record <code className="font-mono font-bold">#{stringVal}</code> was not found or has been archived.
          </span>
        </div>
      )}
    </div>
  );
};

interface Props {
  attribute: AttributeDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

export const DynamicFieldRenderer: React.FC<Props> = ({
  attribute,
  value,
  onChange,
  error,
  disabled = false,
  readOnly = false,
}) => {
  const { name, systemName, uiComponent, isRequired, options } = attribute;

  const errorClass = error
    ? 'border-destructive/80 focus-visible:ring-destructive/40 focus:border-destructive shadow-[0_0_8px_rgba(239,68,68,0.25)]'
    : 'border-white/20';

  const renderControl = () => {
    switch (uiComponent) {
      case 'text':
        return (
          <Input
            id={systemName}
            type="text"
            value={typeof value === 'string' || typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={options?.placeholder || `Enter ${name.toLowerCase()}...`}
            className={cn('bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm', errorClass)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            id={systemName}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={options?.placeholder || `Enter ${name.toLowerCase()}...`}
            rows={3}
            className={cn('bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm', errorClass)}
          />
        );

      case 'number':
        return (
          <Input
            id={systemName}
            type="number"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => {
              const val = e.target.value;
              onChange(val === '' ? '' : Number(val));
            }}
            min={options?.min}
            max={options?.max}
            placeholder={options?.placeholder || '0'}
            className={cn('bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm', errorClass)}
          />
        );

      case 'switch':
        return (
          <div className="flex items-center gap-3 pt-1">
            <Switch
              id={systemName}
              checked={Boolean(value)}
              onCheckedChange={(checked) => onChange(checked)}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {value ? 'Active / True' : 'Inactive / False'}
            </span>
          </div>
        );

      case 'select':
        return (
          <Select
            value={typeof value === 'string' ? value : ''}
            onValueChange={(val) => onChange(val)}
          >
            <SelectTrigger
              id={systemName}
              className={cn('bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm', errorClass)}
            >
              <SelectValue placeholder={options?.placeholder || `Select ${name}...`} />
            </SelectTrigger>
            <SelectContent>
              {options?.choices?.map((choice) => (
                <SelectItem key={choice} value={choice}>
                  {choice}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect': {
        const selectedList = Array.isArray(value) ? (value as string[]) : [];
        const choices = options?.choices || [];

        const toggleChoice = (choice: string) => {
          if (selectedList.includes(choice)) {
            onChange(selectedList.filter((c) => c !== choice));
          } else {
            onChange([...selectedList, choice]);
          }
        };

        return (
          <div className="space-y-2">
            <div
              className={cn(
                'flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-lg border bg-white/40 dark:bg-slate-800/40',
                errorClass
              )}
            >
              {selectedList.length === 0 ? (
                <span className="text-xs text-muted-foreground self-center">
                  None selected
                </span>
              ) : (
                selectedList.map((selected) => (
                  <Badge
                    key={selected}
                    variant="secondary"
                    className="gap-1 text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20"
                  >
                    <span>{selected}</span>
                    <button
                      type="button"
                      onClick={() => toggleChoice(selected)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            {choices.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {choices.map((c) => {
                  const isChosen = selectedList.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleChoice(c)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                        isChosen
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground border-white/10'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case 'datepicker':
        return (
          <Input
            id={systemName}
            type="date"
            value={typeof value === 'string' ? value.split('T')[0] : ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn('bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm font-mono text-xs', errorClass)}
          />
        );

      case 'json_editor':
        return (
          <Textarea
            id={systemName}
            value={
              typeof value === 'object' && value !== null
                ? JSON.stringify(value, null, 2)
                : typeof value === 'string'
                ? value
                : '{}'
            }
            onChange={(e) => {
              const text = e.target.value;
              try {
                const parsed = JSON.parse(text);
                onChange(parsed);
              } catch {
                onChange(text);
              }
            }}
            rows={4}
            className={cn('font-mono text-xs bg-slate-950/80 text-emerald-400', errorClass)}
            placeholder="{}"
          />
        );

      case 'relation_picker': {
        const targetEntityTypeId = options?.targetEntityTypeId || options?.entityTypeId;
        return (
          <RelationPickerControl
            id={systemName}
            value={value}
            onChange={onChange}
            targetEntityTypeId={targetEntityTypeId as string | number | undefined}
            placeholder={options?.placeholder || 'Select or enter Target Entity Record ID...'}
            errorClass={errorClass}
          />
        );
      }

      default: {
        // OCP Invariant: Check if a pluggable widget is registered in WidgetRegistry
        const CustomWidget = WidgetRegistry.get(uiComponent);
        if (CustomWidget) {
          return (
            <CustomWidget
              value={value}
              onChange={onChange}
              attribute={attribute}
              disabled={disabled}
              readOnly={readOnly}
              error={error}
              errorClass={errorClass}
              placeholder={options?.placeholder}
            />
          );
        }

        return (
          <Input
            id={systemName}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn('bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm', errorClass)}
          />
        );
      }
    }
  };

  const { workspaceMode } = useMetadataUiStore();
  const isSystemField = attribute.tenantId === 'SYSTEM';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={systemName} className="text-xs font-semibold text-foreground">
            {name} {isRequired && <span className="text-destructive">*</span>}
          </Label>

          {/* Technical Schema Inspection Badges for Architect Mode */}
          {workspaceMode === 'architect' && (
            isSystemField ? (
              <Badge variant="outline" className="text-[9px] gap-0.5 px-1 py-0 font-mono text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/20">
                <Lock className="h-2 w-2" />
                <span>SYSTEM</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] gap-0.5 px-1 py-0 font-mono text-purple-700 dark:text-purple-300 bg-purple-500/10 border-purple-500/20">
                <Sparkles className="h-2 w-2" />
                <span>CUSTOM</span>
              </Badge>
            )
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
          {workspaceMode === 'architect' && (
            <span className="text-muted-foreground/60">{attribute.dataType.toLowerCase()} •</span>
          )}
          <span>{systemName}</span>
        </div>
      </div>

      {renderControl()}

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
};
