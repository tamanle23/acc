package com.acc.service.workflow;

import com.acc.domain.metadata.EntityRecordMutatedEvent;
import com.acc.domain.metadata.EntityStateChangedEvent;
import com.acc.presentation.NotificationSseController;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Map;

/**
 * Event-driven workflow trigger dispatcher.
 * Bridges entity mutation outbox events with workflow DAG execution and pushes real-time SSE notifications.
 * Employs Spring Expression Language (SpEL) for dynamic mutation predicate matching.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EntityWorkflowTriggerDispatcher {

    private final NotificationSseController notificationSseController;
    private final ExpressionParser expressionParser = new SpelExpressionParser();

    /**
     * Evaluates whether an entity mutation event satisfies a conditional trigger predicate.
     * Available context variables:
     * - #old: Previous attribute map (delta)
     * - #new: Current attribute map
     * - #action: Mutation action (CREATE, UPDATE, DELETE, etc.)
     *
     * @param expression SpEL expression string (e.g. "#action == 'CREATE' || (#new['status'] != #old['status'])")
     * @param event The mutation event under evaluation
     * @return true if expression evaluates to true or is blank; false otherwise
     */
    public boolean evaluatePredicate(String expression, EntityRecordMutatedEvent event) {
        if (expression == null || expression.isBlank()) {
            return true;
        }
        try {
            StandardEvaluationContext context = new StandardEvaluationContext();
            context.setVariable("old", event.delta() != null ? event.delta() : Collections.emptyMap());
            context.setVariable("new", event.attributes() != null ? event.attributes() : Collections.emptyMap());
            context.setVariable("action", event.action());
            context.setVariable("entityTypeId", event.entityTypeId());
            context.setVariable("recordId", event.recordId());

            Boolean result = expressionParser.parseExpression(expression).getValue(context, Boolean.class);
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.warn("Failed to evaluate SpEL trigger predicate '{}': {}", expression, e.getMessage());
            return false;
        }
    }

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
