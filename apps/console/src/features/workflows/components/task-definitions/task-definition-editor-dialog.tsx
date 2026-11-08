import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SlidersHorizontal,
  FileCode2,
  FileCheck2,
  Sparkles,
  Save,
  UploadCloud,
  Layers,
  Clock,
  RotateCw,
  Lock,
  Copy,
} from 'lucide-react';
import {
  type TaskDefinitionRecord,
  useSaveTaskDefinitionDraft,
  usePublishTaskDefinition,
} from '@/features/workflows/api/task-definition-api';
import { SCHEMA_TEMPLATES, type SchemaPresetTemplate } from './schema-templates';
import { SchemaPropertyGrid } from './schema-property-grid';
import { SchemaTestSandbox } from './schema-test-sandbox';

export interface TaskDefinitionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: TaskDefinitionRecord | null;
  mode?: 'create' | 'edit' | 'fork' | 'inspect';
  onSaved?: (taskDef: TaskDefinitionRecord) => void;
}

export const TaskDefinitionEditorDialog: React.FC<TaskDefinitionEditorDialogProps> = ({
  open,
  onOpenChange,
  initialData,
  mode = 'create',
  onSaved,
}) => {
  const saveDraftMutation = useSaveTaskDefinitionDraft();
  const publishMutation = usePublishTaskDefinition();

  const isBuiltIn = Boolean(
    initialData && (initialData.isBuiltIn || initialData.tenantId === 'SYSTEM' || initialData.tenantId === 'system')
  );
  const [internalMode, setInternalMode] = useState<'create' | 'edit' | 'fork' | 'inspect'>(mode);

  useEffect(() => {
    if (mode === 'fork') {
      setInternalMode('fork');
    } else if (isBuiltIn) {
      setInternalMode('inspect');
    } else {
      setInternalMode(mode);
    }
  }, [mode, isBuiltIn, open]);

  const isInspect = internalMode === 'inspect';

  const [activeTab, setActiveTab] = useState<'general' | 'input' | 'output' | 'test'>('general');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [retryCount, setRetryCount] = useState(3);
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(5);
  const [backoffRate, setBackoffRate] = useState(2);
  const [changelogNote, setChangelogNote] = useState('');

  const [inputSchema, setInputSchema] = useState<Record<string, unknown>>({
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  });

  const [outputSchema, setOutputSchema] = useState<Record<string, unknown>>({
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  });

  // Populate state when dialog opens or initialData changes
  useEffect(() => {
    if (!open) return;

    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || '');
      setTimeoutSeconds(initialData.timeoutSeconds ?? 30);
      setRetryCount(initialData.retryCount ?? 3);
      setRetryDelaySeconds(initialData.retryDelaySeconds ?? 5);
      setBackoffRate(initialData.backoffRate ?? 2);
      setChangelogNote(mode === 'fork' ? `Forked from v${initialData.version}` : initialData.changelogNote || '');
      setInputSchema(
        initialData.inputSchema && typeof initialData.inputSchema === 'object'
          ? initialData.inputSchema
          : {
              $schema: 'http://json-schema.org/draft-07/schema#',
              type: 'object',
              properties: {},
              required: [],
              additionalProperties: false,
            }
      );
      setOutputSchema(
        initialData.outputSchema && typeof initialData.outputSchema === 'object'
          ? initialData.outputSchema
          : {
              $schema: 'http://json-schema.org/draft-07/schema#',
              type: 'object',
              properties: {},
              required: [],
              additionalProperties: false,
            }
      );
    } else {
      // Default blank
      setName('');
      setDescription('');
      setTimeoutSeconds(30);
      setRetryCount(3);
      setRetryDelaySeconds(5);
      setBackoffRate(2);
      setChangelogNote('Initial task definition draft');
      setInputSchema({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          payload: { type: 'string', description: 'General payload' },
        },
        required: ['payload'],
        additionalProperties: false,
      });
      setOutputSchema({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          success: { type: 'boolean', description: 'Execution result status' },
        },
        required: ['success'],
        additionalProperties: false,
      });
    }
    setActiveTab('general');
  }, [open, initialData, mode]);

  const handleApplyTemplate = (templateId: string) => {
    const template = SCHEMA_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    if (!name || name.trim() === '') {
      setName(template.id);
    }
    if (!description || description.trim() === '') {
      setDescription(template.description);
    }
    setTimeoutSeconds(template.defaultTimeoutSeconds);
    setRetryCount(template.defaultRetryCount);
    setInputSchema(template.inputSchema);
    setOutputSchema(template.outputSchema);
  };

  const handleSaveDraft = async () => {
    if (!name.trim()) return;

    try {
      const saved = await saveDraftMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        timeoutSeconds: Number(timeoutSeconds) || 30,
        retryCount: Number(retryCount) || 3,
        retryDelaySeconds: Number(retryDelaySeconds) || 5,
        backoffRate: Number(backoffRate) || 2,
        inputSchema,
        outputSchema,
        changelogNote: changelogNote.trim(),
      });

      onSaved?.(saved);
      onOpenChange(false);
    } catch {
      // Handled in mutation onError
    }
  };

  const handlePublish = async () => {
    if (!name.trim()) return;

    try {
      // Save draft first to ensure the latest changes are committed
      const saved = await saveDraftMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        timeoutSeconds: Number(timeoutSeconds) || 30,
        retryCount: Number(retryCount) || 3,
        retryDelaySeconds: Number(retryDelaySeconds) || 5,
        backoffRate: Number(backoffRate) || 2,
        inputSchema,
        outputSchema,
        changelogNote: changelogNote.trim(),
      });

      // Now publish this version
      const published = await publishMutation.mutateAsync({
        name: saved.name,
        version: saved.version,
      });

      onSaved?.(published);
      onOpenChange(false);
    } catch {
      // Handled in mutation onError
    }
  };

  const handleForkFromInspect = () => {
    setInternalMode('fork');
    setName(`${initialData?.name || 'task'}Custom`);
    setChangelogNote(`Forked from built-in ${initialData?.name} v1`);
  };

  const isSaving = saveDraftMutation.isPending || publishMutation.isPending;
  const isEditingExisting = Boolean(initialData && mode !== 'create');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl"
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  {isInspect ? (
                    <>
                      <span>Inspect Task Definition: {initialData?.name}</span>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                        BUILT-IN (READ-ONLY)
                      </Badge>
                    </>
                  ) : internalMode === 'fork' ? (
                    `Fork Task Definition (${initialData?.name})`
                  ) : isEditingExisting ? (
                    `Edit Task Definition: ${initialData?.name} (v${initialData?.version})`
                  ) : (
                    'Create New Task Definition'
                  )}
                  {initialData && !isInspect && (
                    <Badge variant="outline" className="font-mono text-xs">
                      v{initialData.version}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {isInspect
                    ? 'View canonical parameter schemas and contract specifications for this built-in node.'
                    : 'Define typed contract schemas, validation bounds, and worker execution retry policies.'}
                </DialogDescription>
              </div>
            </div>

            {/* Template Selector for quick creation */}
            {mode === 'create' && !isInspect && (
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <Select onValueChange={handleApplyTemplate}>
                  <SelectTrigger className="h-7 text-xs w-[180px]">
                    <SelectValue placeholder="Quick Template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEMA_TEMPLATES.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'general' | 'input' | 'output' | 'test')}
            className="w-full mt-4"
          >
            <TabsList className="grid grid-cols-4 w-full h-9">
              <TabsTrigger value="general" className="text-xs gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                General & Policy
              </TabsTrigger>
              <TabsTrigger value="input" className="text-xs gap-1.5">
                <FileCode2 className="w-3.5 h-3.5" />
                Input Schema
              </TabsTrigger>
              <TabsTrigger value="output" className="text-xs gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5" />
                Output Schema
              </TabsTrigger>
              <TabsTrigger value="test" className="text-xs gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Test Sandbox
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'general' && (
            <div className="flex flex-col gap-4 max-w-2xl mx-auto">
              {isInspect && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>
                    This is a canonical built-in system task definition. Its parameters and contracts are maintained by the platform engine. You can inspect its schemas, test them in the sandbox, or fork it to customize.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-name" className="text-xs font-semibold">
                    Task Identifier Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="task-name"
                    placeholder="e.g. validateCustomerOrder"
                    value={name}
                    disabled={isInspect || (isEditingExisting && internalMode !== 'fork')}
                    onChange={(e) => setName(e.target.value.replace(/\s+/g, ''))}
                    className="font-mono text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Canonical task key referenced by workflow task nodes.
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-changelog" className="text-xs font-semibold">
                    Changelog Note
                  </Label>
                  <Input
                    id="task-changelog"
                    placeholder="e.g. Add payment token validation"
                    value={changelogNote}
                    disabled={isInspect}
                    onChange={(e) => setChangelogNote(e.target.value)}
                    className="text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Summary of updates in this revision.
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-desc" className="text-xs font-semibold">
                  Description
                </Label>
                <textarea
                  id="task-desc"
                  rows={2}
                  placeholder="Describes what this task executes, business rules, and external systems contacted."
                  value={description}
                  disabled={isInspect}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-background/80 p-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>

              {/* Policy Settings Section */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-border/30 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Worker Execution & Retry Policy
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Timeout (sec)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      value={timeoutSeconds}
                      disabled={isInspect}
                      onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Retry Count</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={retryCount}
                      disabled={isInspect}
                      onChange={(e) => setRetryCount(Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Retry Delay (sec)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={300}
                      value={retryDelaySeconds}
                      disabled={isInspect}
                      onChange={(e) => setRetryDelaySeconds(Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Backoff Rate (x)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min={1}
                      max={10}
                      value={backoffRate}
                      disabled={isInspect}
                      onChange={(e) => setBackoffRate(Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'input' && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">
                Define the JSON Schema structure that workflow orchestrator will validate before dispatching to worker.
              </span>
              <SchemaPropertyGrid value={inputSchema} onChange={setInputSchema} disabled={isInspect} />
            </div>
          )}

          {activeTab === 'output' && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">
                Define the JSON Schema structure that task workers must return upon successful task execution.
              </span>
              <SchemaPropertyGrid value={outputSchema} onChange={setOutputSchema} disabled={isInspect} />
            </div>
          )}

          {activeTab === 'test' && (
            <SchemaTestSandbox inputSchema={inputSchema} outputSchema={outputSchema} />
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between sm:justify-between">
          {isInspect ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleForkFromInspect}
                className="text-xs gap-1.5 shadow-md shadow-primary/20"
              >
                <Copy className="w-3.5 h-3.5" />
                Fork as Custom Draft
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="text-xs"
              >
                Cancel
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!name.trim() || isSaving}
                  onClick={handleSaveDraft}
                  className="text-xs gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Saving...' : 'Save Draft'}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={!name.trim() || isSaving}
                  onClick={handlePublish}
                  className="text-xs gap-1.5 shadow-md shadow-primary/20"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {isSaving ? 'Publishing...' : 'Publish Version'}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
      </DialogContent>
    </Dialog>
  );
};
