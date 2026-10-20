import React, { useState, useEffect, useMemo } from 'react';
import {
  Braces,
  ListTree,
  Table as TableIcon,
  Code2,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  Minimize2,
  FileCode,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { JsonTreeNode } from './json-tree-node';
import { JsonFormRow } from './json-form-row';

export type JsonEditorMode = 'tree' | 'form' | 'code';

export interface VisualJsonEditorProps {
  value: unknown;
  onChange: (val: unknown) => void;
  readOnly?: boolean;
  defaultMode?: JsonEditorMode;
  className?: string;
  height?: string | number;
  templates?: Array<{ name: string; schema: Record<string, unknown> | unknown[] }>;
}

const DEFAULT_TEMPLATES = [
  {
    name: 'Empty Object',
    schema: {},
  },
  {
    name: 'Empty Array',
    schema: [],
  },
  {
    name: 'Key-Value Metadata',
    schema: { key: 'value', active: true, priority: 1 },
  },
  {
    name: 'Geo Location',
    schema: { latitude: 37.7749, longitude: -122.4194, altitude: 15 },
  },
  {
    name: 'Contact Profile',
    schema: { name: 'Acme Corp', email: 'contact@acme.com', verified: true },
  },
];

export const VisualJsonEditor: React.FC<VisualJsonEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  defaultMode = 'tree',
  className,
  height = '320px',
  templates = DEFAULT_TEMPLATES,
}) => {
  const [mode, setMode] = useState<JsonEditorMode>(defaultMode);
  const [rawText, setRawText] = useState<string>('');
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Parse safe object from value
  const parsedValue = useMemo(() => {
    if (value === null || value === undefined) return {};
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }, [value]);

  // Synchronize rawText when parsedValue changes externally
  useEffect(() => {
    try {
      const formatted = JSON.stringify(parsedValue, null, 2);
      setRawText(formatted ?? '{}');
      setSyntaxError(null);
    } catch (err: unknown) {
      setSyntaxError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [parsedValue]);

  const handleRawTextChange = (text: string) => {
    setRawText(text);
    try {
      const parsed = JSON.parse(text);
      setSyntaxError(null);
      onChange(parsed);
    } catch (err: unknown) {
      setSyntaxError(err instanceof Error ? err.message : 'Syntax error');
      // Do not corrupt parsed object until valid
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(rawText);
      const formatted = JSON.stringify(parsed, null, 2);
      setRawText(formatted);
      setSyntaxError(null);
      onChange(parsed);
      toast.success('JSON formatted');
    } catch {
      toast.error('Cannot format invalid JSON');
    }
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(rawText);
      const minified = JSON.stringify(parsed);
      setRawText(minified);
      setSyntaxError(null);
      onChange(parsed);
      toast.success('JSON minified');
    } catch {
      toast.error('Cannot minify invalid JSON');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('JSON copied to clipboard');
  };

  const handleApplyTemplate = (tpl: { name: string; schema: unknown }) => {
    onChange(tpl.schema);
    toast.success(`Applied template: ${tpl.name}`);
  };

  // Deep update helper for Tree Mode
  const handleTreeUpdate = (path: (string | number)[], newValue: unknown) => {
    if (path.length === 0) {
      onChange(newValue);
      return;
    }

    const clone = JSON.parse(JSON.stringify(parsedValue));
    let cursor: any = clone;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (cursor[key] === undefined || cursor[key] === null) {
        cursor[key] = typeof path[i + 1] === 'number' ? [] : {};
      }
      cursor = cursor[key];
    }
    cursor[path[path.length - 1]] = newValue;
    onChange(clone);
  };

  // Deep delete helper for Tree Mode
  const handleTreeDelete = (path: (string | number)[]) => {
    if (path.length === 0) {
      onChange({});
      return;
    }

    const clone = JSON.parse(JSON.stringify(parsedValue));
    let cursor: any = clone;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = cursor[path[i]];
      if (!cursor) return;
    }
    const lastKey = path[path.length - 1];
    if (Array.isArray(cursor) && typeof lastKey === 'number') {
      cursor.splice(lastKey, 1);
    } else if (typeof cursor === 'object' && cursor !== null) {
      delete cursor[lastKey];
    }
    onChange(clone);
  };

  // Key rename helper for Tree Mode
  const handleKeyRename = (
    path: (string | number)[],
    oldKey: string,
    newKey: string
  ) => {
    if (path.length === 0 || oldKey === newKey) return;

    const clone = JSON.parse(JSON.stringify(parsedValue));
    let cursor: any = clone;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = cursor[path[i]];
      if (!cursor) return;
    }

    if (typeof cursor === 'object' && cursor !== null && !Array.isArray(cursor)) {
      const valueAtKey = cursor[oldKey];
      delete cursor[oldKey];
      cursor[newKey] = valueAtKey;
      onChange(clone);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg overflow-hidden',
        className
      )}
      style={{ height }}
    >
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 dark:border-white/5 bg-white/40 dark:bg-white/5 text-xs shrink-0">
        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode('tree')}
            className={cn(
              'h-6 px-2 text-[11px] gap-1 rounded-md font-medium transition-all',
              mode === 'tree'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <ListTree className="size-3" />
            <span>Tree</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode('form')}
            className={cn(
              'h-6 px-2 text-[11px] gap-1 rounded-md font-medium transition-all',
              mode === 'form'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <TableIcon className="size-3" />
            <span>Form</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode('code')}
            className={cn(
              'h-6 px-2 text-[11px] gap-1 rounded-md font-medium transition-all',
              mode === 'code'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Code2 className="size-3" />
            <span>Code</span>
          </Button>
        </div>

        {/* Toolbar Tools */}
        <div className="flex items-center gap-1.5">
          {/* Syntax Status */}
          {syntaxError ? (
            <Badge
              variant="destructive"
              className="gap-1 text-[10px] py-0 px-1.5 font-mono bg-destructive/15 text-destructive border-destructive/30"
            >
              <AlertCircle className="size-3" /> Syntax Error
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] py-0 px-1.5 font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
            >
              <Check className="size-3" /> Valid
            </Badge>
          )}

          {/* Quick Format Tools */}
          {!readOnly && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleFormat}
                className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                title="Format / Prettify"
              >
                <FileCode className="size-3" /> Format
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMinify}
                className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                title="Minify"
              >
                <Minimize2 className="size-3" /> Minify
              </Button>
            </>
          )}

          {/* Template Selector */}
          {!readOnly && templates.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10"
                >
                  <Sparkles className="size-3 text-amber-500" /> Templates
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs">
                {templates.map((tpl) => (
                  <DropdownMenuItem
                    key={tpl.name}
                    onClick={() => handleApplyTemplate(tpl)}
                    className="text-xs"
                  >
                    {tpl.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Copy Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="size-6 text-muted-foreground hover:text-foreground"
            title="Copy JSON to clipboard"
          >
            {copied ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor Main Canvas Body */}
      <div className="flex-1 overflow-auto p-3">
        {mode === 'tree' && (
          <div className="space-y-1">
            {typeof parsedValue === 'object' && parsedValue !== null ? (
              <JsonTreeNode
                nodeKey="root"
                value={parsedValue}
                path={[]}
                depth={0}
                readOnly={readOnly}
                onUpdate={handleTreeUpdate}
                onDelete={handleTreeDelete}
                onKeyRename={handleKeyRename}
              />
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground font-mono">
                Value is primitive: {String(parsedValue)}
              </div>
            )}
          </div>
        )}

        {mode === 'form' && (
          <div className="space-y-2">
            {typeof parsedValue === 'object' && parsedValue !== null ? (
              <div className="space-y-1">
                {/* Top Add Property Bar for Root */}
                {!readOnly && (
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {Array.isArray(parsedValue) ? 'Array Elements' : 'Properties'}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (Array.isArray(parsedValue)) {
                          handleTreeUpdate([parsedValue.length], '');
                        } else {
                          let baseKey = 'property';
                          let count = 1;
                          const current = (parsedValue as Record<string, unknown>) || {};
                          while (baseKey in current) {
                            baseKey = `property_${count++}`;
                          }
                          handleTreeUpdate([baseKey], '');
                        }
                      }}
                      className="h-6 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10 border-primary/20"
                    >
                      <Plus className="size-3" />
                      <span>{Array.isArray(parsedValue) ? 'Add Item' : 'Add Property'}</span>
                    </Button>
                  </div>
                )}

                {/* Object Properties / Array Items */}
                {!Array.isArray(parsedValue) ? (
                  Object.entries(parsedValue as Record<string, unknown>).map(
                    ([k, v]) => (
                      <JsonFormRow
                        key={k}
                        fieldKey={k}
                        value={v}
                        path={[k]}
                        depth={0}
                        readOnly={readOnly}
                        onUpdate={handleTreeUpdate}
                        onDelete={handleTreeDelete}
                        onKeyRename={handleKeyRename}
                      />
                    )
                  )
                ) : (
                  (parsedValue as unknown[]).map((v, idx) => (
                    <JsonFormRow
                      key={idx}
                      fieldKey={idx}
                      value={v}
                      path={[idx]}
                      depth={0}
                      readOnly={readOnly}
                      onUpdate={handleTreeUpdate}
                      onDelete={handleTreeDelete}
                      onKeyRename={handleKeyRename}
                    />
                  ))
                )}

                {Object.keys(parsedValue as Record<string, unknown>).length === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    Empty document. Click &quot;Add Property&quot; or switch to Tree/Code mode.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground font-mono">
                Form mode is supported for objects and arrays. Primitive value: {String(parsedValue)}
              </div>
            )}
          </div>
        )}

        {mode === 'code' && (
          <div className="h-full flex flex-col space-y-2">
            <Textarea
              value={rawText}
              disabled={readOnly}
              onChange={(e) => handleRawTextChange(e.target.value)}
              className="flex-1 font-mono text-xs p-3 leading-relaxed rounded-lg bg-slate-950/80 text-emerald-400 border-white/10 focus-visible:ring-primary/40 resize-none h-full"
              placeholder="{}"
              spellCheck={false}
            />
            {syntaxError && (
              <div className="text-[11px] font-mono text-destructive flex items-center gap-1.5 px-1">
                <AlertCircle className="size-3 shrink-0" />
                <span>{syntaxError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
