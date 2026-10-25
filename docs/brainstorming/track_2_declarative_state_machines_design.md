# Track 2: Declarative State Machines & Operational Workflows
## Enterprise Architectural Blueprint & Backend Implementation Guide

**Target Backend System:** `@acc/backend` (`apps/backend/acc-fw`, Java 21 / Spring Boot 3.3 / Spring Modulith)
**Target Domain:** Enterprise Multi-Tenant Dynamic Data Fabric & Low-Code Workflow Engine
**Referenced Context:** `docs/brainstorming/unlocking_full_potential_of_dynamic_metadata.md` (Section 3)
**Authoritative Architectural Specification Version:** 2.0-ENTERPRISE

---

## 1. Design Strategy

### 1.1 Executive Vision & Problem Statement
In enterprise application architectures, dynamic data records stored in PostgreSQL JSONB (`UNIPOST_ENTITIES`) are far more than passive payload buckets. Records such as `JobOrder`, `ReturnTicket`, `DeploymentPolicy`, `PurchaseRequisition`, and `KYCComplianceVerification` represent **stateful domain entities with distinct operational lifecycles**.

Without a centralized, metadata-driven Finite State Machine (FSM) engine, enterprise systems suffer from severe architectural anti-patterns:
- **State Sprawl & Distributed IF-ELSE Logic**: Workflow state checks are scattered across web controllers, frontend UI components, and batch background processors, making auditing and modification error-prone.
- **Illegal State Transitions**: Users or external integrations bypass approval steps (e.g. jumping directly from `DRAFT` to `PUBLISHED` without required review sign-offs).
- **Missing Permission & Attribute Gates**: Operations are permitted when mandatory supporting attributes (e.g., `approver_id`, `reject_reason`, `budget_code`) are missing from the attributes payload.
- **Tightly Coupled Side Effects**: Sending email notifications, triggering webhooks, or updating downstream inventory systems are hardcoded inside database transaction boundaries, leading to dirty reads and performance degradation.

This specification introduces a **Declarative, Metadata-Driven State Machine & Workflow Engine** seamlessly embedded into the `@acc/backend` write pipeline.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ENTERPRISE FSM PIPELINE & EVENT LIFECYCLE                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                             │
│   ┌──────────────────┐        POST /records/{id}/transition?action=SUBMIT        ┌──────────────────┐       │
│   │   REST / Client  │ ─────────────────────────────────────────────────────────>│  MetadataController │       │
│   └──────────────────┘                                                           └────────┬─────────┘       │
│                                                                                           │                 │
│                                                                                           ▼                 │
│                                                                                  ┌──────────────────┐       │
│                                                                                  │ MetadataService  │       │
│                                                                                  └────────┬─────────┘       │
│                                                                                           │                 │
│                                                      ┌────────────────────────────────────┴──────────────┐  │
│                                                      │ FSM Lifecycle Validation Gates (EntityLifecycleService)│
│                                                      ├───────────────────────────────────────────────────┤  │
│                                                      │ 1. Tenant Context & Isolation Gate                 │  │
│                                                      │ 2. Allowed Transition Graph Check                 │  │
│                                                      │ 3. Security Role & Authority Evaluation           │  │
│                                                      │ 4. Required Attribute Presence Verification       │  │
│                                                      │ 5. SpEL / CEL Dynamic Guard Expression Evaluation │  │
│                                                      └────────────────────┬──────────────────────────────┘  │
│                                                                           │                                 │
│                                                                           ▼                                 │
│                                                      ┌───────────────────────────────────────────────────┐  │
│                                                      │ State Mutation & Optimistic Lock (@Version)       │  │
│                                                      └────────────────────┬──────────────────────────────┘  │
│                                                                           │                                 │
│                                                                           ▼                                 │
│                                                      ┌───────────────────────────────────────────────────┐  │
│                                                      │ ApplicationEventPublisher.publishEvent()          │  │
│                                                      │  -> EntityStateChangedEvent                       │  │
│                                                      └────────────────────┬──────────────────────────────┘  │
│                                                                           │                                 │
│                                         ┌─────────────────────────────────┴──────────────────────────────┐  │
│                                         │ Spring Modulith Transactional Event Handlers                   │  │
│                                         ├────────────────────────────────────────────────────────────────┤  │
│                                         │ @TransactionalEventListener(phase = AFTER_COMMIT) + @Async     │  │
│                                         │  ├─ Audit Trail Logger (RFC 6902 JSON Patch)                   │  │
│                                         │  ├─ Webhook Notification Dispatcher                            │  │
│                                         │  └─ Downstream Integration Sagas                             │  │
│                                         └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Enterprise Invariants & Design Principles
1. **Multi-Tenant Isolation Invariant**: FSM schemas and transitions are strictly scoped by `tenant_id` via `TenantContextHolder`. Cross-tenant lifecycle transitions are rejected with zero tolerance.
2. **Declarative Zero-Code Engine**: All states, transition triggers (`action`), guard conditions, and required attributes are configured purely in `UNIPOST_ENTITY_TYPES.lifecycle_config` JSONB columns. No Java code compilation or service re-deployment is required to alter a business process.
3. **Optimistic Locking & Concurrency Guard**: State mutations increment the record version (`schemaVersion` / `@Version`) and validate optimistic locking to prevent concurrent state overwrites (race conditions) in high-throughput environments.
4. **Spring Modulith Event-Driven Decoupling**: Side effects occur outside the primary JPA write transaction via `@TransactionalEventListener(phase = AFTER_COMMIT)` combined with `@Async`, guaranteeing zero database locking during asynchronous downstream processing.

