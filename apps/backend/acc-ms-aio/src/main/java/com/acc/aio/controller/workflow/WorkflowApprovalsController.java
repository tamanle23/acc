package com.acc.aio.controller.workflow;

import com.acc.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.ports.PersistencePort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/workflow/approvals")
public class WorkflowApprovalsController {

    private final WorkflowEngineService engineService;
    private final PersistencePort persistencePort;
    private final WorkflowDefinitionRegistry registry;
    private final ExecutionStreamBroadcaster broadcaster;
    private final Map<String, ApprovalTaskDto> approvalStore = new ConcurrentHashMap<>();

    public record ApprovalTaskDto(
        String id,
        String workflowId,
        String workflowName,
        long entityTypeId,
        String entityTypeName,
        long recordId,
        String stepName,
        String requestedBy,
        String requestedAt,
        String status,
        String rationale,
        Map<String, Object> currentAttributes,
        Map<String, Object> proposedAttributes,
        String tenantId,
        String executionId,
        String taskReferenceName
    ) {}

    public record ResolveApprovalRequest(
        String action,
        String rationale,
        String approver
    ) {}

    public WorkflowApprovalsController(
        WorkflowEngineService engineService,
        PersistencePort persistencePort,
        WorkflowDefinitionRegistry registry,
        ExecutionStreamBroadcaster broadcaster
    ) {
        this.engineService = engineService;
        this.persistencePort = persistencePort;
        this.registry = registry;
        this.broadcaster = broadcaster;
        seedInitialApprovalTasks();
    }

    private void seedInitialApprovalTasks() {
        String nowIso = Instant.now().toString();
        approvalStore.put("appr-101", new ApprovalTaskDto(
            "appr-101",
            "wf-vendor-onboarding",
            "Vendor Compliance & Security Review",
            1L,
            "Vendor Profile",
            4021L,
            "Security Tier Authorization",
            "operator-alice@acc.io",
            nowIso,
            "PENDING",
            null,
            Map.of(
                "companyName", "Acme Logistics Ltd",
                "tier", "STANDARD",
                "creditLimit", 50000,
                "complianceStatus", "PENDING_REVIEW"
            ),
            Map.of(
                "companyName", "Acme Logistics Ltd",
                "tier", "ENTERPRISE",
                "creditLimit", 250000,
                "complianceStatus", "APPROVED_TIER_1"
            ),
            "system",
            null,
            "securityTierApproval"
        ));
        approvalStore.put("appr-102", new ApprovalTaskDto(
            "appr-102",
            "wf-rate-card-publish",
            "Carrier Zone Rate Schedule Mutation",
            3L,
            "Zone Tariff",
            8812L,
            "Finance Controller Sign-Off",
            "tariffs-bot@acc.io",
            nowIso,
            "PENDING",
            null,
            Map.of(
                "zone", "APAC-EAST",
                "baseRatePerKg", 4.5,
                "fuelSurchargePercent", 12.0,
                "currency", "USD"
            ),
            Map.of(
                "zone", "APAC-EAST",
                "baseRatePerKg", 4.85,
                "fuelSurchargePercent", 13.5,
                "currency", "USD"
            ),
            "system",
            null,
            "financeSignOff"
        ));
    }

    public void registerEngineApprovalTask(WorkflowSnapshot snapshot, WorkflowDefinition def) {
        if (snapshot == null || snapshot.tasksByRef() == null) return;
        for (TaskSnapshot t : snapshot.tasksByRef().values()) {
            if (t.taskType() == TaskType.HUMAN && t.status() == TaskStatus.WAITING_FOR_APPROVAL) {
                String taskId = t.taskId();
                Map<String, Object> input = t.inputData() != null ? t.inputData() : Collections.emptyMap();
                @SuppressWarnings("unchecked")
                Map<String, Object> currentAttrs = input.get("currentAttributes") instanceof Map<?, ?> m
                    ? (Map<String, Object>) m
                    : Map.of("workflowInput", snapshot.inputPayload());
                @SuppressWarnings("unchecked")
                Map<String, Object> proposedAttrs = input.get("proposedAttributes") instanceof Map<?, ?> m
                    ? (Map<String, Object>) m
                    : input;

                long ts = t.visibleAtEpochMs() > 0 ? t.visibleAtEpochMs() : System.currentTimeMillis();
                approvalStore.put(taskId, new ApprovalTaskDto(
                    taskId,
                    snapshot.workflowKey(),
                    def != null && def.name() != null ? def.name() : snapshot.workflowKey(),
                    1L,
                    "Workflow Human Approval",
                    Math.abs((long) snapshot.workflowId().hashCode() % 10000L),
                    t.taskReferenceName(),
                    "workflow-engine@acc.io",
                    Instant.ofEpochMilli(ts).toString(),
                    "PENDING",
                    null,
                    currentAttrs,
                    proposedAttrs,
                    snapshot.tenantId(),
                    snapshot.workflowId(),
                    t.taskReferenceName()
                ));
            }
        }
    }

