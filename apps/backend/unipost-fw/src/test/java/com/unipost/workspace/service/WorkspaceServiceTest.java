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

    @Test
    @DisplayName("Should get workspace by uid for active tenant")
    void getWorkspaceSuccessfully() {
        Workspace ws = new Workspace();
        ws.setId(10L);
        ws.setUid("ws-10");
        ws.setTenantId("tenant-acme");
        ws.setName("Acme Labs");

        when(workspaceRepository.findByUidAndDeletedDateIsNull("ws-10")).thenReturn(Optional.of(ws));

        WorkspaceDto result = workspaceService.getWorkspace("ws-10");
        assertNotNull(result);
        assertEquals("Acme Labs", result.name());

        // Cross-tenant access throws MetadataNotFoundException
        ws.setTenantId("tenant-other");
        assertThrows(MetadataNotFoundException.class, () -> workspaceService.getWorkspace("ws-10"));
    }

    @Test
    @DisplayName("Should update workspace fields")
    void updateWorkspaceSuccessfully() {
        Workspace ws = new Workspace();
        ws.setId(10L);
        ws.setUid("ws-10");
        ws.setTenantId("tenant-acme");
        ws.setName("Old Name");
        ws.setDescription("Old Desc");

        when(workspaceRepository.findByUidAndDeletedDateIsNull("ws-10")).thenReturn(Optional.of(ws));
        when(workspaceRepository.save(any(Workspace.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateWorkspaceRequest req = new UpdateWorkspaceRequest("New Name", "New Desc", "ENTERPRISE");
        WorkspaceDto updated = workspaceService.updateWorkspace("ws-10", req);

        assertEquals("New Name", updated.name());
        assertEquals("New Desc", updated.description());
        assertEquals("ENTERPRISE", updated.planTier());
    }

    @Test
    @DisplayName("Should set default workspace and unset previous default")
    void setDefaultWorkspaceSuccessfully() {
        Workspace oldDefault = new Workspace();
        oldDefault.setId(1L);
        oldDefault.setTenantId("tenant-acme");
        oldDefault.setIsDefault(true);
        oldDefault.setIsImmutable(false);

        Workspace newDefault = new Workspace();
        newDefault.setId(2L);
        newDefault.setUid("ws-2");
        newDefault.setTenantId("tenant-acme");
        newDefault.setIsDefault(false);

        when(workspaceRepository.findByUidAndDeletedDateIsNull("ws-2")).thenReturn(Optional.of(newDefault));
        when(workspaceRepository.findByTenantIdAndIsDefaultTrueAndDeletedDateIsNull("tenant-acme"))
                .thenReturn(Optional.of(oldDefault));
        when(workspaceRepository.save(any(Workspace.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkspaceDto result = workspaceService.setDefaultWorkspace("ws-2");

        assertTrue(result.isDefault());
        assertFalse(oldDefault.getIsDefault());
        verify(workspaceRepository).save(oldDefault);
        verify(workspaceRepository).save(newDefault);
    }

    @Test
    void testWorkspaceNotFoundAndTenantMismatchBranches() {
        when(workspaceRepository.findByUidAndDeletedDateIsNull("missing")).thenReturn(Optional.empty());

        assertThrows(MetadataNotFoundException.class, () -> workspaceService.getWorkspace("missing"));
        assertThrows(MetadataNotFoundException.class, () -> workspaceService.updateWorkspace("missing", new UpdateWorkspaceRequest("N", null, null)));
        assertThrows(MetadataNotFoundException.class, () -> workspaceService.setDefaultWorkspace("missing"));
        assertThrows(MetadataNotFoundException.class, () -> workspaceService.deleteWorkspace("missing"));

        Workspace alien = new Workspace();
        alien.setId(99L);
        alien.setUid("alien-ws");
        alien.setTenantId("alien-tenant");
        alien.setIsDefault(false);
        alien.setIsImmutable(false);
        when(workspaceRepository.findByUidAndDeletedDateIsNull("alien-ws")).thenReturn(Optional.of(alien));

        assertThrows(MetadataNotFoundException.class, () -> workspaceService.getWorkspace("alien-ws"));
        assertThrows(MetadataNotFoundException.class, () -> workspaceService.updateWorkspace("alien-ws", new UpdateWorkspaceRequest("N", null, null)));
        assertThrows(MetadataNotFoundException.class, () -> workspaceService.setDefaultWorkspace("alien-ws"));
        assertThrows(MetadataNotFoundException.class, () -> workspaceService.deleteWorkspace("alien-ws"));
    }

    @Test
    void testSetDefaultWorkspace_WhenAlreadyDefault_ReturnsEarly() {
        Workspace ws = new Workspace();
        ws.setId(1L);
        ws.setUid("ws-default");
        ws.setTenantId("tenant-acme");
        ws.setIsDefault(true);
        when(workspaceRepository.findByUidAndDeletedDateIsNull("ws-default")).thenReturn(Optional.of(ws));

        WorkspaceDto result = workspaceService.setDefaultWorkspace("ws-default");
        assertTrue(result.isDefault());
        verify(workspaceRepository, never()).save(any(Workspace.class));
    }
}

