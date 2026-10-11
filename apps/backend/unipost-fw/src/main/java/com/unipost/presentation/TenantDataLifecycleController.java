package com.unipost.presentation;

import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.tenant.export.TenantExportService;
import com.unipost.tenant.purge.CertificateOfErasure;
import com.unipost.tenant.purge.TenantPurgeService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.time.Instant;

/**
 * Controller exposing endpoints for GDPR Article 20 data portability (streaming export)
 * and GDPR Article 17 Right-to-be-Forgotten cryptographic hard-purge.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/metadata/tenants")
@RequiredArgsConstructor
public class TenantDataLifecycleController {

    private final TenantExportService tenantExportService;
    private final TenantPurgeService tenantPurgeService;
    private final ResponseEntityBuilder responseBuilder;

    /**
     * Streams the complete tenant metadata and data archive directly as a compressed ZIP file.
     * Prevents JVM heap exhaustion by utilizing non-blocking line-delimited streaming chunks.
     */
    @GetMapping("/{tenantId}/export")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasRole('ADMIN')")
    public void exportTenantArchive(
            @PathVariable String tenantId,
            HttpServletResponse response) throws IOException {

        String filename = "tenant_export_" + tenantId + "_" + Instant.now().toEpochMilli() + ".zip";

        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
        response.setHeader("X-Tenant-Export-Version", "1.0.0");

        tenantExportService.streamTenantArchive(tenantId, response.getOutputStream());
        response.flushBuffer();
    }

    /**
     * Non-blocking asynchronous streaming export returning ResponseEntity<StreamingResponseBody>
     * for GDPR Article 20 data portability.
     */
    @GetMapping("/{tenantId}/export-stream")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasRole('ADMIN')")
    public ResponseEntity<StreamingResponseBody> exportTenantArchiveStream(
            @PathVariable String tenantId) {

        String filename = "tenant_export_" + tenantId + "_" + Instant.now().toEpochMilli() + ".zip";

        StreamingResponseBody responseBody = outputStream -> {
            tenantExportService.streamTenantArchive(tenantId, outputStream);
        };

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header("X-Tenant-Export-Version", "1.0.0")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(responseBody);
    }

    /**
     * Executes the 5-stage micro-batch hard-purge pipeline for GDPR Article 17 compliance.
     * Returns an immutable, anonymized Certificate of Erasure audit receipt.
     */
    @PostMapping("/{tenantId}/purge")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('TENANT_COMPLIANCE_PURGE')")
    public ResponseEntity<ResponseWrapper<ContextHeader, CertificateOfErasure>> purgeTenant(
            @PathVariable String tenantId,
            Authentication authentication) {

        String operator = authentication != null ? authentication.getName() : "ADMIN_OPERATOR";
        CertificateOfErasure certificate = tenantPurgeService.executeTenantPurge(tenantId, operator);
        return responseBuilder.success(certificate);
    }
}