### 1.3 Design Patterns Summary
- **Finite State Machine (FSM) Pattern**: Governs state graph transitions (`from` $\to$ `to`), valid transition triggers (`action`), and permissible state trajectories.
- **Strategy Pattern (`GuardEvaluator`)**: Decouples the expression parsing engine (SpEL, CEL) from state machine orchestration.
- **Facade Pattern**: Enforces FSM validation logic transparently across all record write methods in `MetadataService` (`createEntityRecord`, `updateEntityRecord`, `patchEntityRecord`, `transitionRecordState`).
- **Observer / Mediator Pattern**: Dispatches `EntityStateChangedEvent` across Spring Modulith boundaries to decouple core transaction logic from auditing, webhooks, and notifications.

---

## 2. Architecture

### 2.1 Database Data Model Specification

Extend `UNIPOST_ENTITY_TYPES` with a JSONB column named `lifecycle_config`:

```sql
-- Liquibase changeset migration definition
-- File: db/changelog/changesets/010-add-lifecycle-config-to-entity-types.xml
ALTER TABLE UNIPOST_ENTITY_TYPES
ADD COLUMN lifecycle_config JSONB DEFAULT NULL;

COMMENT ON COLUMN UNIPOST_ENTITY_TYPES.lifecycle_config IS
'JSONB schema storing state machine definitions, initial state, states list, transition rules, required attributes, allowed roles, and guard expressions';
```

#### JSON Schema for `lifecycle_config`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "LifecycleConfigSchema",
  "type": "object",
  "properties": {
    "state_field": {
      "type": "string",
      "default": "status",
      "description": "Attribute key in entity attributes map that holds the state value"
    },
    "initial_state": {
      "type": "string",
      "description": "Initial state automatically set on creation if state_field is omitted"
    },
    "states": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "Exhaustive list of valid states in this state machine"
    },
    "transitions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "description": "Source state identifier or '*' for wildcard match"
          },
          "to": {
            "type": "string",
            "description": "Destination state identifier"
          },
          "action": {
            "type": "string",
            "description": "Trigger action name (e.g., SUBMIT, APPROVE, REJECT, ARCHIVE)"
          },
          "required_attributes": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Attributes that MUST be present and non-null in attributes before transitioning"
          },
          "guard_expression": {
            "type": "string",
            "description": "SpEL expression evaluated against attributes map returning boolean"
          },
          "allowed_roles": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Spring Security GrantedAuthority role names permitted to invoke transition"
          }
        },
        "required": ["from", "to", "action"]
      }
    }
  },
  "required": ["state_field", "initial_state", "states", "transitions"]
}
```

### 2.2 FSM Validation Gate Architecture

When a record write or state transition is requested, the engine executes five sequential validation gates before persisting the change:

1. **Gate 1: Tenant Context & Scope Isolation Gate**
   - Extract `TenantContextHolder.getTenantId()`.
   - Verify `record.tenantId` matches `activeTenantId`.
   - Prevent cross-tenant record state modification.

2. **Gate 2: State Graph Transition Validity Gate**
   - Retrieve current state from `record.attributes.get(state_field)`. If null, fallback to `initial_state`.
   - Look up matching transition in `lifecycleConfig.transitions` where `transition.action.equalsIgnoreCase(action)` AND (`transition.from == currentState` OR `transition.from == '*'` ).
   - If no matching transition exists, throw `MetadataConflictException("Invalid FSM transition action '...' for current state '...'")`.

3. **Gate 3: Role-Based Authority Check Gate**
   - Inspect Spring Security's `SecurityContextHolder.getContext().getAuthentication()`.
   - If `transition.allowed_roles` is defined, ensure the caller possesses at least one matching authority (`ROLE_CREATOR`, `ROLE_ADMIN`, `ROLE_APPROVER`).
   - If unauthenticated or authority is missing, throw `MetadataConflictException("User '...' lacks authority for transition '...'")`.

4. **Gate 4: Required Attribute Presence Gate**
   - For each attribute in `transition.required_attributes`, inspect the target attributes map.
   - Verify the key exists, is non-null, and is non-empty (for strings/collections).
   - If missing, throw `MetadataConflictException("Missing required attribute '...' for transition to state '...'")`.

5. **Gate 5: Dynamic Guard Expression Gate**
   - Evaluate `transition.guard_expression` via `SpelGuardEvaluator`.
   - Construct a safe `StandardEvaluationContext` exposing `#attributes`, `#user`, `#tenantId`, `#oldState`, and `#newState`.
   - If expression evaluates to `false` or throws error, reject transition with `MetadataConflictException("FSM Guard condition evaluated to false: ...")`.

