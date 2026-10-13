import React, { useState } from 'react';
import { springApiClient } from '@/features/spring-auth';
import { toast } from 'sonner';
import { downloadTenantExport } from './export-download';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Download,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  FileArchive,
  Database,
  AlertTriangle,
  Loader2,
  FileCheck,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

interface CertificateOfErasure {
  certificateId: string;
  tenantIdHash: string;
  purgedAt: string;
  recordsDeleted: number;
  relationshipsDeleted: number;
  attributesDeleted: number;
  entityTypesDeleted: number;
  relationshipTypesDeleted: number;
  status: string;
  executedBy: string;
}

export const DataPrivacyPanel: React.FC = () => {
  const authUser = useAuthStore((state) => state.auth.user);
  const activeTenantId = (authUser as any)?.tenantId || 'tenant-acme';

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Purge modal state
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [confirmTenantId, setConfirmTenantId] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [certificate, setCertificate] = useState<CertificateOfErasure | null>(null);

  // 1. Handle Streaming Export Download
  const handleExportArchive = async () => {
    try {
      setIsExporting(true);
      toast.info('Generating streaming data bundle (.ZIP)...');

      await downloadTenantExport(activeTenantId);

      toast.success('Tenant data archive downloaded successfully!');
    } catch (err: unknown) {
      // Dismissing the save dialog is a user choice, not a failure.
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.info('Export cancelled.');
      } else {
        toast.error('Failed to generate export archive. Please try again.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Handle GDPR Article 17 Hard-Purge
  const handleExecutePurge = async () => {
    if (confirmTenantId.trim().toLowerCase() !== activeTenantId.toLowerCase()) {
      toast.error('Tenant ID confirmation mismatch.');
      return;
    }

    try {
      setIsPurging(true);
      const res = await springApiClient.post(`/v1/metadata/tenants/${activeTenantId}/purge`);
      const certData: CertificateOfErasure = res.data?.data || res.data;
      setCertificate(certData);
      toast.success('GDPR Article 17 Hard-Purge completed!');
    } catch (err: unknown) {
      toast.error('Purge execution failed. Check administrative permissions.');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header section */}
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          Data Portability & Compliance
        </h3>
        <p className="text-sm text-muted-foreground">
          Manage your organization&apos;s data portability (GDPR Art. 20) and permanent right-to-be-forgotten erasures (GDPR Art. 17).
        </p>
      </div>

      {/* Section 1: Streaming Export */}
      <div className="p-6 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-sky-500" />
              <h4 className="text-base font-semibold text-foreground">
                Export Complete Data Archive (GDPR Art. 20)
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generate a portable, machine-readable ZIP bundle containing your complete entity models, attribute definitions, Pattern C graph edge types, and Line-Delimited JSON (NDJSON) records.
            </p>
          </div>
          <Button
            onClick={handleExportArchive}
            disabled={isExporting}
            className="shrink-0 gap-2 shadow-md shadow-sky-500/20"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export .ZIP Archive'}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-white/40 dark:bg-white/5 border border-white/10 flex items-center gap-2.5">
            <Database className="h-4 w-4 text-sky-500 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">JSON Schemas</p>
              <p className="text-[11px] text-muted-foreground">Draft-07 models & UI options</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/40 dark:bg-white/5 border border-white/10 flex items-center gap-2.5">
            <FileCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">NDJSON Stream</p>
              <p className="text-[11px] text-muted-foreground">1,000 records/chunk flat heap</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/40 dark:bg-white/5 border border-white/10 flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 text-indigo-500 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Verified Manifest</p>
              <p className="text-[11px] text-muted-foreground">SHA-256 integrity hash</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: GDPR Article 17 Hard-Purge Danger Zone */}
      <div className="p-6 rounded-2xl bg-destructive/5 dark:bg-destructive/10 backdrop-blur-xl border border-destructive/20 shadow-lg shadow-destructive/5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-base font-semibold">
                Danger Zone: Right to Be Forgotten (GDPR Art. 17)
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              Permanently wipe all records, relationship edges, custom schemas, and distributed caches for tenant workspace <code className="font-mono text-destructive font-semibold">{activeTenantId}</code>. This operation runs across 5 micro-batch stages and produces an immutable, cryptographic <strong>Certificate of Erasure</strong>.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              setCertificate(null);
              setConfirmTenantId('');
              setIsPurgeModalOpen(true);
            }}
            className="shrink-0 gap-2 shadow-md shadow-destructive/20"
          >
            <Trash2 className="h-4 w-4" />
            <span>Initiate Hard-Purge</span>
          </Button>
        </div>
      </div>

      {/* Purge Confirmation / Certificate Modal */}
      <Dialog open={isPurgeModalOpen} onOpenChange={setIsPurgeModalOpen}>
        <DialogContent className="max-w-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-destructive/20 shadow-2xl">
          {!certificate ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <ShieldAlert className="h-6 w-6" />
                  <DialogTitle className="text-lg">Irreversible Tenant Purge</DialogTitle>
                </div>
                <DialogDescription className="text-xs leading-relaxed">
                  This action permanently destroys all tenant data from physical PostgreSQL tables in 5,000-row micro-transactions and invalidates all distributed cache keys. Shared SYSTEM schemas will be preserved.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
                  <p className="font-semibold">Warning: This action cannot be undone.</p>
                  <p>All data, relationships, and custom metadata will be permanently expunged.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenant-confirm-input" className="text-xs font-medium">
                    Type your Tenant ID <span className="font-mono font-bold text-destructive">{activeTenantId}</span> to confirm:
                  </Label>
                  <Input
                    id="tenant-confirm-input"
                    value={confirmTenantId}
                    onChange={(e) => setConfirmTenantId(e.target.value)}
                    placeholder={activeTenantId}
                    className="font-mono text-xs border-destructive/40 focus-visible:ring-destructive"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsPurgeModalOpen(false)}
                  disabled={isPurging}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleExecutePurge}
                  disabled={isPurging || confirmTenantId.trim().toLowerCase() !== activeTenantId.toLowerCase()}
                  className="gap-2"
                >
                  {isPurging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span>{isPurging ? 'Purging Tenant Data...' : 'Permanently Expunge'}</span>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                  <CheckCircle2 className="h-6 w-6" />
                  <DialogTitle className="text-lg">Certificate of Erasure</DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  GDPR Article 17 Hard-Purge execution audit receipt.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 font-mono text-xs">
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-white/10 space-y-2">
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Certificate ID:</span>
                    <span className="font-bold text-foreground">{certificate.certificateId}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Tenant ID Hash:</span>
                    <span className="text-[11px] text-foreground truncate max-w-[280px]" title={certificate.tenantIdHash}>
                      {certificate.tenantIdHash}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{certificate.status}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Records Purged:</span>
                    <span className="text-foreground">{certificate.recordsDeleted}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Graph Edges Purged:</span>
                    <span className="text-foreground">{certificate.relationshipsDeleted}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Custom Schemas:</span>
                    <span className="text-foreground">{certificate.entityTypesDeleted} types, {certificate.attributesDeleted} fields</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Purged At:</span>
                    <span className="text-foreground">{certificate.purgedAt}</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => {
                    setIsPurgeModalOpen(false);
                    window.location.reload();
                  }}
                  className="w-full"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
