package com.unipost.aio.worker;

import com.unipost.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.unipost.aio.controller.workflow.ExecutionStreamBroadcaster;
import com.unipost.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.unipost.workflow.application.WorkflowEngineService;
import com.unipost.workflow.core.decider.PureDecider;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;

class SystemTaskWorkerPoolTest {

    private InMemoryPersistenceAdapter persistencePort;
    private PureDecider decider;
    private WorkflowEngineService engineService;
    private WorkflowDefinitionRegistry registry;
    private ExecutionStreamBroadcaster broadcaster;
    private SystemTaskWorkerPool workerPool;

    @BeforeEach
    void setUp() {
        persistencePort = new InMemoryPersistenceAdapter();
        decider = new PureDecider();
        engineService = new WorkflowEngineService(persistencePort, decider);
        registry = new WorkflowDefinitionRegistry(persistencePort);
        broadcaster = new ExecutionStreamBroadcaster();
        workerPool = new SystemTaskWorkerPool(
            persistencePort,
            engineService,
            registry,
            broadcaster,
            java.net.http.HttpClient.newHttpClient(),
            createAsyncExecutor()
        );
    }

    private static java.util.concurrent.ExecutorService createAsyncExecutor() {
        try {
            var method = Executors.class.getMethod("newVirtualThreadPerTaskExecutor");
            return (java.util.concurrent.ExecutorService) method.invoke(null);
        } catch (Exception e) {
            return Executors.newCachedThreadPool();
        }
    }

    @Test
    @DisplayName("SystemTaskWorkerPool polls and executes LLM_CHAT_COMPLETE and HTTP tasks on virtual threads")
    void testSystemTasksExecution() throws InterruptedException {
        TaskDefinition llmNode = TaskDefinition.builder("summarize-note")
            .taskType(TaskType.LLM_CHAT_COMPLETE)
            .domain("system:llm")
            .inputParameters(Map.of("prompt", "Analyze system performance"))
            .build();

        TaskDefinition kafkaNode = TaskDefinition.builder("publish-event")
            .taskType(TaskType.KAFKA_PUBLISH)
            .domain("system:kafka")
            .inputParameters(Map.of("topic", "analytics.summary", "key", "SYS-1"))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("sys-pipeline-wf")
            .tasks(List.of(llmNode, kafkaNode))
            .build();

        registry.register("tenant-1", def);

        long now = System.currentTimeMillis();
        String executionId = "wf_exec_sys_1";
        WorkflowSnapshot initial = engineService.startWorkflow(
            executionId, "tenant-1", "ws-1", def, Map.of("test", true), now
        );

        assertThat(initial.status()).isEqualTo(WorkflowStatus.RUNNING);

        // Step 1: Poll and execute LLM task
        int polled = workerPool.pollAndExecuteBatch(System.currentTimeMillis());
        assertThat(polled).isGreaterThanOrEqualTo(1);

        // Allow virtual thread to finish
        Thread.sleep(250);

        WorkflowSnapshot afterLlm = persistencePort.getWorkflowSnapshot(executionId).orElseThrow();
        assertThat(afterLlm.tasksByRef()).containsKey("summarize-note");

        // Step 2: Poll and execute downstream Kafka task
        int polled2 = workerPool.pollAndExecuteBatch(System.currentTimeMillis() + 1000L);
        assertThat(polled2).isGreaterThanOrEqualTo(1);

        Thread.sleep(250);

        WorkflowSnapshot finalSnapshot = persistencePort.getWorkflowSnapshot(executionId).orElseThrow();
        assertThat(finalSnapshot.status()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(finalSnapshot.tasksByRef()).containsKey("publish-event");
    }
}
