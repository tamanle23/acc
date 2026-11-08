package com.acc.sandbox.seed;

import com.acc.sandbox.config.SandboxProperties;
import com.acc.workflow.application.WorkflowDefinitionRegistry;
import com.acc.workflow.core.graph.AcyclicityGuard;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Pre-warms and seeds complete, end-to-end runnable sample workflow definitions
 * in DEV sandbox mode so developers and automated tests can trigger and verify
 * the full end-to-end workflow execution lifecycle out of the box.
 */
@Component
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class SandboxWorkflowSeeder implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(SandboxWorkflowSeeder.class);

    private static final List<String> TARGET_TENANTS = List.of("tenant-acme", "SYSTEM", "default");

    private final SandboxProperties properties;
    private final ObjectProvider<WorkflowDefinitionRegistry> registryProvider;
    private final AcyclicityGuard acyclicityGuard = new AcyclicityGuard();

    public SandboxWorkflowSeeder(
        SandboxProperties properties,
        ObjectProvider<WorkflowDefinitionRegistry> registryProvider
    ) {
        this.properties = properties;
        this.registryProvider = registryProvider;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (properties.getMode() != SandboxProperties.SandboxMode.DEV) {
            log.info("[SANDBOX-SEED] Test mode active (mode={}); skipping workflow definition auto-seeding.", properties.getMode());
            return;
        }
        seedSampleWorkflowsIfMissing();
    }

    /**
     * Seeds full sample workflow definitions for demonstration tenants if not already registered.
     */
    public void seedSampleWorkflowsIfMissing() {
        WorkflowDefinitionRegistry registry = registryProvider.getIfAvailable();
        if (registry == null) {
            log.info("[SANDBOX-SEED] WorkflowDefinitionRegistry bean not present; skipping workflow seeding.");
            return;
        }

        for (String tenantId : TARGET_TENANTS) {
            try {
                seedOrderFulfillmentPipeline(registry, tenantId);
                seedMultiBranchOrderWorkflow(registry, tenantId);
            } catch (Exception e) {
                log.warn("[SANDBOX-SEED] Failed seeding sample workflows for tenant '{}': {}", tenantId, e.getMessage(), e);
            }
        }
    }

    /**
     * 1. Linear End-to-End Pipeline: Order Fulfillment Pipeline
     * Execution flow: START -> validateOrder -> checkInventory -> chargePayment -> expressCourier -> END
     * Uses built-in virtual thread workers in SimpleTaskWorkerRegistrar.
     */
    public WorkflowDefinition buildOrderFulfillmentPipeline() {
        Map<String, Object> inputSchema = Map.of(
            "$schema", "http://json-schema.org/draft-07/schema#",
            "type", "object",
            "required", List.of("orderId", "sku", "quantity", "amount", "customerEmail"),
            "properties", Map.of(
                "orderId", Map.of("type", "string", "description", "Target order identifier"),
                "sku", Map.of("type", "string", "description", "Stock Keeping Unit code"),
                "quantity", Map.of("type", "integer", "description", "Requested item count"),
                "amount", Map.of("type", "number", "description", "Total order monetary amount"),
                "customerEmail", Map.of("type", "string", "description", "Customer notification email")
            ),
            "additionalProperties", false
        );

        Map<String, Object> outputSchema = Map.of(
            "$schema", "http://json-schema.org/draft-07/schema#",
            "type", "object",
            "required", List.of("fulfillmentStatus", "orderId", "reservationCode", "transactionId", "trackingNumber"),
            "properties", Map.of(
                "fulfillmentStatus", Map.of("type", "string", "description", "Terminal fulfillment status"),
                "orderId", Map.of("type", "string", "description", "Order identifier"),
                "reservationCode", Map.of("type", "string", "description", "Warehouse reservation reference code"),
                "transactionId", Map.of("type", "string", "description", "Settled transaction identifier"),
                "trackingNumber", Map.of("type", "string", "description", "Air courier tracking number")
            ),
            "additionalProperties", false
        );

        List<TaskDefinition> tasks = List.of(
            TaskDefinition.builder("workflow_start")
                .taskType(TaskType.START_WORKFLOW)
                .build(),

            TaskDefinition.builder("validateOrder")
                .taskType(TaskType.SIMPLE)
                .domain("default")
                .inputParameters(Map.of(
                    "orderId", "${workflow.input.orderId}"
                ))
                .build(),

            TaskDefinition.builder("checkInventory")
                .taskType(TaskType.SIMPLE)
                .domain("default")
                .inputParameters(Map.of(
                    "orderId", "${workflow.input.orderId}",
                    "sku", "${workflow.input.sku}",
                    "quantity", "${workflow.input.quantity}"
                ))
                .compensateHandlerRef("cancelInventoryReservation")
                .build(),

            TaskDefinition.builder("chargePayment")
                .taskType(TaskType.SIMPLE)
                .domain("default")
                .inputParameters(Map.of(
                    "orderId", "${workflow.input.orderId}",
                    "amount", "${workflow.input.amount}"
                ))
                .build(),

            TaskDefinition.builder("expressCourier")
                .taskType(TaskType.SIMPLE)
                .domain("default")
                .inputParameters(Map.of(
                    "orderId", "${workflow.input.orderId}"
                ))
                .compensateHandlerRef("cancelCourierBooking")
                .build(),

            TaskDefinition.builder("workflow_end")
                .taskType(TaskType.END_WORKFLOW)
                .inputParameters(Map.of(
                    "fulfillmentStatus", "COMPLETED",
                    "orderId", "${workflow.input.orderId}",
                    "reservationCode", "${checkInventory.output.reservationCode}",
                    "transactionId", "${chargePayment.output.transactionId}",
                    "trackingNumber", "${expressCourier.output.trackingNumber}"
                ))
                .outputSchema(outputSchema)
                .build()
        );

        Map<String, Object> layoutMetadata = Map.of(
            "workflow_start", Map.of("x", 60, "y", 200),
            "validateOrder", Map.of("x", 260, "y", 200),
            "checkInventory", Map.of("x", 480, "y", 200),
            "chargePayment", Map.of("x", 700, "y", 200),
            "expressCourier", Map.of("x", 920, "y", 200),
            "workflow_end", Map.of("x", 1140, "y", 200)
        );

        return WorkflowDefinition.builder("order-fulfillment-pipeline")
            .name("Order Fulfillment & Logistics Pipeline")
            .description("Production demonstration: validates order compliance, checks inventory allocation, captures payment settlement, and books courier air freight.")
            .version(1)
            .timeoutSeconds(3600)
            .inputSchema(inputSchema)
            .outputSchema(outputSchema)
            .tasks(tasks)
            .layoutMetadata(layoutMetadata)
            .build();
    }

    /**
     * 2. Multi-Branch DAG: Order Fulfillment Routing Pipeline
     * Uses SWITCH to route dynamically based on delivery speed (EXPRESS vs STANDARD).
     */
    public WorkflowDefinition buildMultiBranchOrderWorkflow() {
        Map<String, Object> inputSchema = Map.of(
            "$schema", "http://json-schema.org/draft-07/schema#",
            "type", "object",
            "required", List.of("orderId", "sku", "quantity", "speed"),
            "properties", Map.of(
                "orderId", Map.of("type", "string", "description", "Target order identifier"),
                "sku", Map.of("type", "string", "description", "Stock Keeping Unit code"),
                "quantity", Map.of("type", "integer", "description", "Requested item count"),
                "speed", Map.of("type", "string", "description", "Delivery velocity tier (EXPRESS or STANDARD)"),
                "postalCode", Map.of("type", "string", "description", "Destination postal code")
            ),
            "additionalProperties", false
        );

        Map<String, Object> outputSchema = Map.of(
            "$schema", "http://json-schema.org/draft-07/schema#",
            "type", "object",
            "required", List.of("fulfillmentStatus", "orderId", "warehouseId"),
            "properties", Map.of(
                "fulfillmentStatus", Map.of("type", "string"),
                "orderId", Map.of("type", "string"),
                "warehouseId", Map.of("type", "string"),
                "carrier", Map.of("type", "string"),
                "trackingNumber", Map.of("type", "string")
            ),
            "additionalProperties", false
        );

        TaskDefinition expressBranchTask = TaskDefinition.builder("expressCourier")
            .taskType(TaskType.SIMPLE)
            .domain("default")
            .inputParameters(Map.of("orderId", "${workflow.input.orderId}"))
            .compensateHandlerRef("cancelCourierBooking")
            .build();

        TaskDefinition groundBranchTask = TaskDefinition.builder("groundPostal")
            .taskType(TaskType.SIMPLE)
            .domain("default")
            .inputParameters(Map.of("orderId", "${workflow.input.orderId}"))
            .build();

        List<TaskDefinition> tasks = List.of(
            TaskDefinition.builder("workflow_start")
                .taskType(TaskType.START_WORKFLOW)
                .build(),

            TaskDefinition.builder("checkInventory")
                .taskType(TaskType.SIMPLE)
                .domain("default")
                .inputParameters(Map.of(
                    "orderId", "${workflow.input.orderId}",
                    "sku", "${workflow.input.sku}",
                    "quantity", "${workflow.input.quantity}"
                ))
                .compensateHandlerRef("cancelInventoryReservation")
                .build(),

            TaskDefinition.builder("routeShipping")
                .taskType(TaskType.SWITCH)
                .inputParameters(Map.of(
                    "caseExpression", "${workflow.input.speed}"
                ))
                .decisionCases(Map.of(
                    "EXPRESS", List.of(expressBranchTask),
                    "STANDARD", List.of(groundBranchTask)
                ))
                .defaultCase(List.of(groundBranchTask))
                .build(),

            TaskDefinition.builder("workflow_end")
                .taskType(TaskType.END_WORKFLOW)
                .inputParameters(Map.of(
                    "fulfillmentStatus", "COMPLETED",
                    "orderId", "${workflow.input.orderId}",
                    "warehouseId", "${checkInventory.output.warehouseId}",
                    "carrier", "${expressCourier.output.carrier}",
                    "trackingNumber", "${expressCourier.output.trackingNumber}"
                ))
                .outputSchema(outputSchema)
                .build()
        );

        Map<String, Object> layoutMetadata = Map.of(
            "workflow_start", Map.of("x", 80, "y", 180),
            "checkInventory", Map.of("x", 320, "y", 180),
            "routeShipping", Map.of("x", 580, "y", 180),
            "workflow_end", Map.of("x", 900, "y", 180)
        );

        return WorkflowDefinition.builder("order-fulfillment-v1")
            .name("Order Fulfillment Multi-Branch Pipeline")
            .description("Multi-branch logistics router: checks stock allocation and routes to air express or ground delivery.")
            .version(1)
            .timeoutSeconds(3600)
            .inputSchema(inputSchema)
            .outputSchema(outputSchema)
            .tasks(tasks)
            .layoutMetadata(layoutMetadata)
            .build();
    }

    private void seedOrderFulfillmentPipeline(WorkflowDefinitionRegistry registry, String tenantId) {
        if (registry.get(tenantId, "order-fulfillment-pipeline").isEmpty()) {
            WorkflowDefinition def = buildOrderFulfillmentPipeline();
            acyclicityGuard.validateAndSort(def);
            registry.register(tenantId, def);
            log.info("[SANDBOX-SEED] Pre-warmed WorkflowDefinition '{}' (v{}) for tenant '{}'", def.workflowKey(), def.version(), tenantId);
        }
    }

    private void seedMultiBranchOrderWorkflow(WorkflowDefinitionRegistry registry, String tenantId) {
        if (registry.get(tenantId, "order-fulfillment-v1").isEmpty()) {
            WorkflowDefinition def = buildMultiBranchOrderWorkflow();
            acyclicityGuard.validateAndSort(def);
            registry.register(tenantId, def);
            log.info("[SANDBOX-SEED] Pre-warmed WorkflowDefinition '{}' (v{}) for tenant '{}'", def.workflowKey(), def.version(), tenantId);
        }
    }
}
