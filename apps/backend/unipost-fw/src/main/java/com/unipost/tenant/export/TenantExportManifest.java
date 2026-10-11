package com.unipost.tenant.export;

import java.time.Instant;

/**
 * Manifest metadata describing the contents, record counts, and SHA-256 integrity digest of an exported tenant bundle.
 */
public record TenantExportManifest(
        String version,
        String tenantId,
        String exportedAt,
        String format,
        String sha256Digest,
        ExportSummary summary
) {
    public record ExportSummary(
            int entityTypesCount,
            int attributeDefinitionsCount,
            int relationshipTypesCount,
            long recordsCount,
            long relationshipsCount
    ) {}

    public static TenantExportManifest of(String tenantId, String sha256Digest, ExportSummary summary) {
        return new TenantExportManifest(
                "1.0.0",
                tenantId,
                Instant.now().toString(),
                "ZIP_STREAMING_BUNDLE",
                sha256Digest != null ? sha256Digest : "",
                summary
        );
    }

    public static TenantExportManifest of(String tenantId, ExportSummary summary) {
        return of(tenantId, "", summary);
    }
}
