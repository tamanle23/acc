package com.unipost.workspace.service;

import com.unipost.domain.workspace.Workspace;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.repository.jpa.WorkspaceRepository;
import com.unipost.service.exception.MetadataConflictException;
import com.unipost.service.exception.MetadataNotFoundException;
import com.unipost.workspace.dto.CreateWorkspaceRequest;
import com.unipost.workspace.dto.UpdateWorkspaceRequest;
import com.unipost.workspace.dto.WorkspaceDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;

    @Transactional(readOnly = true)
    public List<WorkspaceDto> listWorkspacesForCurrentTenant() {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        return workspaceRepository.findByTenantIdAndDeletedDateIsNull(tenantId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkspaceDto getWorkspace(String uid) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        Workspace ws = workspaceRepository.findByUidAndDeletedDateIsNull(uid)
                .orElseThrow(() -> new MetadataNotFoundException("Workspace not found with uid: " + uid));

        if (!tenantId.equals(ws.getTenantId()) && !"SYSTEM".equals(tenantId)) {
            throw new MetadataNotFoundException("Workspace not found for active tenant");
        }

        return toDto(ws);
    }

    @Transactional
    public WorkspaceDto createWorkspace(CreateWorkspaceRequest request) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        String code = request.code().trim().toUpperCase();

        if (workspaceRepository.existsByTenantIdAndCodeAndDeletedDateIsNull(tenantId, code)) {
            throw new MetadataConflictException("Workspace code '" + code + "' already exists in active tenant");
        }

        Workspace ws = new Workspace();
        ws.setTenantId(tenantId);
        ws.setCode(code);
        ws.setName(request.name().trim());
        ws.setDescription(request.description());
        ws.setPlanTier(request.planTier() != null ? request.planTier() : "STANDARD");
        ws.setIsDefault(false);
        ws.setIsImmutable(false);

        Workspace saved = workspaceRepository.save(ws);
        log.info("Created new workspace '{}' (code: '{}') for tenant '{}'", saved.getName(), saved.getCode(), tenantId);
        return toDto(saved);
    }

    @Transactional
    public WorkspaceDto updateWorkspace(String uid, UpdateWorkspaceRequest request) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        Workspace ws = workspaceRepository.findByUidAndDeletedDateIsNull(uid)
                .orElseThrow(() -> new MetadataNotFoundException("Workspace not found with uid: " + uid));

        if (!tenantId.equals(ws.getTenantId()) && !"SYSTEM".equals(tenantId)) {
            throw new MetadataNotFoundException("Workspace not found for active tenant");
        }

        if (request.name() != null && !request.name().isBlank()) {
            ws.setName(request.name().trim());
        }
        if (request.description() != null) {
            ws.setDescription(request.description());
        }
        if (request.planTier() != null && !request.planTier().isBlank()) {
            ws.setPlanTier(request.planTier());
        }

        Workspace updated = workspaceRepository.save(ws);
        return toDto(updated);
    }

    @Transactional
    public WorkspaceDto setDefaultWorkspace(String uid) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        Workspace target = workspaceRepository.findByUidAndDeletedDateIsNull(uid)
                .orElseThrow(() -> new MetadataNotFoundException("Workspace not found with uid: " + uid));

        if (!tenantId.equals(target.getTenantId()) && !"SYSTEM".equals(tenantId)) {
            throw new MetadataNotFoundException("Workspace not found for active tenant");
        }

        if (Boolean.TRUE.equals(target.getIsDefault())) {
            return toDto(target);
        }

        // Unset existing default workspace for this tenant
        workspaceRepository.findByTenantIdAndIsDefaultTrueAndDeletedDateIsNull(tenantId)
                .ifPresent(existingDefault -> {
                    if (!Boolean.TRUE.equals(existingDefault.getIsImmutable())) {
                        existingDefault.setIsDefault(false);
                        workspaceRepository.save(existingDefault);
                    }
                });

        target.setIsDefault(true);
        Workspace saved = workspaceRepository.save(target);
        log.info("Switched default workspace for tenant '{}' to '{}' (uid: '{}')", tenantId, saved.getName(), saved.getUid());
        return toDto(saved);
    }

    @Transactional
    public void deleteWorkspace(String uid) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        Workspace ws = workspaceRepository.findByUidAndDeletedDateIsNull(uid)
                .orElseThrow(() -> new MetadataNotFoundException("Workspace not found with uid: " + uid));

        if (!tenantId.equals(ws.getTenantId()) && !"SYSTEM".equals(tenantId)) {
            throw new MetadataNotFoundException("Workspace not found for active tenant");
        }

        if (Boolean.TRUE.equals(ws.getIsDefault())) {
            throw new MetadataConflictException("Cannot delete default workspace of tenant");
        }
        if (Boolean.TRUE.equals(ws.getIsImmutable())) {
            throw new MetadataConflictException("Cannot delete immutable workspace of tenant");
        }

        long activeCount = workspaceRepository.countByTenantIdAndDeletedDateIsNull(tenantId);
        if (activeCount <= 1) {
            throw new MetadataConflictException("Cannot delete the only remaining workspace of tenant");
        }

        ws.setDeletedDate(LocalDateTime.now());
        workspaceRepository.save(ws);
        log.info("Soft-deleted workspace '{}' (uid: '{}') for tenant '{}'", ws.getName(), ws.getUid(), tenantId);
    }

    private WorkspaceDto toDto(Workspace ws) {
        return new WorkspaceDto(
                ws.getId(),
                ws.getUid(),
                ws.getTenantId(),
                ws.getCode(),
                ws.getName(),
                ws.getDescription(),
                ws.getPlanTier(),
                ws.getIsDefault(),
                ws.getIsImmutable(),
                ws.getCreatedDate(),
                ws.getLastUpdatedDate()
        );
    }
}
