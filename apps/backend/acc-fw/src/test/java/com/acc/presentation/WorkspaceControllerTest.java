package com.acc.presentation;

import com.acc.core.context.Context;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;
import com.acc.fw.ResponseEntityBuilder;
import com.acc.workspace.dto.CreateWorkspaceRequest;
import com.acc.workspace.dto.UpdateWorkspaceRequest;
import com.acc.workspace.dto.WorkspaceDto;
import com.acc.workspace.service.WorkspaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WorkspaceControllerTest {

    @Mock
    private WorkspaceService workspaceService;

    @Mock
    private Context contextHelper;

    private ResponseEntityBuilder responseBuilder;
    private WorkspaceController controller;

    @BeforeEach
    void setUp() {
        responseBuilder = new ResponseEntityBuilder();
        ReflectionTestUtils.setField(responseBuilder, "contextHelper", contextHelper);
        controller = new WorkspaceController(workspaceService, responseBuilder);
    }

    @Test
    void testListWorkspaces() {
        WorkspaceDto ws1 = new WorkspaceDto(
                1L, "ws_default", "tenant-test", "DEFAULT", "Default Workspace", "Primary tenant workspace",
                "ENTERPRISE", true, false, LocalDateTime.now(), LocalDateTime.now()
        );
        when(workspaceService.listWorkspacesForCurrentTenant()).thenReturn(List.of(ws1));

        ResponseEntity<ResponseWrapper<ContextHeader, List<WorkspaceDto>>> response =
                controller.listWorkspaces();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getBody()).hasSize(1);
        assertThat(response.getBody().getBody().get(0).uid()).isEqualTo("ws_default");
    }

    @Test
    void testGetWorkspace() {
        WorkspaceDto ws = new WorkspaceDto(
                2L, "ws_custom", "tenant-test", "CUSTOM", "Logistics Studio", "Operations workspace",
                "ENTERPRISE", false, false, LocalDateTime.now(), LocalDateTime.now()
        );
        when(workspaceService.getWorkspace("ws_custom")).thenReturn(ws);

        ResponseEntity<ResponseWrapper<ContextHeader, WorkspaceDto>> response =
                controller.getWorkspace("ws_custom");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getBody().name()).isEqualTo("Logistics Studio");
    }

    @Test
    void testCreateWorkspace() {
        CreateWorkspaceRequest request = new CreateWorkspaceRequest("NEW_WS", "New Studio", "New description", "PRO");
        WorkspaceDto created = new WorkspaceDto(
                3L, "ws_new", "tenant-test", "NEW_WS", "New Studio", "New description",
                "PRO", false, false, LocalDateTime.now(), LocalDateTime.now()
        );
        when(workspaceService.createWorkspace(request)).thenReturn(created);

        ResponseEntity<ResponseWrapper<ContextHeader, WorkspaceDto>> response =
                controller.createWorkspace(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getBody().uid()).isEqualTo("ws_new");
    }

    @Test
    void testUpdateWorkspace() {
        UpdateWorkspaceRequest request = new UpdateWorkspaceRequest("Updated Name", "Updated description", "PRO");
        WorkspaceDto updated = new WorkspaceDto(
                2L, "ws_target", "tenant-test", "TARGET", "Updated Name", "Updated description",
                "PRO", false, false, LocalDateTime.now(), LocalDateTime.now()
        );
        when(workspaceService.updateWorkspace("ws_target", request)).thenReturn(updated);

        ResponseEntity<ResponseWrapper<ContextHeader, WorkspaceDto>> response =
                controller.updateWorkspace("ws_target", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getBody().name()).isEqualTo("Updated Name");
    }

    @Test
    void testSetDefaultWorkspace() {
        WorkspaceDto updated = new WorkspaceDto(
                2L, "ws_target", "tenant-test", "TARGET", "Target Workspace", "Defaulted",
                "PRO", true, false, LocalDateTime.now(), LocalDateTime.now()
        );
        when(workspaceService.setDefaultWorkspace("ws_target")).thenReturn(updated);

        ResponseEntity<ResponseWrapper<ContextHeader, WorkspaceDto>> response =
                controller.setDefaultWorkspace("ws_target");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getBody().isDefault()).isTrue();
    }

    @Test
    void testDeleteWorkspace() {
        doNothing().when(workspaceService).deleteWorkspace("ws_target");

        ResponseEntity<ResponseWrapper<ContextHeader, Void>> response =
                controller.deleteWorkspace("ws_target");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(workspaceService).deleteWorkspace("ws_target");
    }
}
