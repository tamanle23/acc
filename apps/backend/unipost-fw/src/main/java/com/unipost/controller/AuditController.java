package com.unipost.controller;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.unipost.domain.metadata.RecordAuditLog;
import com.unipost.repository.jpa.RecordAuditLogRepository;
import com.unipost.service.AuditMerkleService;
import com.unipost.service.AuditMerkleService.AuditVerificationResult;

import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/v1/system/audit")
@RequiredArgsConstructor
public class AuditController {

    private final RecordAuditLogRepository auditLogRepository;
    private final AuditMerkleService auditMerkleService;

    public record AuditQueryResponse(
            List<AuditRecordDto> content,
            long totalElements,
            int totalPages,
            int page,
            int size
    ) {}

    public record AuditRecordDto(
            Long id,
            String tenantId,
            Long recordId,
            Long entityTypeId,
            String operation,
            String actor,
            Long version,
            Object oldAttributes,
            Object newAttributes,
            Object delta,
            String prevHash,
            String currentHash,
            String createdAt
    ) {}

    public record VerifyChainRequest(
            String tenantId,
            Long fromId,
            Long toId
    ) {}

    public record ComplianceExportResponse(
            String tenantId,
            String exportedAt,
            long recordCount,
            boolean chainIntact,
            String rootHash,
            List<AuditRecordDto> records
    ) {}

    @GetMapping("/records")
    @PreAuthorize("hasAuthority('platform:audit:verify') or hasAuthority('org:audit:read') or hasRole('SYSTEM_ROOT')")
    public ResponseEntity<AuditQueryResponse> getAuditLogs(
            @RequestParam(defaultValue = "SYSTEM") String tenantId,
            @RequestParam(required = false) String operation,
            @RequestParam(required = false) String actor,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        Page<RecordAuditLog> paged = auditLogRepository.findFilteredAuditLogs(
                tenantId,
                operation != null && !operation.isBlank() ? operation : null,
                actor != null && !actor.isBlank() ? actor : null,
                PageRequest.of(page, size)
        );

        List<AuditRecordDto> dtoList = paged.getContent().stream()
                .map(this::toDto)
                .toList();

        return ResponseEntity.ok(new AuditQueryResponse(
                dtoList,
                paged.getTotalElements(),
                paged.getTotalPages(),
                paged.getNumber(),
                paged.getSize()
        ));
    }

    @PostMapping("/verify")
    @PreAuthorize("hasAuthority('platform:audit:verify') or hasRole('SYSTEM_ROOT')")
    public ResponseEntity<AuditVerificationResult> verifyChain(
            @RequestBody(required = false) VerifyChainRequest request
    ) {
        String tenantId = (request != null && request.tenantId() != null) ? request.tenantId() : "SYSTEM";
        Long fromId = request != null ? request.fromId() : null;
        Long toId = request != null ? request.toId() : null;

        AuditVerificationResult result = auditMerkleService.verifyTenantChain(tenantId, fromId, toId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('platform:compliance:export') or hasRole('SYSTEM_ROOT')")
    public ResponseEntity<ComplianceExportResponse> exportCompliancePackage(
            @RequestParam(defaultValue = "SYSTEM") String tenantId
    ) {
        AuditVerificationResult verification = auditMerkleService.verifyTenantChain(tenantId, null, null);
        List<RecordAuditLog> allLogs = auditLogRepository.findByTenantIdAndIdBetweenOrderByIdAsc(tenantId, 1L, Long.MAX_VALUE);

        List<AuditRecordDto> dtos = allLogs.stream().map(this::toDto).toList();

        return ResponseEntity.ok(new ComplianceExportResponse(
                tenantId,
                java.time.Instant.now().toString(),
                dtos.size(),
                verification.intact(),
                verification.latestHash(),
                dtos
        ));
    }

    private AuditRecordDto toDto(RecordAuditLog entity) {
        return new AuditRecordDto(
                entity.getId(),
                entity.getTenantId(),
                entity.getRecordId(),
                entity.getEntityTypeId(),
                entity.getOperation(),
                entity.getActor(),
                entity.getVersion(),
                entity.getOldAttributes(),
                entity.getNewAttributes(),
                entity.getDelta(),
                entity.getPrevHash(),
                entity.getCurrentHash(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null
        );
    }
}
