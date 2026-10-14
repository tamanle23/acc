import React, { useMemo, useState } from 'react';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import { useCompiledSchema } from '../../api/metadata-api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Code } from 'lucide-react';

interface Props {
  entityTypeId: string | number;
  entityTypeName?: string;
}

export const SchemaJsonPreview: React.FC<Props> = ({ entityTypeId, entityTypeName }) => {
  const { isJsonSchemaPreviewOpen, closeJsonSchemaPreview } = useMetadataUiStore();
  const [copied, setCopied] = useState(false);

  // Only fetch while the dialog is open; schema is compiled authoritatively by the backend.
  const { data, isLoading, isError, error } = useCompiledSchema(
    isJsonSchemaPreviewOpen ? entityTypeId : null
  );

  const jsonString = useMemo(() => {
    if (!data) return '';
    const schema =
      typeof data.jsonSchema === 'string'
        ? (() => {
            try {
              return JSON.parse(data.jsonSchema as string);
            } catch {
              return data.jsonSchema;
            }
          })()
        : data.jsonSchema;
    return typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);
  }, [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isJsonSchemaPreviewOpen} onOpenChange={(open) => !open && closeJsonSchemaPreview()}>
      <DialogContent className="max-w-5xl w-[92vw] max-h-[88vh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden p-6 rounded-3xl">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <DialogTitle className="text-xl font-bold">
                Compiled JSON Schema (Draft-07)
              </DialogTitle>
              {data?.schemaVersion !== undefined && (
                <Badge variant="secondary" className="font-mono text-xs">
                  v{data.schemaVersion}
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!jsonString}
              className="gap-1.5 text-xs bg-white/40 dark:bg-white/5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy Schema
                </>
              )}
            </Button>
          </div>
          <DialogDescription>
            Authoritative JSON Schema for {entityTypeName || 'this entity type'}, compiled by the
            backend validation engine.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2 flex-1 min-h-0 flex flex-col">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading compiled schema...</p>
          ) : isError ? (
            <p className="p-4 text-sm text-destructive">
              Failed to load compiled schema
              {error instanceof Error ? `: ${error.message}` : '.'}
            </p>
          ) : (
            <pre className="flex-1 h-full min-h-[300px] overflow-auto p-4 rounded-xl font-mono text-xs bg-slate-950 text-slate-100 border border-white/10 shadow-inner">
              <code>{jsonString}</code>
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
