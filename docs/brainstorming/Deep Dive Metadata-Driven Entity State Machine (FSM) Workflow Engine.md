
A complete record of this technical blueprint has been saved to Google Drive:

📄 **[Architecture Blueprint: Metadata-Driven FSM Workflow Engine with PostgreSQL JSONB and Spring Boot (Google Doc)](https://docs.google.com/document/d/17XlBSYu1kkl8jWEHFPeA5IN2UeDx8E-JscQbO0KmgLk/edit)**

## 1. Architectural Overview & Core Concepts

A metadata-driven Finite State Machine (FSM) workflow engine decouples business entity structures, lifecycle states, and transition rules from compiled Java code. Instead of hardcoding states and business logic into Java enums and switch-case blocks, workflow schemas and entity attribute rules are stored as versioned metadata records in PostgreSQL and evaluated dynamically at runtime by Spring Boot.

```
       +-------------------------------------------------------+
       |                  Spring Boot API                     |
       +---------------------------+---------------------------+
                                   |
         1. Validate against       | 2. Execute FSM Transition
            JSON Schema            |    under @Transactional
                                   v
             +---------------------+---------------------+
             |         PostgreSQL Database Engine        |
             |                                           |
             |  - entity_instances (JSONB + @Version)    |
             |  - workflow_definitions (Metadata)        |
             |  - outbox_events (Transactional Outbox)   |
             +---------------------+---------------------+
                                   |
                                   | 3. CDC (Debezium) or
                                   |    Transactional Poller
                                   v
             +---------------------+---------------------+
             |             Message Broker                |
             |           (Kafka / RabbitMQ)              |
             +---------------------+---------------------+
                                   |
                                   | 4. Asynchronous Dispatch
                                   v
             +---------------------+---------------------+
             |      Distributed Worker Pool (Idempotent) |
             +-------------------------------------------+
```

### Core Architecture Components

1. **Metadata Store**: Versioned workflow definitions (states, events, guards, actions) and entity attribute schemas (JSON Schema specifications).
    
2. **Entity Instance Storage**: Relational table storing entity metadata and dynamic attributes using [PostgreSQL JSON Types (JSONB)](https://www.postgresql.org/docs/current/datatype-json.html).
    
3. **Dynamic FSM Evaluator**: In-memory transition engine in Spring Boot evaluating guards and state validity dynamically (superseding compile-time configurations found in standard [Spring Statemachine](https://docs.spring.io/spring-statemachine/docs/current/reference/)).
    
4. **Distributed Task Dispatcher**: Implemented via the [Pattern: Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html) to guarantee atomic state mutation and reliable asynchronous message publication without dual-write hazards.
    
5. **Distributed Saga Coordinator**: Asynchronous compensation and choreography/orchestration following the [Pattern: Saga](https://microservices.io/patterns/data/saga.html).
    

## 2. Numbered Implementation Steps (How-To)

### Step 1: PostgreSQL Schema & Indexing Design

Design the persistence schema to support dynamic schemas, optimistic concurrency, and the transactional outbox:

SQL

```
-- 1. Metadata: Dynamic Entity Type Definition
CREATE TABLE entity_type_definitions (
    entity_type VARCHAR(64) PRIMARY KEY,
    version INT NOT NULL,
    json_schema JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Metadata: Workflow FSM Definition
CREATE TABLE workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(64) REFERENCES entity_type_definitions(entity_type),
    version INT NOT NULL,
    definition JSONB NOT NULL, -- States, transitions, guards, actions
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, version)
);

-- 3. Operational Entity Instances
CREATE TABLE entity_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(64) NOT NULL,
    current_state VARCHAR(64) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    version BIGINT NOT NULL DEFAULT 0, -- Optimistic locking
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Generalized Inverted Index (GIN) for high-performance JSONB querying
CREATE INDEX idx_entity_attributes_gin ON entity_instances USING gin (attributes jsonb_path_ops);
CREATE INDEX idx_entity_type_state ON entity_instances (entity_type, current_state);

-- 4. Transactional Outbox for Distributed Task Dispatching
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_outbox_created_at ON outbox_events (created_at);
```

_Reference: [PostgreSQL GIN Indexing](https://www.postgresql.org/docs/current/gin.html) and [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html)._

### Step 2: Dynamic Schema Validation in Spring Boot

Before persisting or modifying dynamic JSONB attributes, validate incoming payloads against the active JSON Schema using an efficient validator such as NetworkNT `json-schema-validator`:

Java

```
@Service
public class SchemaValidationService {
    private final EntityTypeRepository typeRepository;
    private final ConcurrentMap<String, JsonSchema> schemaCache = new ConcurrentHashMap<>();

    public void validate(String entityType, JsonNode attributes) {
        JsonSchema schema = schemaCache.computeIfAbsent(entityType, key -> {
            String rawSchema = typeRepository.findActiveSchema(key);
            JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
            return factory.getSchema(rawSchema);
        });

        Set<ValidationMessage> errors = schema.validate(attributes);
        if (!errors.isEmpty()) {
            throw new SchemaValidationException("Schema violation: " + errors);
        }
    }
}
```

### Step 3: Dynamic FSM Transition Engine & Guard Evaluation

Implement the transition service. The engine verifies if a requested transition is valid from the `current_state`, evaluates conditional guards (via Spring Expression Language or JSONPath against dynamic attributes), and triggers side effects:

Java

```
@Service
public class FsmExecutionService {
    private final WorkflowDefinitionRepository workflowRepo;
    private final EntityInstanceRepository entityRepo;
    private final OutboxService outboxService;

    @Transactional
    public EntityInstance fireEvent(UUID entityId, String triggerEvent, JsonNode eventPayload) {
        EntityInstance entity = entityRepo.findById(entityId)
            .orElseThrow(() -> new EntityNotFoundException(entityId));

        WorkflowDefinition def = workflowRepo.findActive(entity.getEntityType());
        Transition transition = def.findTransition(entity.getCurrentState(), triggerEvent)
            .orElseThrow(() -> new IllegalTransitionException("Invalid transition"));

        // Evaluate guard expression against dynamic attributes
        if (!evaluateGuard(transition.getGuardExpression(), entity.getAttributes(), eventPayload)) {
            throw new GuardConditionFailedException("Guard condition evaluated to false");
        }

        // Apply state change
        entity.setCurrentState(transition.getTargetState());
        entity.setUpdatedAt(Instant.now());
        EntityInstance saved = entityRepo.save(entity);

        // Stage asynchronous side-effect tasks into Outbox atomically
        if (transition.hasAction()) {
            outboxService.stageTask(saved.getId(), transition.getActionType(), eventPayload);
        }

        return saved;
    }
}
```

### Step 4: Optimistic Concurrency Control & Retries

Concurrent state transitions on the same entity aggregate must not cause lost updates. Use JPA `@Version` on `EntityInstance`:

Java

```
@Entity
@Table(name = "entity_instances")
public class EntityInstance {
    @Id
    private UUID id;

    @Version
    private Long version;

    private String currentState;

    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode attributes;
    // getters and setters
}
```

Configure Spring Retry to automatically retry optimistic lock collisions using exponential backoff:

Java

```
@Retryable(
    retryFor = { OptimisticLockingFailureException.class },
    maxAttempts = 3,
    backoff = @Backoff(delay = 50, multiplier = 2.0, random = true)
)
public EntityInstance fireEventWithRetry(UUID entityId, String event, JsonNode payload) {
    return fsmExecutionService.fireEvent(entityId, event, payload);
}
```

### Step 5: Distributed Task Dispatching via Transactional Outbox

To ensure database updates and message publishing are strictly atomic, write dispatch tasks into `outbox_events` inside the same transaction:

Java

```
@Service
public class OutboxService {
    private final OutboxEventRepository outboxRepo;

    public void stageTask(UUID entityId, String actionType, JsonNode payload) {
        OutboxEvent event = new OutboxEvent(
            "ENTITY_WORKFLOW",
            entityId.toString(),
            actionType,
            payload
        );
        outboxRepo.save(event);
    }
}
```

**Dispatching Mechanism:**

- **High Throughput (Production Recommended):** Change Data Capture (CDC) using Debezium reading PostgreSQL's Write-Ahead Log (WAL) and publishing directly to Kafka topics ([Debezium Outbox Pattern](https://debezium.io/blog/2020/02/10/event-sourcing-vs-cdc/)).
    
- **Low/Moderate Volume:** A scheduled Spring task polling `outbox_events` using `SELECT ... FOR UPDATE SKIP LOCKED` and publishing via Spring Cloud Stream / KafkaTemplate.
    

### Step 6: Idempotent Worker Execution & Saga Compensation

Distributed workers consume task events and execute external API or microservice calls. Workers must be idempotent:

Java

```
@Component
public class WorkflowTaskConsumer {
    private final IdempotencyRepository idempotencyRepo;
    private final ExternalIntegrationClient client;
    private final FsmExecutionService fsmService;

    @KafkaListener(topics = "workflow-tasks", groupId = "fsm-worker-group")
    @Transactional
    public void handleTask(TaskMessage message) {
        // 1. Check idempotency record
        if (idempotencyRepo.existsByMessageId(message.eventId())) {
            return; // Duplicate delivery; safely acknowledge
        }

        try {
            // 2. Perform external action
            client.invokeExternalService(message.payload());

            // 3. Mark processed and trigger next FSM transition
            idempotencyRepo.save(new IdempotencyRecord(message.eventId(), Instant.now()));
            fsmService.fireEvent(message.entityId(), "TASK_COMPLETED", message.payload());
        } catch (NonRetryableException ex) {
            // 4. Trigger Saga Compensation transition
            fsmService.fireEvent(message.entityId(), "TASK_FAILED", ErrorPayload.from(ex));
        }
    }
}
```

_Reference: [Pattern: Saga](https://microservices.io/patterns/data/saga.html)._

### Step 7: Observability, Dead-Letter Queues (DLQ), and Reconciliation

- Propagate W3C distributed tracing context (`traceparent`, `baggage`) across the outbox event headers into message broker records.
    
- Unrecoverable worker errors must route to a Dead-Letter Queue (DLQ) with an operational dashboard for manual retry or state reconciliation.
    

## 3. Implementation Checklist

|**Category**|**Checklist Item**|**Status**|
|---|---|---|
|**Data Layer**|PostgreSQL table `entity_instances` configured with `JSONB` and `@Version`|[ ]|
|**Data Layer**|GIN index created using `jsonb_path_ops` for attribute query optimization|[ ]|
|**Metadata Engine**|Dynamic JSON Schema validation implemented before database persistence|[ ]|
|**FSM Core**|Dynamic transition lookup and SpEL/JSONPath guard evaluation implemented|[ ]|
|**Concurrency**|Optimistic lock handling with Spring Retry and exponential backoff|[ ]|
|**Messaging**|Transactional outbox table written in same local transaction as state changes|[ ]|
|**Dispatching**|Outbox publisher configured (Debezium CDC or `FOR UPDATE SKIP LOCKED` poller)|[ ]|
|**Workers**|Idempotent consumer filter using unique message ID / transaction key|[ ]|
|**Reliability**|Saga compensation transitions configured for task failures|[ ]|
|**Operations**|Dead-letter queues (DLQ) and distributed tracing configured end-to-end|[ ]|

## 4. Architectural Comparison Table

|**Architecture Pattern**|**Bespoke Metadata FSM (Postgres + Spring Boot)**|**Code-as-Workflows (e.g., Temporal)**|**BPMN Engines (e.g., Camunda 7/8)**|
|---|---|---|---|
|**Workflow Definition**|JSON metadata in PostgreSQL tables|Imperative code (Java, Go, TypeScript)|XML / BPMN 2.0 visual diagrams|
|**Dynamic Schema Flexibility**|**High**: Native PostgreSQL JSONB + dynamic JSON Schema|**Moderate**: Requires typed data transfer objects & migrations|**Moderate**: Stored as engine variables / serialised JSON|
|**Runtime Modification**|**Immediate**: Update metadata row without service redeployment|**Requires deployment**: Versioned code branching in workflow code|**High**: Deploy updated BPMN definition to cluster|
|**Distributed State**|Transactional Outbox + Optimistic Locking|Event-sourced durable task queue architecture|Engine database tables + Job executor polling|
|**Operational Overhead**|**Low**: Leverages existing Postgres & Kafka instances|**High**: Requires dedicated Temporal server cluster & state store|**Medium**: Requires running Zeebe/Camunda engine instances|
|**Best Used For**|Dynamic entity lifecycles and user-configurable workflow schemas|Long-running, complex multi-service code orchestrations|Standard corporate processes needing visual business BPMN models|

## 5. Strategic Recommendations & Uncertainties

### Final Architecture Recommendation

- **When to build this architecture**: If your product is a multi-tenant or customizable platform where entities, dynamic fields, and business lifecycle rules are configured dynamically by users or administrators through an interface, this metadata-driven FSM engine is ideal. It leverages your existing PostgreSQL and Spring Boot infrastructure without introducing dedicated workflow orchestrator dependencies.
    
- **When to opt for Temporal or Camunda**: If workflows consist of complex, multi-service orchestrations with long-running timers (e.g., waiting 30 days), complex parallel join branches, and distributed human approvals, an off-the-shelf engine like Temporal provides battle-tested durable execution out of the box.
    

### Honest Flagging of Uncertainties & Operational Risks

1. **Schema Drift in JSONB**: Because PostgreSQL does not enforce internal typing on JSONB, historical entity records may conform to deprecated versions of a JSON Schema. You must implement schema version migration strategies or backward-compatible schema readers.
    
2. **Outbox Poller vs. CDC Throughput**: A database poller running `SELECT ... FOR UPDATE SKIP LOCKED` creates write load on the database at high throughput. When scaling beyond hundreds of events per second, transitioning to Debezium CDC is required.
    
3. **Complex Query Performance**: While GIN indexes with `jsonb_path_ops` accelerate containment queries (`@>`), arbitrary ad-hoc filtering across arbitrary nested keys or range comparisons (`>`, `<`) cannot use `jsonb_path_ops` efficiently and may require expression indexes or generated columns.
    
4. **Distributed Saga Debugging**: In asynchronous saga workflows, diagnosing entities stuck in intermediate states requires end-to-end distributed tracing across outbox publishers and worker consumers.
    

## 6. Authoritative References & Sources

- [PostgreSQL: JSON Types & JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
    
- [PostgreSQL: GIN Indexes and jsonb_path_ops](https://www.postgresql.org/docs/current/gin.html)
    
- [PostgreSQL: JSON Functions and Operators](https://www.postgresql.org/docs/current/functions-json.html)
    
- [Microservices.io: Pattern: Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)
    
- [Microservices.io: Pattern: Saga](https://microservices.io/patterns/data/saga.html)
    
- [Spring Documentation: Spring Statemachine Reference](https://docs.spring.io/spring-statemachine/docs/current/reference/)
    
- [Debezium: Event Sourcing vs CDC and the Outbox Pattern](https://debezium.io/blog/2020/02/10/event-sourcing-vs-cdc/)