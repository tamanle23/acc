import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  CheckCircle2,
  Lock,
  Code2,
  Layers,
  Wand2,
  Loader2,
  GitFork,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useSynthesizeSchema,
  useCreateAttributeDefinition,
  useUpdateEntityType,
  type SynthesizeSchemaResponse,
  type SynthesizedAttributeProposal,
} from '../../api/metadata-api';

interface AiSchemaGeneratorModalProps {
  entityTypeId: string | number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

const DOMAIN_TEMPLATES = [
  {
    id: 'VENDOR_GOVERNANCE',
    label: 'Vendor Risk & Compliance',
    description: 'Tax IDs (PII), risk scores, tier classification, and compliance lifecycle.',
  },
  {
    id: 'ECOMMERCE_ORDER',
    label: 'E-Commerce Order Fulfillment',
    description: 'Order total, currency, shipping address JSONB, and fulfillment state machine.',
  },
  {
    id: 'FINTECH_PAYMENT',
    label: 'Fintech Payment Ledger',
    description: 'Card/account numbers (FLS masked), settlement amount, and fraud status.',
  },
  {
    id: 'HEALTHCARE_PATIENT',
    label: 'Healthcare Patient Intake',
    description: 'SSN/MRN (FLS masked), DOB, insurance JSONB, and clinical triage states.',
  },
  {
    id: 'SUPPLY_CHAIN_LOGISTICS',
    label: 'Supply Chain Shipment',
    description: 'Tracking code, carrier enum, customs declaration JSONB, and transit FSM.',
  },
];

export const AiSchemaGeneratorModal: React.FC<AiSchemaGeneratorModalProps> = ({
  entityTypeId,
  open,
  onOpenChange,
  onApplied,
}) => {
  const [inputMode, setInputMode] = useState<'template' | 'json' | 'prompt'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('VENDOR_GOVERNANCE');
  const [promptText, setPromptText] = useState<string>(
    'Enterprise vendor onboarding with tax_id, risk_score, contact_email, and bank_account'
  );
  const [sampleJsonText, setSampleJsonText] = useState<string>(
    JSON.stringify(
      {
        vendorCode: 'VND-9021',
        legalName: 'Acme Global Logistics Ltd',
        tax_id: '99-4102938',
        contactEmail: 'compliance@acmelogistics.io',
        riskScore: 14.5,
        isVerified: true,
        tier: 'ENTERPRISE',
        headquarters: {
          country: 'SG',
          city: 'Singapore',
          postalCode: '018989',
        },
      },
      null,
      2
    )
  );

  const [proposal, setProposal] = useState<SynthesizeSchemaResponse | null>(null);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, boolean>>({});
  const [applyLifecycle, setApplyLifecycle] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const synthesizeMutation = useSynthesizeSchema();
  const createAttrMutation = useCreateAttributeDefinition(entityTypeId);
  const updateEntityTypeMutation = useUpdateEntityType(entityTypeId);

  const handleSynthesize = async () => {
    try {
      const payload =
        inputMode === 'template'
          ? { domainTemplate: selectedTemplate, prompt: promptText }
          : inputMode === 'json'
          ? { sampleJson: sampleJsonText, prompt: promptText }
          : { prompt: promptText };

      const result = await synthesizeMutation.mutateAsync(payload);
      setProposal(result);
      const initialSelection: Record<string, boolean> = {};
      (result.attributes || []).forEach((attr) => {
        initialSelection[attr.systemName] = true;
      });
      setSelectedAttrs(initialSelection);
      toast.success(`Synthesized ${result.attributes?.length || 0} attributes via deterministic AST & domain heuristics`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to synthesize schema');
    }
  };

  const toggleAttribute = (systemName: string) => {
    setSelectedAttrs((prev) => ({
      ...prev,
      [systemName]: !prev[systemName],
    }));
  };

  const handleApplyToCanvas = async () => {
    if (!proposal) return;
    const chosen: SynthesizedAttributeProposal[] = (proposal.attributes || []).filter(
      (a) => selectedAttrs[a.systemName]
    );

    if (chosen.length === 0) {
      toast.error('Select at least one synthesized attribute to apply.');
      return;
    }

    setIsApplying(true);
    try {
      let order = 1;
      for (const attr of chosen) {
        await createAttrMutation.mutateAsync({
          name: attr.name,
          systemName: attr.systemName,
          dataType: attr.dataType as any,
          uiComponent: (attr.uiComponent || 'TEXT_INPUT') as any,
          isRequired: attr.isRequired,
          isSearchable: attr.isSearchable,
          displayOrder: order++,
          validationRules: {
            ...(attr.validationRules || {}),
            ...(attr.isPii ? { pii: true, flsMasked: true } : {}),
            ...(attr.enumValues ? { enumValues: attr.enumValues } : {}),
          },
        });
      }

      if (applyLifecycle && proposal.lifecycleConfig) {
        await updateEntityTypeMutation.mutateAsync({
          lifecycleConfig: proposal.lifecycleConfig as any,
        });
      }

      toast.success(`Applied ${chosen.length} synthesized attributes to Entity Schema Studio!`);
      onOpenChange(false);
      if (onApplied) onApplied();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply synthesized attributes');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/30 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md">
                <Wand2 className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>AI-Assisted Schema & FSM Synthesizer</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                    Deterministic AST + Domain Heuristics
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Infer typed attributes, JSONB structures, PII Field-Level Security flags, and FSM lifecycles locally with zero external LLM latency.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as any)}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <TabsList className="bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="template" className="text-xs gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-sky-500" />
                  Domain Blueprints
                </TabsTrigger>
                <TabsTrigger value="json" className="text-xs gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-indigo-500" />
                  Sample JSON AST Inference
                </TabsTrigger>
                <TabsTrigger value="prompt" className="text-xs gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  Natural Language Keywords
                </TabsTrigger>
              </TabsList>

              <Button
                type="button"
                size="sm"
                onClick={handleSynthesize}
                disabled={synthesizeMutation.isPending}
                className="h-8 text-xs gap-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md"
                data-testid="ai-synthesize-trigger-btn"
              >
                {synthesizeMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Synthesizing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    Synthesize Schema Proposal
                  </>
                )}
              </Button>
            </div>

            <TabsContent value="template" className="mt-0 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DOMAIN_TEMPLATES.map((tpl) => {
                  const active = selectedTemplate === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        active
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border/50 bg-background/60 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{tpl.label}</span>
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {tpl.id}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{tpl.description}</p>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="json" className="mt-0 space-y-2">
              <Label className="text-xs font-semibold">
                Paste Sample JSON Payload (AST Inspector infers types, ISO dates, emails, nested JSONB, and PII keys)
              </Label>
              <Textarea
                value={sampleJsonText}
                onChange={(e) => setSampleJsonText(e.target.value)}
                rows={7}
                className="font-mono text-xs bg-slate-950/5 dark:bg-slate-950/60"
                placeholder='{"orderId": "ORD-101", "tax_id": "99-1234", "metadata": {"channel": "web"}}'
              />
            </TabsContent>

            <TabsContent value="prompt" className="mt-0 space-y-2">
              <Label className="text-xs font-semibold">
                Describe Domain Entity & Key Fields
              </Label>
              <Input
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="text-xs h-9"
                placeholder="e.g. Vendor governance with tax_id, risk_score, contact_email, and approval lifecycle"
              />
            </TabsContent>
          </Tabs>

          {/* Synthesized Proposal Preview */}
          {proposal && (
            <div className="space-y-3 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <span>Proposed Attributes ({proposal.attributes?.length || 0})</span>
                    {proposal.entityName && (
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {proposal.entityName}
                      </Badge>
                    )}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">{proposal.description}</p>
                </div>

                {proposal.lifecycleConfig && (
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyLifecycle}
                      onChange={(e) => setApplyLifecycle(e.target.checked)}
                      className="rounded border-border"
                    />
                    <GitFork className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="font-medium">
                      Include FSM ({proposal.lifecycleConfig.states?.length || 0} states)
                    </span>
                  </label>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-border/40 rounded-xl border border-border/50 bg-background/50">
                {(proposal.attributes || []).map((attr) => {
                  const isChecked = Boolean(selectedAttrs[attr.systemName]);
                  return (
                    <div
                      key={attr.systemName}
                      onClick={() => toggleAttribute(attr.systemName)}
                      className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-border"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{attr.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              ({attr.systemName})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {attr.isPii && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1"
                          >
                            <Lock className="h-2.5 w-2.5" />
                            FLS PII
                          </Badge>
                        )}
                        {attr.isRequired && (
                          <Badge variant="outline" className="text-[10px] text-rose-500 border-rose-500/30">
                            Required
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {attr.dataType}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                          {attr.uiComponent}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border/40 bg-muted/20 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!proposal || isApplying}
            onClick={handleApplyToCanvas}
            className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid="ai-apply-schema-btn"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying to Schema...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Apply Selected Attributes to Studio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
