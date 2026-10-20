import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Type,
  Hash,
  ToggleLeft,
  Braces,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { detectJsonType, type JsonValueType } from './json-tree-node';

export interface JsonFormRowProps {
  fieldKey: string | number;
  value: unknown;
  path: (string | number)[];
  depth?: number;
  readOnly?: boolean;
  onUpdate: (path: (string | number)[], newValue: unknown) => void;
  onDelete: (path: (string | number)[]) => void;
  onKeyRename?: (path: (string | number)[], oldKey: string, newKey: string) => void;
}

export const JsonFormRow: React.FC<JsonFormRowProps> = ({
  fieldKey,
  value,
  path,
  depth = 0,
  readOnly = false,
  onUpdate,
  onDelete,
  onKeyRename,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState(String(fieldKey));

  const valType = detectJsonType(value);
  const isContainer = valType === 'object' || valType === 'array';
  const isArrayItem = typeof fieldKey === 'number';

  const handleKeyBlur = () => {
    setIsEditingKey(false);
    const trimmed = keyInput.trim();
    if (trimmed && trimmed !== String(fieldKey) && onKeyRename) {
      onKeyRename(path, String(fieldKey), trimmed);
    } else {
      setKeyInput(String(fieldKey));
    }
  };

  const handleTypeChange = (newType: JsonValueType) => {
    let newVal: unknown = '';
    if (newType === 'number') newVal = 0;
    else if (newType === 'boolean') newVal = false;
    else if (newType === 'null') newVal = null;
    else if (newType === 'object') newVal = {};
    else if (newType === 'array') newVal = [];
    onUpdate(path, newVal);
  };

  const handleAddChild = (childType: JsonValueType = 'string') => {
    if (valType === 'object') {
      const current = (value as Record<string, unknown>) || {};
      let baseKey = 'property';
      let count = 1;
      while (baseKey in current) {
        baseKey = `property_${count++}`;
      }
      let initialVal: unknown = '';
      if (childType === 'number') initialVal = 0;
      else if (childType === 'boolean') initialVal = false;
      else if (childType === 'object') initialVal = {};
      else if (childType === 'array') initialVal = [];

      onUpdate([...path, baseKey], initialVal);
      setIsExpanded(true);
    } else if (valType === 'array') {
      const current = (value as unknown[]) || [];
      let initialVal: unknown = '';
      if (childType === 'number') initialVal = 0;
      else if (childType === 'boolean') initialVal = false;
      else if (childType === 'object') initialVal = {};
      else if (childType === 'array') initialVal = [];

      onUpdate([...path, current.length], initialVal);
      setIsExpanded(true);
    }
  };

  const renderTypeIcon = (t: JsonValueType) => {
    switch (t) {
      case 'string':
        return <Type className="size-3 text-emerald-500" />;
      case 'number':
        return <Hash className="size-3 text-blue-500" />;
      case 'boolean':
        return <ToggleLeft className="size-3 text-purple-500" />;
      case 'object':
        return <Braces className="size-3 text-amber-500" />;
      case 'array':
        return <List className="size-3 text-teal-500" />;
      default:
        return <span className="text-[10px] text-muted-foreground font-mono">null</span>;
    }
  };

  return (
    <div className="flex flex-col space-y-1">
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg bg-white/40 dark:bg-slate-800/40 border border-white/10 text-xs transition-colors group',
          depth > 0 && 'ml-4 border-l-2 border-l-primary/40 pl-3 bg-muted/20'
        )}
      >
        {/* Container collapse toggle */}
        {isContainer ? (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted/60 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5 text-primary" />
            ) : (
              <ChevronRight className="size-3.5 text-primary" />
            )}
          </button>
        ) : (
          <div className="size-3.5 shrink-0" />
        )}

        {/* Key Label or Key Input */}
        <div className="w-36 shrink-0 flex items-center gap-1 min-w-0">
          {!isArrayItem ? (
            isEditingKey && !readOnly ? (
              <Input
                value={keyInput}
                autoFocus
                onChange={(e) => setKeyInput(e.target.value)}
                onBlur={handleKeyBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleKeyBlur();
                  if (e.key === 'Escape') {
                    setKeyInput(String(fieldKey));
                    setIsEditingKey(false);
                  }
                }}
                className="h-6 text-xs font-mono py-0 px-1.5 bg-background border-primary w-full"
              />
            ) : (
              <button
                type="button"
                onDoubleClick={() => !readOnly && setIsEditingKey(true)}
                className="font-mono text-xs font-semibold text-foreground/90 hover:text-primary transition-colors truncate text-left w-full cursor-pointer"
                title={!readOnly ? 'Double-click to rename' : undefined}
              >
                {String(fieldKey)}
              </button>
            )
          ) : (
            <Badge variant="outline" className="font-mono text-[10px] py-0 px-1 text-muted-foreground">
              Index [{fieldKey}]
            </Badge>
          )}
        </div>

        {/* Type Badge & Quick Converter */}
        <div className="shrink-0">
          {!readOnly ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] font-mono px-1.5 py-0 cursor-pointer hover:bg-muted/50 border-white/20"
                >
                  {renderTypeIcon(valType)}
                  <span>{valType}</span>
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-28 text-xs">
                {(['string', 'number', 'boolean', 'object', 'array', 'null'] as JsonValueType[]).map(
                  (t) => (
                    <DropdownMenuItem
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className="flex items-center gap-1.5 capitalize text-xs"
                    >
                      {renderTypeIcon(t)}
                      <span>{t}</span>
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] font-mono px-1.5 py-0 border-white/20">
              {renderTypeIcon(valType)}
              <span>{valType}</span>
            </Badge>
          )}
        </div>

        {/* Value Inputs for Primitives */}
        {!isContainer && (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {valType === 'string' && (
              <Input
                value={String(value ?? '')}
                disabled={readOnly}
                onChange={(e) => onUpdate(path, e.target.value)}
                className="h-7 text-xs font-mono py-0 px-2 bg-white/50 dark:bg-slate-900/50 border-white/20 w-full"
                placeholder="text value..."
              />
            )}

            {valType === 'number' && (
              <Input
                type="number"
                value={value as number}
                disabled={readOnly}
                onChange={(e) => onUpdate(path, Number(e.target.value))}
                className="h-7 w-36 text-xs font-mono py-0 px-2 bg-white/50 dark:bg-slate-900/50 border-white/20"
              />
            )}

            {valType === 'boolean' && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(value)}
                  disabled={readOnly}
                  onCheckedChange={(checked) => onUpdate(path, checked)}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {String(value)}
                </span>
              </div>
            )}

            {valType === 'null' && (
              <span className="font-mono text-muted-foreground/60 italic text-xs">
                null
              </span>
            )}
          </div>
        )}

        {/* Container count summary */}
        {isContainer && (
          <div className="flex-1 text-[11px] font-mono text-muted-foreground">
            {valType === 'array'
              ? `[ ${(value as unknown[]).length} items ]`
              : `{ ${Object.keys((value as Record<string, unknown>) || {}).length} properties }`}
          </div>
        )}

        {/* Actions for this row */}
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {isContainer && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-primary hover:bg-primary/10 gap-1"
                  >
                    <Plus className="size-3" />
                    <span className="text-[10px]">Add</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32 text-xs">
                  <DropdownMenuItem onClick={() => handleAddChild('string')}>
                    <Type className="size-3 mr-1.5 text-emerald-500" /> String
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddChild('number')}>
                    <Hash className="size-3 mr-1.5 text-blue-500" /> Number
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddChild('boolean')}>
                    <ToggleLeft className="size-3 mr-1.5 text-purple-500" /> Boolean
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddChild('object')}>
                    <Braces className="size-3 mr-1.5 text-amber-500" /> Object
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddChild('array')}>
                    <List className="size-3 mr-1.5 text-teal-500" /> Array
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(path)}
              className="size-6 text-muted-foreground hover:text-destructive"
              title="Delete property"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Recursive rendering for nested objects and arrays */}
      {isContainer && isExpanded && (
        <div className="space-y-1">
          {valType === 'object' &&
            Object.entries((value as Record<string, unknown>) || {}).map(([k, v]) => (
              <JsonFormRow
                key={k}
                fieldKey={k}
                value={v}
                path={[...path, k]}
                depth={depth + 1}
                readOnly={readOnly}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onKeyRename={onKeyRename}
              />
            ))}

          {valType === 'array' &&
            ((value as unknown[]) || []).map((v, idx) => (
              <JsonFormRow
                key={idx}
                fieldKey={idx}
                value={v}
                path={[...path, idx]}
                depth={depth + 1}
                readOnly={readOnly}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onKeyRename={onKeyRename}
              />
            ))}

          {((valType === 'object' && Object.keys((value as Record<string, unknown>) || {}).length === 0) ||
            (valType === 'array' && ((value as unknown[]) || []).length === 0)) && (
            <div className="ml-8 py-2 text-muted-foreground/60 italic text-xs font-mono">
              (empty container)
            </div>
          )}
        </div>
      )}
    </div>
  );
};