---

## 3. Implementation Details

### 3.1 Java Data Transfer Objects & Domain Models

#### 1. `LifecycleConfig.java`
```java
package com.acc.domain.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.util.List;

public record LifecycleConfig(
    @JsonProperty("state_field")
    String stateField,

    @JsonProperty("initial_state")
    String initialState,

    @JsonProperty("states")
    List<String> states,

    @JsonProperty("transitions")
    List<TransitionConfig> transitions
) implements Serializable {

    public String stateFieldOrDefault() {
        return (stateField != null && !stateField.isBlank()) ? stateField.trim() : "status";
    }

    public String initialStateOrDefault() {
        return (initialState != null && !initialState.isBlank()) ? initialState.trim() : "DRAFT";
    }
}
```

#### 2. `TransitionConfig.java`
```java
package com.acc.domain.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.util.List;

public record TransitionConfig(
    @JsonProperty("from")
    String from,

    @JsonProperty("to")
    String to,

    @JsonProperty("action")
    String action,

    @JsonProperty("required_attributes")
    List<String> requiredAttributes,

    @JsonProperty("guard_expression")
    String guardExpression,

    @JsonProperty("allowed_roles")
    List<String> allowedRoles
) implements Serializable {}
```

#### 3. `EntityStateChangedEvent.java`
```java
package com.acc.domain.metadata;

import java.time.Instant;
import java.util.Map;

public record EntityStateChangedEvent(
    String tenantId,
    Long entityTypeId,
    Long recordId,
    String oldState,
    String newState,
    String action,
    String triggeredBy,
    Map<String, Object> attributesSnapshot,
    Instant timestamp
) {}
```

#### 4. Entity Class Updates (`EntityType.java`)
```java
package com.acc.domain.metadata;

import com.acc.domain.BaseModel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Entity
@Table(name = "UNIPOST_ENTITY_TYPES")
public class EntityType extends BaseModel {

    @Column(nullable = false)
    private String name;

    @Column(name = "system_name", nullable = false)
    private String systemName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId = "default-tenant";

    @Column(name = "schema_version", nullable = false)
    private Long schemaVersion = 1L;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lifecycle_config", columnDefinition = "jsonb")
    private LifecycleConfig lifecycleConfig;
}
```

---

### 3.2 SpEL Guard Expression Evaluator Component

```java
package com.acc.service.workflow;

import lombok.extern.slf4j.Slf4j;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class SpelGuardEvaluator {

    private final ExpressionParser parser = new SpelExpressionParser();
    private final Map<String, Expression> expressionCache = new ConcurrentHashMap<>();

    public boolean evaluate(String guardExpression,
                            Map<String, Object> attributes,
                            Authentication authentication,
                            String tenantId,
                            String oldState,
                            String newState) {
        if (guardExpression == null || guardExpression.isBlank()) {
            return true;
        }

        try {
            Expression expression = expressionCache.computeIfAbsent(guardExpression, parser::parseExpression);

            StandardEvaluationContext context = new StandardEvaluationContext();
            context.setVariable("attributes", attributes != null ? attributes : Map.of());
            context.setVariable("user", authentication);
            context.setVariable("tenantId", tenantId);
            context.setVariable("oldState", oldState);
            context.setVariable("newState", newState);

            Boolean result = expression.getValue(context, Boolean.class);
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.error("Failed to evaluate FSM SpEL guard expression '{}': {}", guardExpression, e.getMessage());
            return false;
        }
    }
}
```