    @GetMapping
    public ResponseEntity<List<ApprovalTaskDto>> listApprovals(
        @RequestParam(value = "status", required = false) String statusFilter,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        List<ApprovalTaskDto> result = new ArrayList<>();
        for (ApprovalTaskDto task : approvalStore.values()) {
            boolean tenantMatch = "system".equalsIgnoreCase(tenantId)
                || "SYSTEM".equalsIgnoreCase(tenantId)
                || task.tenantId() == null
                || "system".equalsIgnoreCase(task.tenantId())
                || tenantId.equalsIgnoreCase(task.tenantId());
            boolean statusMatch = statusFilter == null || statusFilter.isBlank() || statusFilter.equalsIgnoreCase(task.status());
            if (tenantMatch && statusMatch) {
                result.add(task);
            }
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolveApproval(
        @PathVariable("id") String id,
        @RequestBody ResolveApprovalRequest req,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        if (req == null || req.action() == null || req.action().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "action is required"));
        }

        String normalizedAction = req.action().toUpperCase();
        if ("APPROVE".equals(normalizedAction)) normalizedAction = "APPROVED";
        if ("REJECT".equals(normalizedAction)) normalizedAction = "REJECTED";

        String tenantId = resolveTenantId(headerTenantId);
        long now = System.currentTimeMillis();

        ApprovalTaskDto existing = approvalStore.get(id);
        if (existing != null) {
            ApprovalTaskDto updated = new ApprovalTaskDto(
                existing.id(),
                existing.workflowId(),
                existing.workflowName(),
                existing.entityTypeId(),
                existing.entityTypeName(),
                existing.recordId(),
                existing.stepName(),
                existing.requestedBy(),
                existing.requestedAt(),
                normalizedAction,
                req.rationale(),
                existing.currentAttributes(),
                existing.proposedAttributes(),
                existing.tenantId(),
                existing.executionId(),
                existing.taskReferenceName()
            );
            approvalStore.put(id, updated);

            if (existing.executionId() != null && existing.taskReferenceName() != null) {
                WorkflowSnapshot snap = persistencePort.getWorkflowSnapshot(existing.executionId()).orElse(null);
                if (snap != null) {
                    WorkflowDefinition def = registry.get(tenantId, snap.workflowKey()).orElse(null);
                    if (def != null) {
                        boolean approved = "APPROVED".equals(normalizedAction);
                        Map<String, Object> decisionOut = new LinkedHashMap<>();
                        decisionOut.put("action", normalizedAction);
                        if (req.rationale() != null) decisionOut.put("rationale", req.rationale());
                        if (req.approver() != null) decisionOut.put("approver", req.approver());
                        WorkflowSnapshot resumed = engineService.resolveHumanApprovalTask(
                            existing.executionId(),
                            existing.taskReferenceName(),
                            approved,
                            req.approver() != null ? req.approver() : "custodian@acc.io",
                            req.rationale(),
                            def,
                            now
                        ).orElse(snap);
                        broadcaster.broadcast(existing.executionId(), "APPROVAL_RESOLVED", Map.of(
                            "workflowId", existing.executionId(),
                            "taskReferenceName", existing.taskReferenceName(),
                            "action", normalizedAction,
                            "status", resumed.status().name(),
                            "timestamp", now
                        ));
                    }
                }
            }

            return ResponseEntity.ok(updated);
        }

        // Fallback: check if id is a direct taskId in an active workflow execution
        int idx = id.lastIndexOf('_');
        if (idx > 0) {
            String candidateWfId = id.substring(0, idx);
            String candidateRef = id.substring(idx + 1);
            WorkflowSnapshot snap = persistencePort.getWorkflowSnapshot(candidateWfId).orElse(null);
            if (snap != null) {
                WorkflowDefinition def = registry.get(tenantId, snap.workflowKey()).orElse(null);
                if (def != null) {
                    boolean approved = "APPROVED".equals(normalizedAction);
                    Map<String, Object> decisionOut = new LinkedHashMap<>();
                    decisionOut.put("action", normalizedAction);
                    if (req.rationale() != null) decisionOut.put("rationale", req.rationale());
                    engineService.resolveHumanApprovalTask(
                        candidateWfId,
                        candidateRef,
                        approved,
                        req.approver() != null ? req.approver() : "custodian@acc.io",
                        req.rationale(),
                        def,
                        now
                    );
                    ApprovalTaskDto synthesized = new ApprovalTaskDto(
                        id, snap.workflowKey(), def.name(), 1L, "Workflow Human Approval", 1L,
                        candidateRef, "workflow-engine@acc.io", Instant.ofEpochMilli(now).toString(),
                        normalizedAction, req.rationale(), Map.of(), decisionOut, snap.tenantId(),
                        candidateWfId, candidateRef
                    );
                    approvalStore.put(id, synthesized);
                    return ResponseEntity.ok(synthesized);
                }
            }
        }

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
            "error", "Approval task not found",
            "id", id
        ));
    }

    private String resolveTenantId(String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) return headerTenantId;
        String ctx = TenantContextHolder.getTenantId();
        return (ctx != null && !ctx.isBlank()) ? ctx : "system";
    }
}
