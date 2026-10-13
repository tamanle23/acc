# History Log 057: GDPR Article 17 5-Stage Cryptographic Erasure Cascade (Phase 19)

## Problem
`TenantPurgeService` purged data in batches but (a) did not lock the tenant during the purge, (b) produced a receipt with only counts and a tenant hash (no proof of *which* records were destroyed), and (c) the receipt was unsigned, so it was not tamper-evident.

## Plan
1. Stage 1 ingress lockdown: `TenantPurgeLockRegistry` + `TenantPurgeLockdownFilter` rejecting mutating requests (`X-Tenant-Id` header) with HTTP 423; concurrent purge of the same tenant rejected.
2. Stage 2: purge edges, then records, feeding every destroyed ID into a streaming SHA-256 digest (no ID list held in memory).
3. Stages 3-4 unchanged (metadata purge preserves SYSTEM rows; L1/L2 cache shredding).
4. Stage 5: `CertificateOfErasure` gains `deletedRecordsDigest`, `signatureAlgorithm`, `signature` (HMAC-SHA256 over a canonical payload). Key from `unipost.compliance.erasure-signing-key`; falls back to an ephemeral per-process key with a warning (no hardcoded secret). `verifyCertificate()` added.
5. Lock always released in `finally`.

## Changes
- `CertificateOfErasure.java`, `TenantPurgeService.java` (updated)
- `TenantPurgeLockRegistry.java`, `TenantPurgeLockdownFilter.java` (new)
- `TenantPurgeServiceTest.java`: constructor update + signature/tamper and lockdown-lifecycle tests

## Verification
- `TenantPurgeServiceTest`: 4/4 passed (existing 2 + 2 new).

## Follow-ups
- Surface `signature`/`deletedRecordsDigest` in `data-privacy-panel.tsx` and tekgo-ui.
- HMAC is symmetric (verifiable only by the platform). Asymmetric/RFC 3161 timestamping would need a TSA and key infrastructure; not implemented.
- Lock registry is per-node in-memory; multi-node deployments need a distributed lock (Hazelcast).
- Blob shredding in `unipost-ms-fs` not covered.