---

### 3.3 Core FSM Engine Service Implementation

```java
package com.acc.service.workflow;

import com.acc.domain.metadata.*;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.service.exception.MetadataConflictException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class EntityLifecycleService {

    private final SpelGuardEvaluator guardEvaluator;
    private final ApplicationEventPublisher eventPublisher;

    public void initializeStateOnCreation(EntityType type, Map<String, Object> attributes) {
        LifecycleConfig config = type.getLifecycleConfig();
        if (config == null) return;

        String stateField = config.stateFieldOrDefault();
        String initialState = config.initialStateOrDefault();

        if (!attributes.containsKey(stateField) || attributes.get(stateField) == null) {
            attributes.put(stateField, initialState);
            log.debug("Initialized default state '{}' for field '{}'", initialState, stateField);
        }
    }

    public String validateAndExecuteTransition(EntityRecord record,
                                               String action,
                                               Map<String, Object> updatedAttributes) {
        EntityType type = record.getEntityType();
        LifecycleConfig config = type.getLifecycleConfig();
        if (config == null) {
            return null; // FSM not configured for this entity type
        }

        String stateField = config.stateFieldOrDefault();
        String activeTenantId = TenantContextHolder.getTenantId();

        // Gate 1: Tenant Check
        if (record.getTenantId() != null && activeTenantId != null && !record.getTenantId().equals(activeTenantId)) {
            throw new MetadataConflictException("Cross-tenant FSM mutation forbidden (record tenant: "
                    + record.getTenantId() + ", active tenant: " + activeTenantId + ")");
        }

        String currentState = record.getAttributes() != null && record.getAttributes().containsKey(stateField)
                ? String.valueOf(record.getAttributes().get(stateField))
                : config.initialStateOrDefault();

        // Gate 2: Transition Graph Check
        List<TransitionConfig> transitions = config.transitions() != null ? config.transitions() : List.of();
        TransitionConfig transition = transitions.stream()
                .filter(t -> t.action() != null && t.action().equalsIgnoreCase(action.trim()))
                .filter(t -> "*".equals(t.from()) || t.from().equalsIgnoreCase(currentState))
                .findFirst()
                .orElseThrow(() -> new MetadataConflictException(
                        "Invalid FSM transition action '" + action + "' for entity record #" + record.getId()
                        + " in current state '" + currentState + "'"));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // Gate 3: Allowed Roles
        if (transition.allowedRoles() != null && !transition.allowedRoles().isEmpty()) {
            boolean authorized = auth != null && auth.getAuthorities().stream()
                    .anyMatch(a -> transition.allowedRoles().contains(a.getAuthority()));
            if (!authorized) {
                throw new MetadataConflictException("Access Denied: Caller lacks required authority for FSM action '"
                        + action + "'. Allowed roles: " + transition.allowedRoles());
            }
        }

        // Gate 4: Required Attributes
        if (transition.requiredAttributes() != null) {
            for (String reqAttr : transition.requiredAttributes()) {
                Object val = updatedAttributes.get(reqAttr);
                if (val == null || (val instanceof String s && s.isBlank())) {
                    throw new MetadataConflictException("Transition Gate Violation: Attribute '" + reqAttr
                            + "' is mandatory for action '" + action + "' to transition state to '" + transition.to() + "'");
                }
            }
        }

        // Gate 5: Dynamic Guard Evaluation
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

        // Publish Domain Event
        eventPublisher.publishEvent(new EntityStateChangedEvent(
                record.getTenantId(),
                type.getId(),
                record.getId(),
                currentState,
                targetState,
                action,
                auth != null ? auth.getName() : "system",
                Map.copyOf(updatedAttributes),
                Instant.now()
        ));

        log.info("FSM State Transition Succeeded: Record #{} ({}) [{}] --({})--> [{}]",
                record.getId(), type.getSystemName(), currentState, action, targetState);

        return targetState;
    }
}
```

