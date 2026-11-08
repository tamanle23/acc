package com.acc.sandbox.seed;

import com.acc.sandbox.config.SandboxProperties;
import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.application.WorkflowDefinitionRegistry;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.event.ApplicationReadyEvent;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SandboxWorkflowSeederTest {

    @Test
    @DisplayName("Should skip seeding on ApplicationReadyEvent when in TEST mode")
    void testSkipInTestMode() {
        SandboxProperties properties = new SandboxProperties();
        properties.setEnabled(true);
        properties.setMode(SandboxProperties.SandboxMode.TEST);

        @SuppressWarnings("unchecked")
        ObjectProvider<WorkflowDefinitionRegistry> registryProvider = mock(ObjectProvider.class);

        SandboxWorkflowSeeder seeder = new SandboxWorkflowSeeder(properties, registryProvider);
        seeder.onApplicationEvent(mock(ApplicationReadyEvent.class));

        verifyNoInteractions(registryProvider);
    }

    @Test
    @DisplayName("Should seed order-fulfillment-pipeline and order-fulfillment-v1 for sandbox tenants")
    void testSeedWorkflowsInDevMode() {
        SandboxProperties properties = new SandboxProperties();
        properties.setEnabled(true);
        properties.setMode(SandboxProperties.SandboxMode.DEV);

        WorkflowDefinitionRegistry registry = new WorkflowDefinitionRegistry();

        @SuppressWarnings("unchecked")
        ObjectProvider<WorkflowDefinitionRegistry> registryProvider = mock(ObjectProvider.class);
        when(registryProvider.getIfAvailable()).thenReturn(registry);

        SandboxWorkflowSeeder seeder = new SandboxWorkflowSeeder(properties, registryProvider);
        seeder.seedSampleWorkflowsIfMissing();

        // 1. Verify tenant-acme definitions
        Optional<WorkflowDefinition> pipelineDefOpt = registry.get("tenant-acme", "order-fulfillment-pipeline");
        assertThat(pipelineDefOpt).isPresent();
        WorkflowDefinition pipelineDef = pipelineDefOpt.get();

        assertThat(pipelineDef.name()).isEqualTo("Order Fulfillment & Logistics Pipeline");
        assertThat(pipelineDef.inputSchema()).isNotNull();
        assertThat(pipelineDef.inputSchema().get("type")).isEqualTo("object");
        @SuppressWarnings("unchecked")
        List<String> inReq = (List<String>) pipelineDef.inputSchema().get("required");
        assertThat(inReq).containsExactly("orderId", "sku", "quantity", "amount", "customerEmail");

        assertThat(pipelineDef.outputSchema()).isNotNull();
        assertThat(pipelineDef.outputSchema().get("type")).isEqualTo("object");
        @SuppressWarnings("unchecked")
        List<String> outReq = (List<String>) pipelineDef.outputSchema().get("required");
        assertThat(outReq).containsExactly("fulfillmentStatus", "orderId", "reservationCode", "transactionId", "trackingNumber");

        // Canonical boundary nodes
        assertThat(pipelineDef.tasks().get(0).taskType()).isEqualTo(TaskType.START_WORKFLOW);
        assertThat(pipelineDef.tasks().get(pipelineDef.tasks().size() - 1).taskType()).isEqualTo(TaskType.END_WORKFLOW);

        // Layout metadata
        assertThat(pipelineDef.layoutMetadata()).isNotEmpty();
        @SuppressWarnings("unchecked")
        Map<String, Object> startCoords = (Map<String, Object>) pipelineDef.layoutMetadata().get("workflow_start");
        assertThat(startCoords).containsEntry("x", 60);

        // 2. Verify order-fulfillment-v1 multi-branch definition
        Optional<WorkflowDefinition> v1DefOpt = registry.get("tenant-acme", "order-fulfillment-v1");
        assertThat(v1DefOpt).isPresent();
        WorkflowDefinition v1Def = v1DefOpt.get();
        assertThat(v1Def.workflowKey()).isEqualTo("order-fulfillment-v1");
        assertThat(v1Def.inputSchema()).isNotNull();
        assertThat(v1Def.outputSchema()).isNotNull();
        assertThat(v1Def.tasks().stream().anyMatch(t -> t.taskType() == TaskType.SWITCH)).isTrue();

        // 3. Verify SYSTEM and default tenants also received the seeded definitions
        assertThat(registry.get("SYSTEM", "order-fulfillment-pipeline")).isPresent();
        assertThat(registry.get("default", "order-fulfillment-pipeline")).isPresent();
    }

    @Test
    @DisplayName("Should build valid standalone definitions adhering to strict Draft 7 schemas")
    void testBuildDefinitionsDirectly() {
        SandboxProperties properties = new SandboxProperties();
        @SuppressWarnings("unchecked")
        ObjectProvider<WorkflowDefinitionRegistry> registryProvider = mock(ObjectProvider.class);
        SandboxWorkflowSeeder seeder = new SandboxWorkflowSeeder(properties, registryProvider);

        WorkflowDefinition def = seeder.buildOrderFulfillmentPipeline();
        assertThat(def.workflowKey()).isEqualTo("order-fulfillment-pipeline");
        assertThat(def.inputSchema()).containsKey("$schema");
        assertThat(def.outputSchema()).containsKey("$schema");
        assertThat(def.tasks()).hasSize(6);

        // Verify task sequence
        TaskDefinition startTask = def.tasks().get(0);
        assertThat(startTask.taskReferenceName()).isEqualTo("workflow_start");
        assertThat(startTask.outputSchema()).isNotEmpty();

        TaskDefinition validateTask = def.tasks().get(1);
        assertThat(validateTask.taskReferenceName()).isEqualTo("validateOrder");
        assertThat(validateTask.inputSchema()).isNotEmpty();
        assertThat(validateTask.outputSchema()).isNotEmpty();

        TaskDefinition checkTask = def.tasks().get(2);
        assertThat(checkTask.taskReferenceName()).isEqualTo("checkInventory");
        assertThat(checkTask.inputSchema()).isNotEmpty();
        assertThat(checkTask.outputSchema()).isNotEmpty();

        TaskDefinition chargeTask = def.tasks().get(3);
        assertThat(chargeTask.taskReferenceName()).isEqualTo("chargePayment");
        assertThat(chargeTask.inputSchema()).isNotEmpty();
        assertThat(chargeTask.outputSchema()).isNotEmpty();

        TaskDefinition endTask = def.tasks().get(5);
        assertThat(endTask.taskReferenceName()).isEqualTo("workflow_end");
        assertThat(endTask.inputSchema()).isNotEmpty();
        assertThat(endTask.outputSchema()).isNotEmpty();
        assertThat(endTask.inputParameters()).containsKeys("fulfillmentStatus", "orderId", "trackingNumber");
    }

    @Test
    @DisplayName("Should rehydrate registry.list(tenantId) from persistence after JVM restart")
    void testRegistryListRehydrationAfterRestart() {
        SandboxProperties properties = new SandboxProperties();
        properties.setEnabled(true);
        properties.setMode(SandboxProperties.SandboxMode.DEV);

        InMemoryPersistenceAdapter sharedPersistence = new InMemoryPersistenceAdapter();

        // Boot 1: Initial seeding writes to persistence
        WorkflowDefinitionRegistry firstBootRegistry = new WorkflowDefinitionRegistry(sharedPersistence);
        @SuppressWarnings("unchecked")
        ObjectProvider<WorkflowDefinitionRegistry> firstProvider = mock(ObjectProvider.class);
        when(firstProvider.getIfAvailable()).thenReturn(firstBootRegistry);

        new SandboxWorkflowSeeder(properties, firstProvider).seedSampleWorkflowsIfMissing();
        assertThat(firstBootRegistry.list("tenant-acme")).hasSize(2);

        // Boot 2: Fresh JVM in-memory registry backed by existing durable storage
        WorkflowDefinitionRegistry restartedRegistry = new WorkflowDefinitionRegistry(sharedPersistence);
        @SuppressWarnings("unchecked")
        ObjectProvider<WorkflowDefinitionRegistry> secondProvider = mock(ObjectProvider.class);
        when(secondProvider.getIfAvailable()).thenReturn(restartedRegistry);

        // Even before or after seeder runs, list("tenant-acme") must return both persisted definitions
        new SandboxWorkflowSeeder(properties, secondProvider).seedSampleWorkflowsIfMissing();
        Map<String, WorkflowDefinition> catalog = restartedRegistry.list("tenant-acme");
        assertThat(catalog).containsKeys("order-fulfillment-pipeline", "order-fulfillment-v1");
    }
}
