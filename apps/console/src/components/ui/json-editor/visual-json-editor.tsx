import React, { useState, useEffect, useMemo } from 'react';
import {
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
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { JsonTreeNode, detectJsonType } from './json-tree-node';
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
  jsonSchema?: Record<string, unknown>;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
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

export function validateAgainstJsonSchema(
  data: unknown,
  schema: Record<string, unknown> | undefined,
  currentPath: (string | number)[] = [],
  errors: Record<string, string> = {}
): Record<string, string> {
  if (!schema || typeof schema !== 'object') return errors;
  const pathKey = currentPath.length === 0 ? 'root' : currentPath.join('.');
  const expectedType = schema.type as string | undefined;
  const actualType = detectJsonType(data);

  if (expectedType) {
    const typeMatches =
      expectedType === actualType ||
      (expectedType === 'integer' && typeof data === 'number' && Number.isInteger(data));
    if (!typeMatches) {
      errors[pathKey] = `Expected type "${expectedType}", got "${actualType}"`;
      return errors;
    }
  }

  if (typeof data === 'string') {
    if (typeof schema.minLength === 'number' && data.length < schema.minLength) {
      errors[pathKey] = `Minimum length is ${schema.minLength}`;
    }
    if (typeof schema.maxLength === 'number' && data.length > schema.maxLength) {
      errors[pathKey] = `Maximum length is ${schema.maxLength}`;
    }
    if (typeof schema.pattern === 'string') {
      try {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) {
          errors[pathKey] = `Does not match pattern ${schema.pattern}`;
        }
      } catch {
        // Ignore invalid regex in schema
      }
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(data)) {
      errors[pathKey] = `Must be one of: ${schema.enum.join(', ')}`;
    }
  }

  if (typeof data === 'number') {
    if (typeof schema.minimum === 'number' && data < schema.minimum) {
      errors[pathKey] = `Minimum value is ${schema.minimum}`;
    }
    if (typeof schema.maximum === 'number' && data > schema.maximum) {
      errors[pathKey] = `Maximum value is ${schema.maximum}`;
    }
  }

  if (actualType === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const requiredList = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    for (const reqKey of requiredList) {
      if (!(reqKey in obj) || obj[reqKey] === undefined || obj[reqKey] === '') {
        const reqPath = [...currentPath, reqKey].join('.');
        errors[reqPath] = `Required property "${reqKey}" is missing`;
        if (!errors[pathKey]) {
          errors[pathKey] = `Missing required property "${reqKey}"`;
        }
      }
    }

    const properties =
      schema.properties && typeof schema.properties === 'object'
        ? (schema.properties as Record<string, Record<string, unknown>>)
        : {};
    for (const [k, v] of Object.entries(obj)) {
      if (properties[k]) {
        validateAgainstJsonSchema(v, properties[k], [...currentPath, k], errors);
      } else if (schema.additionalProperties === false && Object.keys(properties).length > 0) {
        errors[[...currentPath, k].join('.')] = `Additional property "${k}" is not allowed`;
      }
    }
  }

  if (actualType === 'array' && Array.isArray(data)) {
    const itemSchema =
      schema.items && typeof schema.items === 'object'
        ? (schema.items as Record<string, unknown>)
        : undefined;
    if (itemSchema) {
      data.forEach((item, idx) => {
        validateAgainstJsonSchema(item, itemSchema, [...currentPath, idx], errors);
      });
    }
  }

  return errors;
}

