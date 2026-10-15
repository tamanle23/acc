import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import type { DagNodeData, DagNodeType } from './dag-node';
import { validateBindingExpression } from './workflow-ir-converter';
import { Plus, Trash2, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface DagPropertyInspectorProps {
  nodeId: string | null;
  nodeData: DagNodeData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateNodeData: (nodeId: string, updatedData: Partial<DagNodeData>) => void;
  availableTaskRefs: string[];
}

export function DagPropertyInspector({
  nodeId,
  nodeData,
  open,
  onOpenChange,
  onUpdateNodeData,
  availableTaskRefs,
}: DagPropertyInspectorProps) {
  const [formData, setFormData] = useState<DagNodeData | null>(nodeData);
  const [paramKey, setParamKey] = useState('');
  const [paramValue, setParamValue] = useState('');

  useEffect(() => {
    setFormData(nodeData);
  }, [nodeData]);

  if (!nodeId || !formData) {
    return null;
  }

  const handleFieldChange = (field: keyof DagNodeData, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdateNodeData(nodeId, { [field]: value });
  };

  const handleAddParam = () => {
    if (!paramKey.trim()) return;
    const currentParams = formData.inputParameters || {};
    const updated = {
      ...currentParams,
      [paramKey.trim()]: paramValue.trim(),
    };
    handleFieldChange('inputParameters', updated);
    setParamKey('');
    setParamValue('');
  };

  const handleRemoveParam = (keyToRemove: string) => {
    const currentParams = { ...(formData.inputParameters || {}) };
    delete currentParams[keyToRemove];
    handleFieldChange('inputParameters', currentParams);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border-l border-white/20 dark:border-white/10 shadow-2xl z-50 overflow-hidden"
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <span>Node Inspector</span>
              <Badge variant="outline" className="text-xs font-mono font-normal">
                {formData.taskType}
              </Badge>
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Configure step execution parameters, retry reliability, and DAG expressions.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2 shrink-0">
            <TabsList className="grid grid-cols-4 w-full h-9">
              <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
              <TabsTrigger value="params" className="text-xs">Bindings</TabsTrigger>
              <TabsTrigger value="reliability" className="text-xs">Policies</TabsTrigger>
              <TabsTrigger value="routing" className="text-xs">Routing</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* 1. General Tab */}
            <TabsContent value="general" className="mt-0 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="taskRef" className="text-xs font-semibold">
                  Task Reference Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="taskRef"
                  value={formData.taskReferenceName}
                  onChange={(e) => handleFieldChange('taskReferenceName', e.target.value)}
                  className="font-mono text-xs h-8"
                  placeholder="e.g. checkInventory"
                />
                <p className="text-[10px] text-muted-foreground">
                  Unique node identifier in DAG expressions (${`{${formData.taskReferenceName}.output}`}).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="label" className="text-xs font-semibold">
                  Display Label
                </Label>
                <Input
                  id="label"
                  value={formData.label || ''}
                  onChange={(e) => handleFieldChange('label', e.target.value)}
                  className="text-xs h-8"
                  placeholder="e.g. Check Inventory Service"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="domain" className="text-xs font-semibold">
                  Worker Domain Routing
                </Label>
                <Input
                  id="domain"
                  value={formData.domain || 'default'}
                  onChange={(e) => handleFieldChange('domain', e.target.value)}
                  className="font-mono text-xs h-8"
                  placeholder="e.g. payment, shipping, default"
                />
                <p className="text-[10px] text-muted-foreground">
                  Target worker lease domain pool.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-semibold">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  className="text-xs resize-none h-20"
                  placeholder="Operational intent and behavior of this node..."
                />
              </div>
            </TabsContent>

            {/* 2. Parameters & Bindings Tab */}
            <TabsContent value="params" className="mt-0 space-y-4">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                <span className="text-xs font-semibold">Add Input Parameter</span>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Key (e.g. orderId)"
                    value={paramKey}
                    onChange={(e) => setParamKey(e.target.value)}
                    className="text-xs h-8 font-mono"
                  />
                  <Input
                    placeholder="${workflow.input.id}"
                    value={paramValue}
                    onChange={(e) => setParamValue(e.target.value)}
                    className="text-xs h-8 font-mono"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full h-7 text-xs gap-1"
                  onClick={handleAddParam}
                  disabled={!paramKey.trim()}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Parameter
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Configured Parameters</Label>
                {(!formData.inputParameters || Object.keys(formData.inputParameters).length === 0) ? (
                  <p className="text-xs text-muted-foreground italic p-2 border border-dashed rounded-lg text-center">
                    No input parameters bound. Click above to add bindings.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(formData.inputParameters).map(([k, v]) => {
                      const strVal = String(v);
                      const isExpr = strVal.includes('${');
                      const check = isExpr
                        ? validateBindingExpression(strVal, availableTaskRefs)
                        : { valid: true };

                      return (
                        <div
                          key={k}
                          className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/50 text-xs"
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold">{k}:</span>
                              <span className="font-mono text-muted-foreground truncate">{strVal}</span>
                            </div>
                            {isExpr && (
                              <div className="flex items-center gap-1 mt-1 text-[10px]">
                                {check.valid ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Valid Binding
                                  </span>
                                ) : (
                                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5" /> {check.error}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveParam(k)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 3. Reliability & Policies Tab */}
            <TabsContent value="reliability" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="timeoutSeconds" className="text-xs font-semibold">
                    Timeout (seconds)
                  </Label>
                  <Input
                    id="timeoutSeconds"
                    type="number"
                    value={formData.timeoutSeconds ?? 30}
                    onChange={(e) => handleFieldChange('timeoutSeconds', parseInt(e.target.value) || 0)}
                    className="text-xs h-8"
                    min={1}
                    max={86400}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="retryCount" className="text-xs font-semibold">
                    Retry Attempts (0-10)
                  </Label>
                  <Input
                    id="retryCount"
                    type="number"
                    value={formData.retryCount ?? 3}
                    onChange={(e) => handleFieldChange('retryCount', parseInt(e.target.value) || 0)}
                    className="text-xs h-8"
                    min={0}
                    max={10}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="retryDelay" className="text-xs font-semibold">
                    Retry Delay (seconds)
                  </Label>
                  <Input
                    id="retryDelay"
                    type="number"
                    value={formData.retryDelaySeconds ?? 2}
                    onChange={(e) => handleFieldChange('retryDelaySeconds', parseInt(e.target.value) || 0)}
                    className="text-xs h-8"
                    min={0}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="backoffRate" className="text-xs font-semibold">
                    Backoff Multiplier
                  </Label>
                  <Input
                    id="backoffRate"
                    type="number"
                    step="0.5"
                    value={formData.backoffRate ?? 2.0}
                    onChange={(e) => handleFieldChange('backoffRate', parseFloat(e.target.value) || 1.0)}
                    className="text-xs h-8"
                    min={1.0}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <Label htmlFor="compensateRef" className="text-xs font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  Saga Compensation Handler
                </Label>
                <Input
                  id="compensateRef"
                  value={formData.compensateHandlerRef || ''}
                  onChange={(e) => handleFieldChange('compensateHandlerRef', e.target.value)}
                  className="font-mono text-xs h-8"
                  placeholder="e.g. cancelPackingJob"
                />
                <p className="text-[10px] text-muted-foreground">
                  Task executed in reverse topological order if the workflow fails downstream.
                </p>
              </div>
            </TabsContent>

            {/* 4. Routing & Conditions Tab */}
            <TabsContent value="routing" className="mt-0 space-y-4">
              {formData.taskType === 'SWITCH' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="switchCond" className="text-xs font-semibold">
                      Condition Expression
                    </Label>
                    <Input
                      id="switchCond"
                      value={formData.condition || ''}
                      onChange={(e) => handleFieldChange('condition', e.target.value)}
                      className="font-mono text-xs h-8"
                      placeholder="${workflow.input.tier}"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Evaluated value determines which target branch route to execute.
                    </p>
                  </div>
                </div>
              ) : formData.taskType === 'DO_WHILE' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="loopCond" className="text-xs font-semibold">
                      Loop Condition Expression
                    </Label>
                    <Input
                      id="loopCond"
                      value={formData.loopCondition || formData.condition || ''}
                      onChange={(e) => {
                        handleFieldChange('loopCondition', e.target.value);
                        handleFieldChange('condition', e.target.value);
                      }}
                      className="font-mono text-xs h-8"
                      placeholder="${taskRef.output.status} == 'PENDING'"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Evaluated after each iteration. Graph continues looping while true.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic p-4 text-center border border-dashed rounded-xl">
                  Node type <span className="font-mono font-semibold">{formData.taskType}</span> uses standard sequential DAG routing.
                </p>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