---

### 3.4 Integration Points in `MetadataService.java`

Integrate `EntityLifecycleService` into the `MetadataService` write pipeline:

```java
// Inside MetadataService.java

@Transactional
public EntityRecordResponse createEntityRecord(Long entityTypeId, CreateRecordRequest request) {
    EntityType type = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
            .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

    Map<String, Object> finalAttributes = applyAttributeDefaults(entityTypeId, request.attributes());

    // FSM Initialization Gate
    entityLifecycleService.initializeStateOnCreation(type, finalAttributes);

    // Schema Validation ...
    validatePayloadSize(finalAttributes);

    EntityRecord record = new EntityRecord();
    record.setEntityType(type);
    record.setTenantId(TenantContextHolder.getTenantId());
    record.setSchemaVersion(type.getSchemaVersion());
    record.setAttributes(finalAttributes);

    EntityRecord saved = entityRecordRepository.save(record);
    return MetadataDtoMapper.toResponse(saved);
}

@Transactional
public EntityRecordResponse transitionRecordState(Long recordId, String action, Map<String, Object> additionalAttributes) {
    EntityRecord record = entityRecordRepository.findByIdAndDeletedDateIsNull(recordId)
            .orElseThrow(() -> new MetadataNotFoundException("EntityRecord not found with id: " + recordId));

    Map<String, Object> mergedAttributes = new HashMap<>(record.getAttributes() != null ? record.getAttributes() : Map.of());
    if (additionalAttributes != null) {
        mergedAttributes.putAll(additionalAttributes);
    }

    // Process State Machine Transition
    entityLifecycleService.validateAndExecuteTransition(record, action, mergedAttributes);

    // Schema Validation for updated attributes
    schemaValidationService.validatePayload(record.getEntityType().getId(), record.getAttributes());

    EntityRecord saved = entityRecordRepository.save(record);
    return MetadataDtoMapper.toResponse(saved);
}
```

---

### 3.5 REST Controller API Contract Extension (`MetadataController.java`)

```java
@PostMapping("/records/{id}/transition")
public ResponseEntity<EntityRecordResponse> transitionRecordState(
        @PathVariable Long id,
        @RequestParam String action,
        @RequestBody(required = false) Map<String, Object> additionalAttributes) {
    EntityRecordResponse response = metadataService.transitionRecordState(id, action, additionalAttributes);
    return ResponseEntity.ok(response);
}
```

---

## 4. Extensibility (OCP Compliance)

### 4.1 Strategy Pattern for Guard Evaluators
To strictly adhere to the Open-Closed Principle, expression evaluation is abstracted behind a clean strategy interface:

```java
public interface GuardEvaluatorStrategy {
    boolean evaluate(String guardExpression,
                     Map<String, Object> attributes,
                     Authentication authentication,
                     String tenantId,
                     String oldState,
                     String newState);
}
```

Supported evaluation backends can be registered as Spring `@Component` beans:
- `SpelGuardEvaluatorStrategy` (Default Spring SpEL engine)
- `CelGuardEvaluatorStrategy` (Google Common Expression Language)
- `GraalJsGuardEvaluatorStrategy` (JS / Script engine sandbox)

### 4.2 Asynchronous Event Observers (`TransitionHandler` Chain)
Side effects following a state transition are handled asynchronously without altering the core FSM engine. Standard Spring Modulith `@TransactionalEventListener(phase = AFTER_COMMIT)` combined with `@Async` react to `EntityStateChangedEvent`:

```java
@Slf4j
@Component
public class WorkflowAuditEventListener {

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStateChange(EntityStateChangedEvent event) {
        log.info("[AUDIT] Record #{} changed state from '{}' to '{}' via action '{}' by user '{}' (Tenant: {})",
                event.recordId(), event.oldState(), event.newState(), event.action(), event.triggeredBy(), event.tenantId());
        // Write RFC 6902 JSON patch to UNIPOST_ENTITY_AUDIT_LOGS table
    }
}
```

### 4.3 Zero-Downtime Workflow Schema Evolution
System administrators and low-code developers can add new states, permissions, and guard logic dynamically via REST APIs by updating `UNIPOST_ENTITY_TYPES.lifecycle_config`. Hazelcast L1/L2 cache invalidation listeners automatically evict stale schemas, ensuring instant propagation across all application cluster nodes without service restarts or DDL changes.