export const VisualJsonEditor: React.FC<VisualJsonEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  defaultMode = 'tree',
  className,
  height = '320px',
  templates = DEFAULT_TEMPLATES,
  jsonSchema,
  onValidationChange,
}) => {
  const [mode, setMode] = useState<JsonEditorMode>(defaultMode);
  const [rawText, setRawText] = useState<string>('');
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  // Non-blocking inline JSON Schema validation
  const schemaErrors = useMemo(() => {
    if (!jsonSchema) return {};
    return validateAgainstJsonSchema(parsedValue, jsonSchema);
  }, [parsedValue, jsonSchema]);

  const schemaErrorCount = Object.keys(schemaErrors).length;

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(!syntaxError && schemaErrorCount === 0, schemaErrors);
    }
  }, [syntaxError, schemaErrorCount, schemaErrors, onValidationChange]);

  // Compute search matches and ancestor paths to auto-expand
  const { matchedPaths, expandedAncestorPaths } = useMemo(() => {
    const matched = new Set<string>();
    const ancestors = new Set<string>();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { matchedPaths: matched, expandedAncestorPaths: ancestors };

    const walk = (node: unknown, path: (string | number)[]) => {
      const pathKey = path.length === 0 ? 'root' : path.join('.');
      const lastKey = path.length > 0 ? String(path[path.length - 1]).toLowerCase() : '';
      let isMatch = lastKey.includes(q);

      if (node !== null && typeof node !== 'object') {
        if (String(node).toLowerCase().includes(q)) {
          isMatch = true;
        }
      }

      if (isMatch) {
        matched.add(pathKey);
        ancestors.add('root');
        for (let i = 1; i <= path.length; i++) {
          ancestors.add(path.slice(0, i).join('.'));
        }
      }

      if (Array.isArray(node)) {
        node.forEach((child, idx) => walk(child, [...path, idx]));
      } else if (node !== null && typeof node === 'object') {
        Object.entries(node as Record<string, unknown>).forEach(([k, v]) =>
          walk(v, [...path, k])
        );
      }
    };

    walk(parsedValue, []);
    return { matchedPaths: matched, expandedAncestorPaths: ancestors };
  }, [parsedValue, searchQuery]);

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

  // Deep update helper for Tree/Form Mode
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

  // Deep delete helper for Tree/Form Mode
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

  // Key rename helper for Tree/Form Mode
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

  // Array item Move Up / Move Down helper
  const handleMoveArrayItem = (path: (string | number)[], direction: 'up' | 'down') => {
    if (path.length === 0) return;
    const itemIndex = path[path.length - 1];
    if (typeof itemIndex !== 'number') return;

    const clone = JSON.parse(JSON.stringify(parsedValue));
    let parent: any = clone;
    for (let i = 0; i < path.length - 1; i++) {
      parent = parent[path[i]];
      if (!parent) return;
    }

    if (!Array.isArray(parent)) return;
    const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (targetIndex < 0 || targetIndex >= parent.length) return;

    const temp = parent[itemIndex];
    parent[itemIndex] = parent[targetIndex];
    parent[targetIndex] = temp;
    onChange(clone);
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
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-white/10 dark:border-white/5 bg-white/40 dark:bg-white/5 text-xs shrink-0">
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

        {/* Search & Filter Bar (Tree & Form Modes) */}
        {mode !== 'code' && (
          <div className="relative flex items-center flex-1 max-w-56 min-w-36">
            <Search className="size-3 text-muted-foreground absolute left-2 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter keys or values..."
              aria-label="Filter JSON keys or values"
              className="h-6 pl-6 pr-12 text-[11px] font-mono bg-background/60 border-border/50"
            />
            {searchQuery && (
              <div className="absolute right-1.5 flex items-center gap-1">
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                  {matchedPaths.size}
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear filter"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Toolbar Tools */}
        <div className="flex items-center gap-1.5">
          {/* Syntax & Schema Status */}
          {syntaxError ? (
            <Badge
              variant="destructive"
              className="gap-1 text-[10px] py-0 px-1.5 font-mono bg-destructive/15 text-destructive border-destructive/30"
            >
              <AlertCircle className="size-3" /> Syntax Error
            </Badge>
          ) : schemaErrorCount > 0 ? (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] py-0 px-1.5 font-mono text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10"
              title={Object.values(schemaErrors).join('; ')}
            >
              <AlertCircle className="size-3" /> {schemaErrorCount} Schema{' '}
              {schemaErrorCount === 1 ? 'Issue' : 'Issues'}
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
                searchQuery={searchQuery}
                matchedPaths={matchedPaths}
                expandedAncestorPaths={expandedAncestorPaths}
                schemaErrors={schemaErrors}
                onUpdate={handleTreeUpdate}
                onDelete={handleTreeDelete}
                onKeyRename={handleKeyRename}
                onMoveArrayItem={handleMoveArrayItem}
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
                        searchQuery={searchQuery}
                        matchedPaths={matchedPaths}
                        expandedAncestorPaths={expandedAncestorPaths}
                        schemaErrors={schemaErrors}
                        onUpdate={handleTreeUpdate}
                        onDelete={handleTreeDelete}
                        onKeyRename={handleKeyRename}
                        onMoveArrayItem={handleMoveArrayItem}
                      />
                    )
                  )
                ) : (
                  (parsedValue as unknown[]).map((v, idx, arr) => (
                    <JsonFormRow
                      key={idx}
                      fieldKey={idx}
                      value={v}
                      path={[idx]}
                      depth={0}
                      readOnly={readOnly}
                      parentArrayLength={arr.length}
                      searchQuery={searchQuery}
                      matchedPaths={matchedPaths}
                      expandedAncestorPaths={expandedAncestorPaths}
                      schemaErrors={schemaErrors}
                      onUpdate={handleTreeUpdate}
                      onDelete={handleTreeDelete}
                      onKeyRename={handleKeyRename}
                      onMoveArrayItem={handleMoveArrayItem}
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
