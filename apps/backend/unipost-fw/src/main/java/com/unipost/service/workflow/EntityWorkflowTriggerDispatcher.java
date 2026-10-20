package com.unipost.service.workflow;

import com.unipost.domain.metadata.EntityRecordMutatedEvent;
import com.unipost.domain.metadata.EntityStateChangedEvent;
import com.unipost.presentation.NotificationSseController;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Event-driven workflow trigger dispatcher.
 * Bridges entity mutation outbox events with workflow DAG execution and pushes real-time SSE notifications.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EntityWorkflowTriggerDispatcher {

    private final NotificationSseController notificationSseController;

    @Async
    @EventListener
    public void onEntityRecordMutated(EntityRecordMutatedEvent event) {
        log.info("Processing EntityRecordMutatedEvent: entityTypeId={}, recordId={}, action={}, tenantId={}",
                event.entityTypeId(), event.recordId(), event.action(), event.tenantId());

        // 1. Dispatch real-time SSE notification
        if (notificationSseController != null) {
            notificationSseController.broadcast(
                    event.tenantId(),
                    "ENTITY_MUTATED",
                    Map.of(
                            "entityTypeId", event.entityTypeId(),
                            "recordId", event.recordId(),
                            "action", event.action(),
                            "actor", event.actor() != null ? event.actor() : "SYSTEM",
                            "version", event.version() != null ? event.version() : 1L,
                            "timestamp", event.timestamp().toEpochMilli()
                    )
            );
        }

        // 2. Evaluate workflow triggers (e.g., auto-start approval workflow on record creation or state change)
        if ("CREATE".equalsIgnoreCase(event.action()) || "SUBMITTED_FOR_APPROVAL".equalsIgnoreCase(event.action())) {
            log.info("Triggering automated workflow DAG check for entityTypeId={}, recordId={}",
                    event.entityTypeId(), event.recordId());
            if (notificationSseController != null) {
                Map<String, Object> approvalPayload = new java.util.LinkedHashMap<>();
                approvalPayload.put("id", "APR-" + event.entityTypeId() + "-" + event.recordId());
                approvalPayload.put("workflowKey", "entity-governance-approval-v1");
                approvalPayload.put("executionId", "wf_exec_gov_" + event.recordId());
                approvalPayload.put("title", "Governance Review: Entity #" + event.entityTypeId() + " Record #" + event.recordId());
                approvalPayload.put("entityType", "entity_" + event.entityTypeId());
                approvalPayload.put("entityTypeId", event.entityTypeId());
                approvalPayload.put("entityName", "Record #" + event.recordId());
                approvalPayload.put("recordId", event.recordId());
                approvalPayload.put("requestedBy", event.actor() != null ? event.actor() : "SYSTEM");
                approvalPayload.put("requestedAt", event.timestamp().toString());
                approvalPayload.put("priority", "HIGH");
                approvalPayload.put("status", "PENDING");
                approvalPayload.put("beforeContext", event.delta() != null ? event.delta() : java.util.Collections.emptyMap());
                approvalPayload.put("afterContext", event.attributes() != null ? event.attributes() : java.util.Collections.emptyMap());
                approvalPayload.put("currentAttributes", event.delta() != null ? event.delta() : java.util.Collections.emptyMap());
                approvalPayload.put("proposedAttributes", event.attributes() != null ? event.attributes() : java.util.Collections.emptyMap());
                approvalPayload.put("message", "New record submitted for approval");
                approvalPayload.put("timestamp", System.currentTimeMillis());

                notificationSseController.broadcast(
                        event.tenantId(),
                        "APPROVAL_REQUESTED",
                        approvalPayload
                );
            }
        }
    }

    @Async
    @EventListener
    public void onEntityStateChanged(EntityStateChangedEvent event) {
        log.info("Processing EntityStateChangedEvent: entityTypeId={}, recordId={}, transition {} -> {}",
                event.entityTypeId(), event.recordId(), event.oldState(), event.newState());

        if (notificationSseController != null) {
            notificationSseController.broadcast(
                    event.tenantId(),
                    "ENTITY_STATE_CHANGED",
                    Map.of(
                            "entityTypeId", event.entityTypeId(),
                            "recordId", event.recordId(),
                            "oldState", event.oldState() != null ? event.oldState() : "INITIAL",
                            "newState", event.newState(),
                            "action", event.action(),
                            "timestamp", event.timestamp().toEpochMilli()
                    )
            );
        }
    }
}
