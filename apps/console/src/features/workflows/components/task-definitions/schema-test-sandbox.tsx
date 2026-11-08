import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Play,
  Sparkles,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ValidationError {
  path: string;
  message: string;
}

export interface SchemaTestSandboxProps {
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  className?: string;
}

/**
 * Validates a payload against basic JSON Schema rules (zero external dependencies).
 */
export function validatePayloadAgainstSchema(
  payload: unknown,
  schema: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!schema || typeof schema !== 'object') {
    return errors;
  }

  // Type check for root object
  if (schema.type === 'object') {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      errors.push({
        path: '$',
        message: `Expected root payload to be an object, received ${Array.isArray(payload) ? 'array' : typeof payload}`,
      });
      return errors;
    }

    const payloadObj = payload as Record<string, unknown>;
    const properties = (schema.properties as Record<string, Record<string, unknown>>) || {};
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];

    // Check required fields
    for (const reqKey of required) {
      if (payloadObj[reqKey] === undefined || payloadObj[reqKey] === null) {
        errors.push({
          path: `$.${reqKey}`,
          message: `Required property '${reqKey}' is missing or null`,
        });
      }
    }

    // Check properties types
    for (const [key, value] of Object.entries(payloadObj)) {
      const propDef = properties[key];
      if (!propDef) {
        if (schema.additionalProperties === false) {
          errors.push({
            path: `$.${key}`,
            message: `Property '${key}' is not allowed by schema (additionalProperties: false)`,
          });
        }
        continue;
      }

      const expectedType = propDef.type;
      if (!expectedType) continue;

      if (value === undefined || value === null) {
        // Handled by required check if applicable
        continue;
      }

      if (expectedType === 'string' && typeof value !== 'string') {
        errors.push({
          path: `$.${key}`,
          message: `Expected type string, received ${typeof value}`,
        });
      } else if ((expectedType === 'number' || expectedType === 'integer') && typeof value !== 'number') {
        errors.push({
          path: `$.${key}`,
          message: `Expected type ${expectedType}, received ${typeof value}`,
        });
      } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
        errors.push({
          path: `$.${key}`,
          message: `Expected type boolean, received ${typeof value}`,
        });
      } else if (expectedType === 'array' && !Array.isArray(value)) {
        errors.push({
          path: `$.${key}`,
          message: `Expected type array, received ${typeof value}`,
        });
      } else if (expectedType === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        errors.push({
          path: `$.${key}`,
          message: `Expected type object, received ${Array.isArray(value) ? 'array' : typeof value}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Generates an initial mock sample payload based on properties in the schema.
 */
export function generateSampleFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!schema || typeof schema !== 'object' || !schema.properties) {
    return result;
  }

  const properties = schema.properties as Record<string, Record<string, unknown>>;
  for (const [key, def] of Object.entries(properties)) {
    if (def.default !== undefined) {
      result[key] = def.default;
      continue;
    }

    const type = def.type;
    switch (type) {
      case 'string':
        result[key] = `sample_${key}`;
        break;
      case 'number':
      case 'integer':
        result[key] = 100;
        break;
      case 'boolean':
        result[key] = true;
        break;
      case 'array':
        result[key] = ['item_1', 'item_2'];
        break;
      case 'object':
        result[key] = { key: 'value' };
        break;
      default:
        result[key] = 'value';
    }
  }

  return result;
}

export const SchemaTestSandbox: React.FC<SchemaTestSandboxProps> = ({
  inputSchema,
  outputSchema,
  className,
}) => {
  const [activeSchemaTab, setActiveSchemaTab] = useState<'input' | 'output'>('input');
  const targetSchema = activeSchemaTab === 'input' ? inputSchema : outputSchema;

  const [payloadText, setPayloadText] = useState<string>(() =>
    JSON.stringify(generateSampleFromSchema(inputSchema), null, 2)
  );
  const [hasRun, setHasRun] = useState(false);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const handleSwitchTab = (tab: 'input' | 'output') => {
    setActiveSchemaTab(tab);
    const schema = tab === 'input' ? inputSchema : outputSchema;
    setPayloadText(JSON.stringify(generateSampleFromSchema(schema), null, 2));
    setHasRun(false);
    setSyntaxError(null);
    setValidationErrors([]);
  };

  const handleGenerateSample = () => {
    const sample = generateSampleFromSchema(targetSchema);
    setPayloadText(JSON.stringify(sample, null, 2));
    setSyntaxError(null);
    setHasRun(false);
  };

  const handleRunValidation = () => {
    setHasRun(true);
    setSyntaxError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadText);
    } catch (e: unknown) {
      setSyntaxError((e as Error).message || 'Invalid JSON syntax');
      setValidationErrors([]);
      return;
    }

    const errors = validatePayloadAgainstSchema(parsed, targetSchema);
    setValidationErrors(errors);
  };

  const isValid = hasRun && !syntaxError && validationErrors.length === 0;

  return (
    <div className={cn('flex flex-col gap-4 rounded-lg border border-border/50 bg-card/40 p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border border-border/40">
            <Button
              type="button"
              size="sm"
              variant={activeSchemaTab === 'input' ? 'secondary' : 'ghost'}
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => handleSwitchTab('input')}
            >
              Input Contract Test
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeSchemaTab === 'output' ? 'secondary' : 'ghost'}
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => handleSwitchTab('output')}
            >
              Output Contract Test
            </Button>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Verify sample payloads against the schema in memory
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateSample}
            className="h-7 text-xs gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Generate Sample
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleRunValidation}
            className="h-7 text-xs gap-1.5 font-medium shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Validate Payload
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor Column */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Mock JSON Payload
            </label>
            <span className="text-[11px] text-muted-foreground font-mono">
              Target: {activeSchemaTab === 'input' ? 'inputSchema' : 'outputSchema'}
            </span>
          </div>
          <textarea
            value={payloadText}
            onChange={(e) => {
              setPayloadText(e.target.value);
              if (hasRun) setHasRun(false);
            }}
            rows={12}
            className="w-full rounded-md border border-input bg-background/80 p-2.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Paste or type test JSON payload here..."
            spellCheck={false}
          />
        </div>

        {/* Validation Results Column */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Contract Validation Result
            </span>
            {hasRun && (
              <Badge
                variant="outline"
                className={
                  isValid
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                }
              >
                {isValid ? 'VALID' : 'FAILED'}
              </Badge>
            )}
          </div>

          <div className="flex-1 min-h-[200px] rounded-md border border-border/40 bg-muted/20 p-3 flex flex-col justify-start">
            {!hasRun ? (
              <div className="m-auto flex flex-col items-center justify-center text-center text-muted-foreground py-6">
                <Play className="w-6 h-6 mb-2 text-muted-foreground/40" />
                <p className="text-xs font-medium">No test executed yet</p>
                <p className="text-[11px]">Click &quot;Validate Payload&quot; above to run contract checks.</p>
              </div>
            ) : syntaxError ? (
              <div className="flex flex-col gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <div className="flex items-center gap-1.5 font-semibold">
                  <XCircle className="w-4 h-4 shrink-0" />
                  JSON Syntax Error
                </div>
                <div className="font-mono text-[11px] break-all">{syntaxError}</div>
              </div>
            ) : validationErrors.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-6 m-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <span className="text-sm font-semibold text-foreground">Payload Conforms to Schema!</span>
                <span className="text-xs text-muted-foreground mt-1 max-w-xs">
                  All required properties are present and field data types match contract specification.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Found {validationErrors.length} Schema Violation{validationErrors.length > 1 ? 's' : ''}:
                </div>
                <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {validationErrors.map((err, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-destructive/10 border border-destructive/20 text-[11px] font-mono flex flex-col gap-0.5"
                    >
                      <span className="font-semibold text-destructive">{err.path}</span>
                      <span className="text-muted-foreground">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
