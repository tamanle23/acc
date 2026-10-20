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

export type JsonValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export interface JsonTreeNodeProps {
  nodeKey: string | number;
  value: unknown;
  path: (string | number)[];
  depth?: number;
  readOnly?: boolean;
  onUpdate: (path: (string | number)[], newValue: unknown) => void;
  onDelete: (path: (string | number)[]) => void;
  onKeyRename?: (path: (string | number)[], oldKey: string, newKey: string) => void;
}

export function detectJsonType(val: unknown): JsonValueType {
  if (val === null || val === undefined) return 'null';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'object') return 'object';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean') return 'boolean';
  return 'string';
}

export const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({
  nodeKey,
  value,
  path,
  depth = 0,
  readOnly = false,
  onUpdate,
  onDelete,
  onKeyRename,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 2);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState(String(nodeKey));

  const valType = detectJsonType(value);
  const isContainer = valType === 'object' || valType === 'array';
  const isArrayItem = typeof nodeKey === 'number';

  const handleKeyBlur = () => {
    setIsEditingKey(false);
    const trimmed = keyInput.trim();
    if (trimmed && trimmed !== String(nodeKey) && onKeyRename) {
      onKeyRename(path, String(nodeKey), trimmed);
    } else {
      setKeyInput(String(nodeKey));
    }
  };

  const handleTypeChange = (newType: JsonValueType) => {
    let newVal: unknown = '';
    if (newType === 'number') newVal = 0;
    else if (newType === 'boolean') newVal = false;
    else if (newType === 'null') newVal = null;
    else if (newType === 'object') newVal = {};
    else if (newType === 'array') newVal = [];
    else newVal = '';
    onUpdate(path, newVal);
  };

  const handleAddChild = (childType: JsonValueType = 'string') => {
    if (valType === 'object') {
      const current = (value as Record<string, unknown>) || {};
      let baseKey = 'newKey';
      let count = 1;
      while (baseKey in current) {
        baseKey = `newKey_${count++}`;
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
    <div className="flex flex-col select-none text-xs">
      <div
        className={cn(
          'group flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-muted/40 transition-colors',
          depth > 0 && 'ml-4 border-l border-white/10 dark:border-white/5 pl-2'
        )}
      >
        {/* Expand / Collapse toggle */}
        {isContainer ? (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted/60 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : (
          <div className="size-3.5" />
        )}

        {/* Key Display / Inline Editor */}
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
                  setKeyInput(String(nodeKey));
                  setIsEditingKey(false);
                }
              }}
              className="h-6 w-28 text-xs font-mono py-0 px-1.5 bg-background border-primary"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => !readOnly && setIsEditingKey(true)}
              className="font-mono font-medium text-foreground/90 hover:text-primary transition-colors cursor-pointer"
              title={!readOnly ? 'Double-click to rename' : undefined}
            >
              {String(nodeKey)}:
            </button>
          )
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1 py-0.2 rounded">
            [{nodeKey}]
          </span>
        )}

        {/* Type Badge & Quick Converter */}
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

        {/* Value Inputs for Leaf Types */}
        {!isContainer && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0 max-w-sm">
            {valType === 'string' && (
              <Input
                value={String(value ?? '')}
                disabled={readOnly}
                onChange={(e) => onUpdate(path, e.target.value)}
                className="h-6 text-xs font-mono py-0 px-1.5 bg-white/40 dark:bg-slate-900/40 border-white/20"
                placeholder="text value..."
              />
            )}

            {valType === 'number' && (
              <Input
                type="number"
                value={value as number}
                disabled={readOnly}
                onChange={(e) => onUpdate(path, Number(e.target.value))}
                className="h-6 w-32 text-xs font-mono py-0 px-1.5 bg-white/40 dark:bg-slate-900/40 border-white/20"
              />
            )}

            {valType === 'boolean' && (
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={Boolean(value)}
                  disabled={readOnly}
                  onCheckedChange={(checked) => onUpdate(path, checked)}
                  className="scale-75"
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {String(value)}
                </span>
              </div>
            )}

            {valType === 'null' && (
              <span className="font-mono text-muted-foreground/60 italic text-[11px]">
                null
              </span>
            )}
          </div>
        )}

        {/* Container Size Badge */}
        {isContainer && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {valType === 'array'
              ? `[ ${(value as unknown[]).length} items ]`
              : `{ ${Object.keys((value as Record<string, unknown>) || {}).length} keys }`}
          </span>
        )}

        {/* Row Contextual Actions (Add child / Delete) */}
        {!readOnly && (
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isContainer && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 text-muted-foreground hover:text-foreground"
                    title={valType === 'array' ? 'Add Item' : 'Add Property'}
                  >
                    <Plus className="size-3" />
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
              className="size-5 text-muted-foreground hover:text-destructive"
              title="Delete element"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Children elements if container and expanded */}
      {isContainer && isExpanded && (
        <div className="flex flex-col">
          {valType === 'object' &&
            Object.entries((value as Record<string, unknown>) || {}).map(([k, v]) => (
              <JsonTreeNode
                key={k}
                nodeKey={k}
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
              <JsonTreeNode
                key={idx}
                nodeKey={idx}
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
            <div className="ml-8 py-1 text-muted-foreground/50 italic text-[11px] font-mono">
              (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
};
