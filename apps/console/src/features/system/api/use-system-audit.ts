import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth/api-client';
import type { RecordAuditLog, AuditVerificationResult } from '@acc/client';
import { toast } from 'sonner';

export interface AuditQueryResponse {
  content: RecordAuditLog[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface VerifyChainParams {
  tenantId?: string;
  fromId?: number;
  toId?: number;
}

export interface ComplianceExportResponse {
  tenantId: string;
  exportedAt: string;
  recordCount: number;
  chainIntact: boolean;
  rootHash: string;
  records: RecordAuditLog[];
}

export function useSystemAuditRecords(params?: {
  tenantId?: string;
  operation?: string;
  actor?: string;
  page?: number;
  size?: number;
}) {
  return useQuery({
    queryKey: ['system', 'audit-records', params],
    queryFn: async (): Promise<AuditQueryResponse> => {
      const q = new URLSearchParams();
      if (params?.tenantId) q.set('tenantId', params.tenantId);
      if (params?.operation) q.set('operation', params.operation);
      if (params?.actor) q.set('actor', params.actor);
      if (params?.page !== undefined) q.set('page', String(params.page));
      if (params?.size !== undefined) q.set('size', String(params.size));

      const res = await springApiClient.get<any>(`/v1/system/audit/records?${q.toString()}`);
      return res.data?.body || res.data;
    },
    staleTime: 10 * 1000,
  });
}

export function useVerifyAuditChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: VerifyChainParams): Promise<AuditVerificationResult> => {
      const res = await springApiClient.post<any>('/v1/system/audit/verify', params ?? {});
      return res.data?.body || res.data;
    },
    onSuccess: (data) => {
      if (data.intact) {
        toast.success(`Cryptographic Ledger Verified: ${data.verifiedCount} blocks intact.`);
      } else {
        toast.error(`Ledger Tampering Detected: Block #${data.tamperedId} signature mismatch!`);
      }
      queryClient.invalidateQueries({ queryKey: ['system', 'audit-verification'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Cryptographic audit verification failed.');
    },
  });
}

export function useExportCompliancePackage() {
  return useMutation({
    mutationFn: async (tenantId: string = 'SYSTEM'): Promise<ComplianceExportResponse> => {
      const res = await springApiClient.get<ComplianceExportResponse>(`/v1/system/audit/export?tenantId=${encodeURIComponent(tenantId)}`);
      return res.data;
    },
    onSuccess: (data) => {
      // Trigger browser JSON evidence download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance_audit_evidence_${data.tenantId}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Compliance Evidence Exported (${data.recordCount} records, intact: ${data.chainIntact})`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Compliance bundle export failed.');
    },
  });
}
