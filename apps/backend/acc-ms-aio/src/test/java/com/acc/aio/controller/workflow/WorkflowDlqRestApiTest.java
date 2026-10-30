package com.acc.aio.controller.workflow;

import com.acc.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskDlqRecord;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.ports.PersistencePort;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowDlqRestApiTest {

    private PersistencePort persistencePort;
    private PureDecider pureDecider;
    private WorkflowEngineService engineService;
    private WorkflowDefinitionRegistry registry;
    private ExecutionStreamBroadcaster broadcaster;

    private WorkflowDlqController dlqController;
    private TaskWorkerController workerController;

    private static final String TENANT_ID = "tenant-dlq-test";

    @BeforeEach
    void setUp() {
        TenantContextHolder.setTenantId(TENANT_ID);
        persistencePort = new InMemoryPersistenceAdapter();
        pureDecider = new PureDecider();
        engineService = new WorkflowEngineService(persistencePort, pureDecider);
        registry = new WorkflowDefinitionRegistry();
        broadcaster = new ExecutionStreamBroadcaster();

        dlqController = new WorkflowDlqController(engineService, persistencePort);
        workerController = new TaskWorkerController(engineService, persistencePort, registry, broadcaster);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("Security: WorkflowDlqController must be secured with Sovereign Custodian authority and mapped to /api/v1/system/dlq")
    void testSecurityAnnotationAndMapping() {
        PreAuthorize preAuth = WorkflowDlqController.class.getAnnotation(PreAuthorize.class);
        assertThat(preAuth).isNotNull();
        assertThat(preAuth.value()).contains("ROLE_SYSTEM_CUSTODIAN");

        RequestMapping mapping = WorkflowDlqController.class.getAnnotation(RequestMapping.class);
        assertThat(mapping).isNotNull();
        assertThat(mapping.value()).contains("/api/v1/system/dlq", "/api/v1/workflow/dlq");
    }

    @Test
    @DisplayName("Phase 38: Should list, retrieve, and discard DLQ records via REST controller")
    void testDlqListAndQueryAndDiscard() {
        TaskDlqRecord record = new TaskDlqRecord(
            "dlq-rec-1", "task-abc-att1", "wf-dlq-1", TENANT_ID, "default",
            "HTTP", "default", "404 Not Found from downstream API",
            "HttpClientErrorException: 404", Map.of("path", "/users/999"),
            3, 1000L, null, "ISOLATED"
        );
        persistencePort.quarantineTaskToDlq(record);

        // 1. List DLQ tasks with explicit tenant filter
        ResponseEntity<List<TaskDlqRecord>> listResp = dlqController.listDlqTasks("ISOLATED", TENANT_ID, 10);
        assertThat(listResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listResp.getBody()).hasSize(1);
        assertThat(listResp.getBody().get(0).dlqId()).isEqualTo("dlq-rec-1");

        // 2. Sovereign Fleet-wide query (without tenant filter)
        ResponseEntity<List<TaskDlqRecord>> fleetResp = dlqController.listDlqTasks(null, null, 10);
        assertThat(fleetResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(fleetResp.getBody()).hasSize(1);

        // 3. Get DLQ task by ID
        ResponseEntity<TaskDlqRecord> getResp = dlqController.getDlqTask("dlq-rec-1");
        assertThat(getResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(getResp.getBody()).isNotNull();
        assertThat(getResp.getBody().errorMessage()).contains("404 Not Found");

        // 4. Discard DLQ task
        ResponseEntity<Void> discardResp = dlqController.discardDlqTask("dlq-rec-1");
        assertThat(discardResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        TaskDlqRecord discarded = persistencePort.getDlqTask("dlq-rec-1").orElseThrow();
        assertThat(discarded.status()).isEqualTo("DISCARDED");
    }

    @Test
    @DisplayName("Phase 38: End-to-end task failure isolation to DLQ and in-place replay with payload overrides")
    void testDlqEndToEndIsolationAndReplay() {
        WorkflowDefinition def = WorkflowDefinition.builder("dlq-pipeline")
            .name("DLQ Pipeline")
            .version(1)
            .tasks(List.of(
                TaskDefinition.builder("flaky-step")
                    .taskType(com.acc.workflow.core.model.TaskType.SIMPLE)
                    .retryCount(1)
                    .build()
            ))
            .build();
        registry.register(TENANT_ID, def);

        long now = 1000L;
        engineService.startWorkflow("wf-fail-1", TENANT_ID, "default", def, Map.of("param", "init"), now);

        // 1. Worker polls and claims task
        ResponseEntity<List<TaskSnapshot>> pollResp = workerController.pollTasks("SIMPLE", "default", "worker-1", 1);
        assertThat(pollResp.getBody()).hasSize(1);
        String taskId = pollResp.getBody().get(0).taskId();

        // 2. Worker reports failure exceeding retry limit -> isolated to DLQ
        TaskWorkerController.TaskResultRequest failReq = new TaskWorkerController.TaskResultRequest(
            false, Collections.emptyMap(), "Fatal JVM Crash", 0
        );
        workerController.reportResult(taskId, failReq);

        // Assert workflow is FAILED or COMPENSATED_FAILED
        WorkflowSnapshot wfSnap = persistencePort.getWorkflowSnapshot("wf-fail-1").orElseThrow();
        assertThat(wfSnap.status()).isIn(WorkflowStatus.FAILED, WorkflowStatus.COMPENSATED_FAILED);

        // Assert task is quarantined into DLQ
        ResponseEntity<List<TaskDlqRecord>> dlqListResp = dlqController.listDlqTasks(null, TENANT_ID, 10);
        assertThat(dlqListResp.getBody()).hasSize(1);
        String dlqId = dlqListResp.getBody().get(0).dlqId();

        // 3. Operator triggers replay with payload override
        ResponseEntity<TaskDlqRecord> replayResp = dlqController.replayDlqTask(dlqId, Map.of("fixedParam", "validValue"));
        assertThat(replayResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(replayResp.getBody()).isNotNull();
        assertThat(replayResp.getBody().status()).isEqualTo("REPLAYED");

        // 4. Assert parent workflow is resumed to RUNNING
        WorkflowSnapshot resumedWf = persistencePort.getWorkflowSnapshot("wf-fail-1").orElseThrow();
        assertThat(resumedWf.status()).isEqualTo(WorkflowStatus.RUNNING);

        // 5. Worker polls again and successfully picks up the re-enqueued task with overridden input
        ResponseEntity<List<TaskSnapshot>> rePollResp = workerController.pollTasks("SIMPLE", "default", "worker-2", 1);
        assertThat(rePollResp.getBody()).hasSize(1);
        TaskSnapshot rePolled = rePollResp.getBody().get(0);
        assertThat(rePolled.attempt()).isEqualTo(1);
        assertThat(rePolled.inputData()).containsEntry("fixedParam", "validValue");
    }
}
