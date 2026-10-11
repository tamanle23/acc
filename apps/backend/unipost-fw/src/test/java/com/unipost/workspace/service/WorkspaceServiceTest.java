package com.unipost.workspace.service;

import com.unipost.domain.workspace.Workspace;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.repository.jpa.WorkspaceRepository;
import com.unipost.service.exception.MetadataConflictException;
import com.unipost.service.exception.MetadataNotFoundException;
import com.unipost.workspace.dto.CreateWorkspaceRequest;
import com.unipost.workspace.dto.UpdateWorkspaceRequest;
import com.unipost.workspace.dto.WorkspaceDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WorkspaceServiceTest {

    @Mock
    private WorkspaceRepository workspaceRepository;

    @InjectMocks
    private WorkspaceService workspaceService;

    @BeforeEach
    void setUp() {
        TenantContextHolder.setTenantId("tenant-acme");
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("Should list workspaces for current authenticated tenant")
    void listWorkspacesForCurrentTenant() {
        Workspace ws = new Workspace();
        ws.setId(1L);
        ws.setUid("ws-1");
        ws.setTenantId("tenant-acme");
        ws.setCode("MAIN");
        ws.setName("Acme Primary");
        ws.setIsDefault(true);
        ws.setIsImmutable(true);

        when(workspaceRepository.findByTenantIdAndDeletedDateIsNull("tenant-acme")).thenReturn(List.of(ws));

        List<WorkspaceDto> results = workspaceService.listWorkspacesForCurrentTenant();

        assertEquals(1, results.size());
        assertEquals("MAIN", results.get(0).code());
        assertEquals("Acme Primary", results.get(0).name());
        assertTrue(results.get(0).isDefault());
    }

    @Test
    @DisplayName("Should create new workspace successfully")
    void createWorkspaceSuccessfully() {
        CreateWorkspaceRequest request = new CreateWorkspaceRequest("DEV", "Development Team", "Dev sandbox", "PRO");

        when(workspaceRepository.existsByTenantIdAndCodeAndDeletedDateIsNull("tenant-acme", "DEV")).thenReturn(false);
        when(workspaceRepository.save(any(Workspace.class))).thenAnswer(inv -> {
            Workspace ws = inv.getArgument(0);
            ws.setId(2L);
            ws.setUid("ws-dev-uid");
            return ws;
        });

        WorkspaceDto result = workspaceService.createWorkspace(request);

        assertNotNull(result);
        assertEquals("DEV", result.code());
        assertEquals("Development Team", result.name());
        assertFalse(result.isDefault());
        assertFalse(result.isImmutable());
        verify(workspaceRepository).save(any(Workspace.class));
    }

    @Test
    @DisplayName("Should throw MetadataConflictException when workspace code is duplicate")
    void throwExceptionOnDuplicateWorkspaceCode() {
        CreateWorkspaceRequest request = new CreateWorkspaceRequest("MAIN", "Acme Main 2", null, null);

        when(workspaceRepository.existsByTenantIdAndCodeAndDeletedDateIsNull("tenant-acme", "MAIN")).thenReturn(true);

        assertThrows(MetadataConflictException.class, () -> workspaceService.createWorkspace(request));
        verify(workspaceRepository, never()).save(any(Workspace.class));
    }

    @Test
    @DisplayName("Should throw MetadataConflictException when deleting default workspace")
    void throwExceptionWhenDeletingDefaultWorkspace() {
        Workspace defaultWs = new Workspace();
        defaultWs.setId(1L);
        defaultWs.setUid("ws-default");
        defaultWs.setTenantId("tenant-acme");
        defaultWs.setIsDefault(true);
        defaultWs.setIsImmutable(false);

        when(workspaceRepository.findByUidAndDeletedDateIsNull("ws-default")).thenReturn(Optional.of(defaultWs));

        assertThrows(MetadataConflictException.class, () -> workspaceService.deleteWorkspace("ws-default"));
        verify(workspaceRepository, never()).save(any(Workspace.class));
    }

    @Test
    @DisplayName("Should throw MetadataConflictException when deleting immutable workspace")
    void throwExceptionWhenDeletingImmutableWorkspace() {
        Workspace immutableWs = new Workspace();
        immutableWs.setId(1L);
        immutableWs.setUid("ws-immutable");
        immutableWs.setTenantId("tenant-acme");
        immutableWs.setIsDefault(false);
        immutableWs.setIsImmutable(true);

        when(workspaceRepository.findByUidAndDeletedDateIsNull("ws-immutable")).thenReturn(Optional.of(immutableWs));

        assertThrows(MetadataConflictException.class, () -> workspaceService.deleteWorkspace("ws-immutable"));
    }

    @Test
    @DisplayName("Should throw MetadataConflictException when deleting sole remaining workspace")
    void throwExceptionWhenDeletingSoleWorkspace() {
        Workspace regularWs = new Workspace();
        regularWs.setId(1L);
        regularWs.setUid("ws-regular");
        regularWs.setTenantId("tenant-acme");
        regularWs.setIsDefault(false);
        regularWs.setIsImmutable(false);

        when(workspaceRepository.findByUidAndDeletedDateIsNull("ws-regular")).thenReturn(Optional.of(regularWs));
        when(workspaceRepository.countByTenantIdAndDeletedDateIsNull("tenant-acme")).thenReturn(1L);

        assertThrows(MetadataConflictException.class, () -> workspaceService.deleteWorkspace("ws-regular"));
    }

    @Test
    @DisplayName("Should soft delete non-default workspace when tenant has multiple workspaces")
    void deleteWorkspaceSuccessfully() {
        Workspace regularWs = new Workspace();
        regularWs.setId(2L);
        regularWs.setUid("ws-regular");
        regularWs.setTenantId("tenant-acme");
        regularWs.setIsDefault(false);
        regularWs.setIsImmutable(false);

        when(workspaceRepository.findByUidAndDeletedDateIsNull("ws-regular")).thenReturn(Optional.of(regularWs));
        when(workspaceRepository.countByTenantIdAndDeletedDateIsNull("tenant-acme")).thenReturn(2L);

        workspaceService.deleteWorkspace("ws-regular");

        assertNotNull(regularWs.getDeletedDate());
        verify(workspaceRepository).save(regularWs);
    }
}
