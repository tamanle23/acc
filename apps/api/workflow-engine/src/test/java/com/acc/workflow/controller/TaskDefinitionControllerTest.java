package com.acc.workflow.controller;

import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.application.TaskDefinitionRegistry;
import com.acc.workflow.core.model.TaskDefinitionRecord;
import com.acc.workflow.core.model.WorkflowVersionStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TaskDefinitionControllerTest {

    private TaskDefinitionRegistry registry;
    private TaskDefinitionController controller;
    private static final String TENANT_ID = "tenant-task-def-test";

    @BeforeEach
    void setUp() {
        TenantContextHolder.setTenantId(TENANT_ID);
        registry = new TaskDefinitionRegistry(new InMemoryPersistenceAdapter());
        controller = new TaskDefinitionController(registry);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("Should list built-in task definitions for tenant")
    void testListTaskDefinitions() {
        ResponseEntity<List<TaskDefinitionRecord>> response = controller.listLatestTaskDefinitions();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        List<TaskDefinitionRecord> records = response.getBody();
        assertThat(records).isNotNull();
        assertThat(records).isNotEmpty();
        assertThat(records).anyMatch(r -> r.name().equals("validateOrder") && r.status() == WorkflowVersionStatus.ACTIVE);
    }

    @Test
    @DisplayName("Should create draft, list versions, publish to active, and reject invalid delete")
    void testDraftAndPublishFlow() {
        // 1. Create DRAFT v1
        TaskDefinitionController.SaveTaskDefRequest draftReq =
            new TaskDefinitionController.SaveTaskDefRequest(
                "customDataFilter",
                "Filters sensitive PII fields from JSON payload",
                3, 2, 2.0, 30,
                Map.of("type", "object", "properties", Map.of("data", Map.of("type", "string"))),
                Map.of("type", "object", "properties", Map.of("cleanData", Map.of("type", "string"))),
                "Initial DRAFT for data filter"
            );

        ResponseEntity<?> createRes = controller.createOrForkDraft(draftReq);
        assertThat(createRes.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        TaskDefinitionRecord draftRecord = (TaskDefinitionRecord) createRes.getBody();
        assertThat(draftRecord).isNotNull();
        assertThat(draftRecord.name()).isEqualTo("customDataFilter");
        assertThat(draftRecord.version()).isEqualTo(1);
        assertThat(draftRecord.status()).isEqualTo(WorkflowVersionStatus.DRAFT);

        // 2. List versions
        ResponseEntity<List<TaskDefinitionRecord>> listVersRes = controller.listTaskDefinitionVersions("customDataFilter");
        assertThat(listVersRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<TaskDefinitionRecord> versions = listVersRes.getBody();
        assertThat(versions).hasSize(1);

        // 3. Publish to ACTIVE
        ResponseEntity<?> pubRes = controller.publishVersion("customDataFilter", 1);
        assertThat(pubRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        TaskDefinitionRecord published = (TaskDefinitionRecord) pubRes.getBody();
        assertThat(published).isNotNull();
        assertThat(published.status()).isEqualTo(WorkflowVersionStatus.ACTIVE);

        // 4. Fork v2 draft
        TaskDefinitionController.SaveTaskDefRequest v2Req =
            new TaskDefinitionController.SaveTaskDefRequest(
                "customDataFilter",
                "Filters sensitive PII and PCI fields",
                3, 2, 2.0, 30,
                Map.of("type", "object"),
                Map.of("type", "object"),
                "Adding PCI redaction"
            );
        ResponseEntity<?> v2Res = controller.createOrForkDraft(v2Req);
        assertThat(v2Res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        TaskDefinitionRecord v2Draft = (TaskDefinitionRecord) v2Res.getBody();
        assertThat(v2Draft.version()).isEqualTo(2);
        assertThat(v2Draft.status()).isEqualTo(WorkflowVersionStatus.DRAFT);

        // 5. Delete v2 draft
        ResponseEntity<?> delRes = controller.deleteDraftVersion("customDataFilter", 2);
        assertThat(delRes.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // 6. Deleting published v1 should fail
        ResponseEntity<?> delActiveRes = controller.deleteDraftVersion("customDataFilter", 1);
        assertThat(delActiveRes.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
