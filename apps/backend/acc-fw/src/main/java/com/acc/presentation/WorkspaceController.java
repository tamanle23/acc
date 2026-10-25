package com.acc.presentation;

import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;
import com.acc.fw.ResponseEntityBuilder;
import com.acc.workspace.dto.CreateWorkspaceRequest;
import com.acc.workspace.dto.UpdateWorkspaceRequest;
import com.acc.workspace.dto.WorkspaceDto;
import com.acc.workspace.service.WorkspaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final ResponseEntityBuilder responseBuilder;

    /**
     * List all active workspaces for the current authenticated tenant.
     */
    @GetMapping
    public ResponseEntity<ResponseWrapper<ContextHeader, List<WorkspaceDto>>> listWorkspaces() {
        List<WorkspaceDto> workspaces = workspaceService.listWorkspacesForCurrentTenant();
        return responseBuilder.success(workspaces);
    }

    /**
     * Get a specific workspace by UID.
     */
    @GetMapping("/{uid}")
    public ResponseEntity<ResponseWrapper<ContextHeader, WorkspaceDto>> getWorkspace(@PathVariable String uid) {
        WorkspaceDto workspace = workspaceService.getWorkspace(uid);
        return responseBuilder.success(workspace);
    }

    /**
     * Create a new workspace within current tenant.
     */
    @PostMapping
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, WorkspaceDto>> createWorkspace(
            @Valid @RequestBody CreateWorkspaceRequest request) {
        WorkspaceDto created = workspaceService.createWorkspace(request);
        return responseBuilder.success(created);
    }

    /**
     * Update an existing workspace's details.
     */
    @PutMapping("/{uid}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, WorkspaceDto>> updateWorkspace(
            @PathVariable String uid,
            @Valid @RequestBody UpdateWorkspaceRequest request) {
        WorkspaceDto updated = workspaceService.updateWorkspace(uid, request);
        return responseBuilder.success(updated);
    }

    /**
     * Set a workspace as the tenant's active default workspace.
     */
    @PutMapping("/{uid}/default")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, WorkspaceDto>> setDefaultWorkspace(
            @PathVariable String uid) {
        WorkspaceDto updated = workspaceService.setDefaultWorkspace(uid);
        return responseBuilder.success(updated);
    }

    /**
     * Soft-delete a workspace (strictly rejected if default, immutable, or sole workspace).
     */
    @DeleteMapping("/{uid}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Void>> deleteWorkspace(@PathVariable String uid) {
        workspaceService.deleteWorkspace(uid);
        return responseBuilder.success();
    }
}
