# Deep Dive: Custom DAG-Based Workflow Engine with Dual Visual & Code-First Authoring

A complete record of this architectural blueprint has been saved to Google Drive:

📄 **[Architecture Blueprint: Custom DAG Workflow Engine with Dual Visual and Code-First Authoring (Google Doc)](https://docs.google.com/document/d/1IlNqn888_JUOdCTqZ0T8jbFabZZEhodIVSdMwnVEPlU/edit)**

## 1. Architectural Overview & The Dual-Authoring Challenge

The primary challenge in building a [Directed Acyclic Graph (DAG)](https://en.wikipedia.org/wiki/Directed_acyclic_graph) workflow engine that supports both visual drag-and-drop authoring and code-first authoring is the **round-trip synchronization problem**:

- If **raw code** (Java) is treated as the sole source of truth, visual editing requires complex Abstract Syntax Tree (AST) parsing and code generation via tools like [JavaParser](https://github.com/javaparser/javaparser), which risks losing developer comments, variable styling, and arbitrary programmatic logic.
    
- If a **visual canvas** is the sole source of truth, developers lose type safety, compile-time validation, IDE refactoring, and Git-centric CI/CD workflows.
    

### The Canonical Intermediate Representation (IR) Solution

To bridge this gap cleanly, the engine must use a **declarative Canonical Intermediate Representation (IR)** formatted in JSON or YAML. Both authoring interfaces compile to and read from this common specification:

```
               [ Developer IDE ]               [ Web Canvas (React Flow) ]
                       |                                     |
               Java Fluent DSL                         Visual Builder
              (.builder().build())                    (Drag, Drop, Connect)
                       \                                     /
                        \                                   /
                         v                                 v
                     +---------------------------------------+
                     |     Canonical DAG Intermediate        |
                     |      Representation (IR / JSON)       |
                     | - Nodes (Tasks & Handler Ref)         |
                     | - Edges (Dependencies & Conditions)   |
                     | - Layout Metadata (X, Y Coordinates)  |
                     +-------------------+-------------------+
                                         |
                       Validation (Acyclicity / Kahn's Algo)
                                         |
                                         v
                     +---------------------------------------+
                     |      PostgreSQL Persistence &         |
                     |      Spring Boot Execution Engine     |
                     |                                       |
                     | - dag_definitions (JSONB)             |
                     | - task_instances (JSONB status)       |
                     | - outbox_events (Transactional Outbox)|
                     +-------------------+-------------------+
                                         |
                                         v
                     +---------------------------------------+
                     | Distributed Task Dispatcher & Workers |
                     +---------------------------------------+
```

## 2. Numbered Implementation Steps (How-To)

### Step 1: Design the Canonical IR Schema in PostgreSQL

Store DAG definitions, execution runs, and task state instances using relational tables paired with [PostgreSQL JSON Types (JSONB)](https://www.postgresql.org/docs/current/datatype-json.html):

SQL

```
-- 1. Canonical DAG Definition (Metadata)
CREATE TABLE dag_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dag_key VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    definition JSONB NOT NULL, -- Contains nodes, edges, and visual layoutMetadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dag_key, version)
);

-- 2. DAG Execution Runs
CREATE TABLE dag_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dag_definition_id UUID REFERENCES dag_definitions(id),
    status VARCHAR(32) NOT NULL DEFAULT 'RUNNING', -- RUNNING, SUCCESS, FAILED
    context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Individual Task Instances within a Run
CREATE TABLE task_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dag_run_id UUID REFERENCES dag_runs(id),
    task_key VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, READY, RUNNING, COMPLETED, FAILED, SKIPPED
    input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempt_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dag_run_id, task_key)
);
CREATE INDEX idx_task_instances_status ON task_instances (dag_run_id, status);
```

### Step 2: Implement the Java Code-First Fluent DSL

Provide developers with a strongly-typed fluent builder in Spring Boot. The builder constructs the DAG model and serializes it into the Canonical IR JSON:

Java

```
@Component
public class OrderFulfillmentWorkflowDefinition {

    public DagWorkflow define() {
        return DagWorkflow.builder("order-fulfillment", 1)
            .description("Fulfills customer orders with parallel inventory and payment steps")
            .task("validateOrder", ValidateOrderTask.class)
            .task("reserveInventory", ReserveInventoryTask.class)
                .dependsOn("validateOrder")
                .inputBinding("orderId", "$.tasks.validateOrder.output.orderId")
            .task("chargePayment", ChargePaymentTask.class)
                .dependsOn("validateOrder")
                .inputBinding("amount", "$.tasks.validateOrder.output.totalAmount")
            .task("dispatchShipment", DispatchShipmentTask.class)
                .dependsOn("reserveInventory", "chargePayment")
            .build();
    }
}
```

The `.build()` method exports the Canonical IR JSON and automatically registers or updates the metadata record in PostgreSQL.

### Step 3: Implement Visual Graph Modeling (React Flow + Dagre)

Build the web UI canvas using [React Flow](https://reactflow.dev/) to render nodes and directed edges:

- **Node Palette**: Enables dragging task types onto the canvas, configuring input mappings, timeouts, and retry policies.
    
- **Automated Layout via Dagre**: Use the [Dagre graph layout engine](https://github.com/dagrejs/dagre) to calculate coordinates (`x`, `y`) automatically whenever a workflow generated from code is opened visually.
    
- **Round-Trip Preservation**: Save visual node coordinates into a `layoutMetadata` field in the Canonical IR JSON so visual edits retain their spatial arrangement.
    

### Step 4: Implement Cycle Detection & Topological Verification

Before saving or executing any DAG (whether authored in code or visually), validate that the graph is strictly acyclic using [Topological Sorting](https://en.wikipedia.org/wiki/Topological_sorting) (via Kahn’s algorithm or the [JGraphT DirectedAcyclicGraph](https://jgrapht.org/javadoc/org.jgrapht.core/org/jgrapht/graph/DirectedAcyclicGraph.html) library):

Java

```
public void validateDagAcyclicity(DagDefinitionDto dto) {
    DirectedAcyclicGraph<String, DefaultEdge> graph =
        new DirectedAcyclicGraph<>(DefaultEdge.class);

    // 1. Add vertices
    dto.getTasks().forEach(t -> graph.addVertex(t.getTaskKey()));

    // 2. Add edges (throws IllegalArgumentException immediately on cycle)
    for (DagEdgeDto edge : dto.getEdges()) {
        try {
            graph.addEdge(edge.getSourceTaskId(), edge.getTargetTaskId());
        } catch (IllegalArgumentException ex) {
            throw new InvalidDagException("Cycle detected between task: " 
                + edge.getSourceTaskId() + " and " + edge.getTargetTaskId());
        }
    }
}
```

### Step 5: Implement the Dynamic DAG Execution Loop & Outbox Dispatcher

When a workflow instance is triggered:

1. Initialize a `dag_runs` record and create `task_instances` for every task in the graph.
    
2. Root tasks (tasks with zero upstream dependencies) are marked `READY`.
    
3. Ready tasks are dispatched atomically via the [Pattern: Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html).
    
4. When a worker completes a task, it updates `task_instances` to `COMPLETED` and saves its output payload.
    
5. The engine queries downstream dependent tasks. If all upstream dependencies for a downstream task are satisfied, it transitions that task to `READY` and pushes it to the outbox.
    

Java

```
@Transactional
public void onTaskCompleted(UUID dagRunId, String completedTaskKey, JsonNode taskOutput) {
    TaskInstance currentTask = taskRepo.findByDagRunIdAndTaskKey(dagRunId, completedTaskKey);
    currentTask.setStatus("COMPLETED");
    currentTask.setOutputData(taskOutput);
    taskRepo.save(currentTask);

    DagDefinition def = getDagDefinition(dagRunId);
    List<String> downstreamTasks = def.getDownstreamTasks(completedTaskKey);

    for (String downstreamKey : downstreamTasks) {
        if (areAllUpstreamDependenciesSatisfied(dagRunId, def, downstreamKey)) {
            TaskInstance downstream = taskRepo.findByDagRunIdAndTaskKey(dagRunId, downstreamKey);
            downstream.setStatus("READY");
            downstream.setInputData(resolveInputs(def, downstreamKey, dagRunId));
            taskRepo.save(downstream);

            outboxService.stageTaskDispatch(dagRunId, downstreamKey);
        }
    }
}
```

### Step 6: Dynamic Data-Passing & Conditional Branching

- **Data Flow**: Tasks declare parameter routing using JSONPath expressions (e.g., `$.tasks.validateOrder.output.customerId`). The execution engine extracts the value from the upstream task's `output_data` and populates the downstream task's `input_data`.
    
- **Conditional Branching & Skipping**: If an edge defines a condition (e.g., `condition: "$.tasks.checkFraud.output.isFraudulent == false"`), evaluate it when upstream completes. If false, mark the target task and its branch as `SKIPPED`.
    
- **Join Resolution**: When evaluating if downstream tasks are ready, downstream nodes evaluate whether all upstream dependencies are either `COMPLETED` or `SKIPPED`.
    

## 3. Implementation Checklist

|**Category**|**Checklist Item**|**Status**|
|---|---|---|
|**Data Architecture**|PostgreSQL tables created (`dag_definitions`, `dag_runs`, `task_instances`, `outbox_events`)|[ ]|
|**Intermediate Repr.**|Canonical IR JSON schema defined (nodes, edges, conditions, layoutMetadata)|[ ]|
|**Cycle Validation**|Topological cycle detection implemented via Kahn's algorithm or JGraphT|[ ]|
|**Code-First DSL**|Java fluent builder implemented to serialize code definitions to Canonical IR|[ ]|
|**Visual Canvas**|React Flow canvas implemented with custom task node shapes and edge connections|[ ]|
|**Auto-Layout**|Dagre layout integrated to arrange code-generated nodes hierarchically on the canvas|[ ]|
|**Task Dispatcher**|Transactional outbox staging ready tasks atomically to Kafka / RabbitMQ|[ ]|
|**Data Passing**|JSONPath expression evaluator resolving upstream outputs into task inputs|[ ]|
|**Branch Handling**|Edge conditions implemented with skip-propagation algorithm for parallel joins|[ ]|
|**Reliability**|Task retry policies, execution timeouts, and dead-letter queues configured|[ ]|

## 4. Architectural Comparison: Authoring Approaches

|**Dimension**|**Canonical IR Model (Recommended)**|**Pure Code-as-Truth (AST Parsing)**|**Pure Visual Builder**|
|---|---|---|---|
|**Primary Source of Truth**|Declarative JSON/YAML Intermediate Representation|Java source files in Git repository|Proprietary database format / UI schema|
|**Code-First Experience**|**High**: Fluent Java DSL compiles cleanly to IR|**Maximum**: Write arbitrary Java methods & control flow|**Low**: Developers must configure tasks in a web browser|
|**Visual Experience**|**High**: Two-way mapping between IR and React Flow|**Brittle**: Extracting graph logic from arbitrary Java AST fails easily|**Maximum**: Purpose-built visual interface|
|**Git & CI/CD Portability**|**High**: Version-control IR JSON or Java DSL files|**Maximum**: Native Git merge workflows|**Weak**: Often requires exporting JSON blobs from UI|
|**Sync Risk**|**Minimal**: Both authoring tools target the identical spec|**Severe**: Comments, code formatting, and lambdas lost on visual round-trip|**None**: No code editing capability|

## 5. Strategic Recommendations & Uncertainties

### Final Architectural Recommendation

Adopt the **Canonical Intermediate Representation (IR)** architecture. Avoid attempting bidirectional source-code parsing (e.g., scanning raw Java source code to generate a visual diagram, and writing modifications back into the `.java` file). Arbitrary code structures—such as dynamic loops, method calls across libraries, and conditional branching—do not map 1:1 to graphical nodes without losing developer formatting and comments.

Instead, restrict the code-first DSL strictly to **workflow topology and metadata bindings** (which tasks execute in what order), while leaving the execution logic inside reusable Spring `@Component` task workers.

### Honest Flagging of Uncertainties & Operational Risks

1. **Parallel Join Deadlocks**: In DAGs with conditional edge branches, if a downstream node waits on multiple parallel branches and one branch is skipped due to a false condition, the join node will deadlock unless your engine implements an explicit skip-propagation traversal.
    
2. **Dynamic Fan-Out (Map-Reduce)**: Static DAGs define tasks ahead of time. If a task processes a dynamic list of items whose size is only known at runtime (e.g., batch-processing 1,000 invoices), static DAGs require sub-DAG instantiation or dynamic runtime node expansion.
    
3. **Database Contention at Scale**: Checking upstream dependency satisfaction via relational database queries can create high read load on PostgreSQL under high throughput (thousands of concurrent DAG runs). In-memory topological counters or caching in Redis may be required as execution volume scales.
    
4. **Visual Layout Drift**: When users customize node placements on a visual canvas, switching back to code and adding a node can make Dagre recompute the entire layout, overriding customized visual coordinates unless partial layout anchors are preserved.
    

## 6. Authoritative References & Sources

- [Wikipedia: Directed Acyclic Graph (DAG)](https://en.wikipedia.org/wiki/Directed_acyclic_graph)
    
- [Wikipedia: Topological Sorting & Kahn's Algorithm](https://en.wikipedia.org/wiki/Topological_sorting)
    
- [JGraphT: DirectedAcyclicGraph Java API](https://jgrapht.org/javadoc/org.jgrapht.core/org/jgrapht/graph/DirectedAcyclicGraph.html)
    
- [React Flow: Node-Based Diagramming](https://reactflow.dev/)
    
- [GitHub: Dagre Directed Graph Layout Engine](https://github.com/dagrejs/dagre)
    
- [GitHub: JavaParser Abstract Syntax Tree](https://github.com/javaparser/javaparser)
    
- [Microservices.io: Pattern: Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)
    
- [PostgreSQL Documentation: JSON Types & JSONB](https://www.postgresql.org/docs/current/datatype-json.html)