import React, { useEffect, useState } from 'react';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import {
  useAttributeDefinitions,
  useCreateEntityRecord,
  useUpdateEntityRecord,
  useValidateEntityRecord,
  useEntityType,
} from '../../api/metadata-api';
import { metadataService } from '../../api/metadata-service';
import { ConflictBanner, isConflictError } from '../conflict-banner';
import { useQueryClient } from '@tanstack/react-query';
import { buildZodSchema, getInitialFormValues } from '../../data/schema-generator';
import { DynamicFieldRenderer } from '../dynamic-fields/dynamic-field-renderer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  entityTypeId: string | number;
}

export const RecordEditorDialog: React.FC<Props> = ({ entityTypeId }) => {
  const { isRecordEditorDialogOpen, editingRecord, closeRecordEditorDialog } =
    useMetadataUiStore();

  const { data: attributesResponse } = useAttributeDefinitions(entityTypeId);
  const { data: entityType } = useEntityType(entityTypeId);

  const queryClient = useQueryClient();
  const createMutation = useCreateEntityRecord(entityTypeId);
  const updateMutation = useUpdateEntityRecord(entityTypeId);
  const validateMutation = useValidateEntityRecord(entityTypeId);

  const isEditMode = Boolean(editingRecord);
  const attributes = attributesResponse?.content || [];

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isRecordEditorDialogOpen && attributes.length > 0) {
      setFormData(
        getInitialFormValues(
          attributes,
          editingRecord?.attributes as Record<string, unknown> | undefined
        )
      );
      setErrors({});
      setGlobalError(null);
      setValidationSuccess(null);
    }
  }, [isRecordEditorDialogOpen, editingRecord, attributes]);

  const [isConflict, setIsConflict] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVersion, setLatestVersion] = useState<number | undefined>(undefined);

  useEffect(() => {
    setIsConflict(false);
    setLatestVersion(undefined);
  }, [editingRecord, isRecordEditorDialogOpen]);

  const handleRefresh = async () => {
    if (!editingRecord) return;
    setIsRefreshing(true);
    try {
      const latest = await metadataService.getEntityRecord(entityTypeId, editingRecord.id);
      if (latest) {
        setFormData(
          getInitialFormValues(attributes, latest.attributes as Record<string, unknown>)
        );
        setErrors({});
        setGlobalError(null);
        setLatestVersion(latest.version);
        setIsConflict(false);
        queryClient.invalidateQueries({ queryKey: ['metadata', 'records', entityTypeId] });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setValidationSuccess(null);
    // Clear field-specific error upon edit
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const handleReset = () => {
    setFormData(
      getInitialFormValues(
        attributes,
        editingRecord?.attributes as Record<string, unknown> | undefined
      )
    );
    setErrors({});
    setGlobalError(null);
    setValidationSuccess(null);
  };

  const handlePreValidate = async () => {
    setGlobalError(null);
    setValidationSuccess(null);
    setErrors({});

    try {
      const res = await validateMutation.mutateAsync({
        entityTypeId,
        attributes: formData,
      });

      if (res.valid) {
        setValidationSuccess(
          `Payload is 100% compliant with JSON Schema v${res.schemaVersion}. All constraints & references verified.`
        );
      } else {
        const fieldErrors: Record<string, string> = {};
        res.errors.forEach((err) => {
          const fieldKey = err.field || 'general';
          if (!fieldErrors[fieldKey]) {
            fieldErrors[fieldKey] = err.message;
          }
        });
        setErrors(fieldErrors);
        setGlobalError(`Dry-run validation found ${res.errors.length} issue(s).`);
      }
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Dry-run validation request failed.');
    }
  };

  const parseValidationErrors = (err: unknown): Record<string, string> | null => {
    const res = (err as any)?.response?.data;
    const errList = res?.errors || (err as any)?.errors;
    if (Array.isArray(errList) && errList.length > 0) {
      const mapped: Record<string, string> = {};
      errList.forEach((e: any) => {
        let field = e.detail || e.field || e.property;
        if (field && typeof field === 'string') {
          if (field.startsWith('attributes.')) field = field.replace('attributes.', '');
          if (field.startsWith('$.')) field = field.replace('$.', '');
          mapped[field] = e.message || 'Validation error';
        }
      });
      return Object.keys(mapped).length > 0 ? mapped : null;
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    // Validate using dynamic Zod compiler
    const schema = buildZodSchema(attributes);
    const validationResult = schema.safeParse(formData);

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const fieldKey = String(issue.path[0]);
        if (!fieldErrors[fieldKey]) {
          fieldErrors[fieldKey] = issue.message;
        }
      });
      setErrors(fieldErrors);
      setGlobalError('Please resolve validation errors before saving.');
      return;
    }

    const payloadAttributes = validationResult.data as Record<string, unknown>;

    if (isEditMode && editingRecord) {
      updateMutation.mutate(
        {
          recordId: editingRecord.id,
          dto: {
            attributes: payloadAttributes,
            version: latestVersion ?? editingRecord.version,
          },
        },
        {
          onSuccess: () => closeRecordEditorDialog(),
          onError: (err: unknown) => {
            if (isConflictError(err)) {
              setIsConflict(true);
              return;
            }
            const fieldErrors = parseValidationErrors(err);
            if (fieldErrors) {
              setErrors(fieldErrors);
              setGlobalError('Please correct the highlighted field errors below.');
            } else {
              setGlobalError(err instanceof Error ? err.message : 'Failed to update record.');
            }
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          entityTypeId,
          attributes: payloadAttributes,
        },
        {
          onSuccess: () => closeRecordEditorDialog(),
          onError: (err: unknown) => {
            const fieldErrors = parseValidationErrors(err);
            if (fieldErrors) {
              setErrors(fieldErrors);
              setGlobalError('Please correct the highlighted field errors below.');
            } else {
              setGlobalError(err instanceof Error ? err.message : 'Failed to create record.');
            }
          },
        }
      );
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isRecordEditorDialogOpen} onOpenChange={(open) => !open && closeRecordEditorDialog()}>
      <DialogContent className="max-w-3xl lg:max-w-4xl w-[92vw] max-h-[90vh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl p-6 rounded-3xl overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">
              {isEditMode ? 'Edit Entity Record' : `Create ${entityType?.name || 'Entity'} Record`}
            </DialogTitle>
            <DialogDescription>
              Submit structured attribute values conforming to the compiled schema constraints.
            </DialogDescription>
          </DialogHeader>

          {isConflict && <ConflictBanner onRefresh={handleRefresh} isRefreshing={isRefreshing} />}

          {validationSuccess && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs border border-emerald-500/20 font-medium animate-in fade-in-50">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{validationSuccess}</span>
            </div>
          )}

          {globalError && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 animate-in fade-in-50">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{globalError}</span>
            </div>
          )}

          <ScrollArea className="flex-1 min-h-[300px] pr-4">
            {attributes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                This entity type has no defined attributes. Please define attributes in the Schema Builder first.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                {attributes.map((attr) => (
                  <div
                    key={attr.id}
                    className={cn(
                      attr.uiComponent === 'textarea' || attr.dataType === 'JSON'
                        ? 'col-span-1 md:col-span-2'
                        : 'col-span-1'
                    )}
                  >
                    <DynamicFieldRenderer
                      attribute={attr}
                      value={formData[attr.systemName]}
                      onChange={(val) => handleFieldChange(attr.systemName, val)}
                      error={errors[attr.systemName]}
                    />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              disabled={isSubmitting || validateMutation.isPending}
              className="text-xs mr-auto"
            >
              Reset Values
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePreValidate}
              disabled={isSubmitting || validateMutation.isPending || attributes.length === 0}
              className="gap-1.5 text-xs border-primary/30 hover:border-primary/60 text-primary hover:text-primary"
              title="Perform server-authoritative dry-run validation without committing to DB"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{validateMutation.isPending ? 'Verifying...' : 'Test Validation'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeRecordEditorDialog}
              disabled={isSubmitting || validateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || validateMutation.isPending || attributes.length === 0}>
              {isSubmitting ? 'Saving Record...' : isEditMode ? 'Update Record' : 'Save Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
