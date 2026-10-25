package com.acc.service.workflow;

import com.acc.domain.metadata.EntityRecord;
import com.acc.domain.metadata.EntityStateChangedEvent;
import com.acc.domain.metadata.EntityType;
import com.acc.domain.metadata.LifecycleConfig;
import com.acc.domain.metadata.TransitionConfig;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.service.exception.MetadataConflictException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Core Finite State Machine (FSM) Lifecycle Service enforcing the 5-Gate Sequential Validation Engine.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EntityLifecycleService {

    private final GuardEvaluatorStrategy guardEvaluator;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Automatically initializes state on entity record creation if lifecycle configuration exists.
     */
    public void initializeStateOnCreation(EntityType type, Map<String, Object> attributes) {
        if (type == null || attributes == null) return;
        LifecycleConfig config = type.getLifecycleConfig();
        if (config == null) return;

        String stateField = config.stateFieldOrDefault();
        String initialState = config.initialStateOrDefault();

        if (!attributes.containsKey(stateField) || attributes.get(stateField) == null) {
            attributes.put(stateField, initialState);
            log.debug("Initialized default state '{}' for field '{}' in entityType '{}'",
                    initialState, stateField, type.getSystemName());
        }
    }

    /**
     * Evaluates the 5 sequential validation gates and executes a state transition.
     *
     * @param record            target entity record to transition
     * @param action            transition trigger action (e.g. "SUBMIT", "APPROVE", "REJECT")
     * @param updatedAttributes attributes map containing any field mutations to be persisted
     * @return the new state after successful transition
     */
    public String validateAndExecuteTransition(EntityRecord record,
                                               String action,
                                               Map<String, Object> updatedAttributes) {
        EntityType type = record.getEntityType();
        LifecycleConfig config = type != null ? type.getLifecycleConfig() : null;
        if (config == null) {
            log.debug("No lifecycle configuration defined for entityType '{}'", type != null ? type.getSystemName() : "null");
            return null;
        }

        String stateField = config.stateFieldOrDefault();
        String activeTenantId = TenantContextHolder.getTenantId();

        // Gate 1: Tenant Context & Isolation Gate
        if (record.getTenantId() != null && activeTenantId != null && !record.getTenantId().equals(activeTenantId)) {
            throw new MetadataConflictException("Cross-tenant FSM mutation forbidden (record tenant: "
                    + record.getTenantId() + ", active tenant: " + activeTenantId + ")");
        }

        String currentState = (record.getAttributes() != null && record.getAttributes().containsKey(stateField))
                ? String.valueOf(record.getAttributes().get(stateField))
                : config.initialStateOrDefault();

        // Gate 2: State Graph Transition Validity Gate
        List<TransitionConfig> transitions = config.transitions() != null ? config.transitions() : List.of();
        TransitionConfig transition = transitions.stream()
                .filter(t -> t.action() != null && t.action().equalsIgnoreCase(action.trim()))
                .filter(t -> "*".equals(t.from()) || (t.from() != null && t.from().equalsIgnoreCase(currentState)))
                .findFirst()
                .orElseThrow(() -> new MetadataConflictException(
                        "Invalid FSM transition action '" + action + "' for entity record #" + record.getId()
                                + " in current state '" + currentState + "'"));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // Gate 3: Role-Based Authority Gate
        if (transition.allowedRoles() != null && !transition.allowedRoles().isEmpty()) {
            boolean authorized = auth != null && auth.getAuthorities().stream()
                    .anyMatch(a -> transition.allowedRoles().contains(a.getAuthority()));
            if (!authorized) {
                throw new MetadataConflictException("Access Denied: Caller lacks required authority for FSM action '"
                        + action + "'. Allowed roles: " + transition.allowedRoles());
            }
        }

        // Gate 4: Required Attribute Presence Gate
        if (transition.requiredAttributes() != null) {
            for (String reqAttr : transition.requiredAttributes()) {
                Object val = updatedAttributes.get(reqAttr);
                boolean isMissing = (val == null)
                        || (val instanceof String s && s.isBlank())
                        || (val instanceof Collection<?> c && c.isEmpty());
                if (isMissing) {
                    throw new MetadataConflictException("Transition Gate Violation: Attribute '" + reqAttr
                            + "' is mandatory for action '" + action + "' to transition state to '" + transition.to() + "'");
                }
            }
        }

        // Gate 5: Dynamic Guard Expression Gate
        boolean guardPassed = guardEvaluator.evaluate(
                transition.guardExpression(),
                updatedAttributes,
                auth,
                activeTenantId,
                currentState,
                transition.to()
        );
        if (!guardPassed) {
            throw new MetadataConflictException("FSM Guard Gate Violation: Rule expression '"
                    + transition.guardExpression() + "' failed for action '" + action + "'");
        }

        // Execute State Mutation
        String targetState = transition.to();
        updatedAttributes.put(stateField, targetState);
        record.setAttributes(updatedAttributes);

        // Publish Spring Domain Event
        eventPublisher.publishEvent(new EntityStateChangedEvent(
                record.getTenantId(),
                type != null ? type.getId() : null,
                record.getId(),
                currentState,
                targetState,
                action,
                auth != null ? auth.getName() : "system",
                Map.copyOf(updatedAttributes),
                Instant.now()
        ));

        log.info("FSM State Transition Succeeded: Record #{} ({}) [{}] --({})--> [{}]",
                record.getId(), type != null ? type.getSystemName() : "unknown", currentState, action, targetState);

        return targetState;
    }
}
