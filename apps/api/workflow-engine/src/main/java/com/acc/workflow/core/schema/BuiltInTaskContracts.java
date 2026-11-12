package com.acc.workflow.core.schema;

import java.util.*;

/**
 * Built-in canonical data contracts for all system and boundary task types.
 * Standardizes Draft 7 JSON Schemas and parameter descriptors across backend and clients.
 */
public final class BuiltInTaskContracts {

    private static final Map<String, TaskTypeContract> CONTRACTS = new LinkedHashMap<>();

    static {
        // 1. START_WORKFLOW (Canonical Entry Boundary)
        register(new TaskTypeContract(
            "START_WORKFLOW",
            "BOUNDARY",
            "Canonical workflow entry boundary. Emits workflow trigger inputs as downstream context.",
            Map.of("type", "object", "properties", Map.of(), "additionalProperties", true),
            Map.of("type", "object", "properties", Map.of(), "additionalProperties", true, "description", "Mirrors workflow trigger payload"),
            List.of()
        ));

        // 2. END_WORKFLOW (Canonical Exit Boundary)
        register(new TaskTypeContract(
            "END_WORKFLOW",
            "BOUNDARY",
            "Canonical workflow exit boundary. Evaluates terminal output mappings and enforces workflow outputSchema.",
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "status", Map.of("type", "string", "description", "Terminal workflow status", "default", "COMPLETED"),
                    "payload", Map.of("type", "object", "description", "Explicit mapped terminal output payload")
                )
            ),
            Map.of("type", "object", "properties", Map.of(), "additionalProperties", false, "description", "Validated terminal workflow output"),
            List.of(
                Map.of("key", "status", "label", "Workflow Status", "type", "string", "required", true, "defaultValue", "COMPLETED"),
                Map.of("key", "payload", "label", "Result Payload", "type", "object", "required", false)
            )
        ));

        // 3. HTTP Connector
        register(new TaskTypeContract(
            "HTTP",
            "SYSTEM",
            "Executes synchronous REST HTTP/HTTPS requests with configurable methods, headers, and timeouts.",
            Map.of(
                "type", "object",
                "required", List.of("url", "method"),
                "properties", Map.of(
                    "url", Map.of("type", "string", "description", "Destination HTTP/HTTPS URL endpoint"),
                    "method", Map.of("type", "string", "enum", List.of("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"), "default", "GET"),
                    "headers", Map.of("type", "object", "description", "Optional HTTP request headers"),
                    "body", Map.of("type", "object", "description", "Optional HTTP request payload"),
                    "timeoutMs", Map.of("type", "integer", "default", 5000, "description", "Connection and read timeout in ms")
                )
            ),
            Map.of(
                "type", "object",
                "required", List.of("statusCode"),
                "properties", Map.of(
                    "statusCode", Map.of("type", "integer", "description", "HTTP response status code"),
                    "body", Map.of("type", "object", "description", "Decoded JSON response payload"),
                    "headers", Map.of("type", "object", "description", "Response headers map"),
                    "durationMs", Map.of("type", "integer", "description", "Execution roundtrip time in ms")
                )
            ),
            List.of(
                Map.of("key", "url", "label", "Endpoint URL", "type", "string", "required", true, "exampleValue", "https://api.example.com/v1/resource"),
                Map.of("key", "method", "label", "HTTP Method", "type", "string", "required", true, "defaultValue", "GET"),
                Map.of("key", "headers", "label", "Request Headers", "type", "object", "required", false),
                Map.of("key", "body", "label", "Request Body", "type", "object", "required", false),
                Map.of("key", "timeoutMs", "label", "Timeout (ms)", "type", "number", "required", false, "defaultValue", 5000)
            )
        ));

        // 4. LLM Chat Completion
        register(new TaskTypeContract(
            "LLM_CHAT_COMPLETE",
            "SYSTEM",
            "Invokes large language model inference (Gemini, Claude, GPT) with deterministic temperature and token accounting.",
            Map.of(
                "type", "object",
                "required", List.of("prompt"),
                "properties", Map.of(
                    "prompt", Map.of("type", "string", "description", "Primary user message or prompt text"),
                    "model", Map.of("type", "string", "default", "gemini-1.5-pro", "description", "Target LLM model identifier"),
                    "temperature", Map.of("type", "number", "default", 0.7, "description", "Sampling temperature (0.0 to 2.0)"),
                    "systemPrompt", Map.of("type", "string", "description", "System instruction conditioning prompt")
                )
            ),
            Map.of(
                "type", "object",
                "required", List.of("responseText"),
                "properties", Map.of(
                    "responseText", Map.of("type", "string", "description", "Generated assistant response text"),
                    "tokenUsage", Map.of("type", "object", "properties", Map.of(
                        "promptTokens", Map.of("type", "integer"),
                        "completionTokens", Map.of("type", "integer"),
                        "totalTokens", Map.of("type", "integer")
                    ))
                )
            ),
            List.of(
                Map.of("key", "prompt", "label", "Prompt Text", "type", "string", "required", true, "exampleValue", "Summarize the following order details: ${workflow.input.summary}"),
                Map.of("key", "model", "label", "Model Name", "type", "string", "required", false, "defaultValue", "gemini-1.5-pro"),
                Map.of("key", "temperature", "label", "Temperature", "type", "number", "required", false, "defaultValue", 0.7),
                Map.of("key", "systemPrompt", "label", "System Prompt", "type", "string", "required", false)
            )
        ));

        // 5. JSON JQ Transform
        register(new TaskTypeContract(
            "JSON_JQ_TRANSFORM",
            "SYSTEM",
            "Applies in-memory JQ expressions for deterministic JSON filtering, plucking, and structural projection.",
            Map.of(
                "type", "object",
                "required", List.of("queryExpression"),
                "properties", Map.of(
                    "queryExpression", Map.of("type", "string", "description", "JQ filtering and transformation expression"),
                    "input", Map.of("type", "object", "description", "Input JSON payload to filter")
                )
            ),
            Map.of(
                "type", "object",
                "required", List.of("result"),
                "properties", Map.of(
                    "result", Map.of("description", "Transformed output projection")
                )
            ),
            List.of(
                Map.of("key", "queryExpression", "label", "JQ Query Expression", "type", "string", "required", true, "exampleValue", ".items[] | {id: .id, total: (.qty * .price)}"),
                Map.of("key", "input", "label", "Target Input Object", "type", "object", "required", false, "exampleValue", "${previousStep.output}")
            )
        ));

        // 6. SWITCH Routing Node
        register(new TaskTypeContract(
            "SWITCH",
            "SYSTEM",
            "Evaluates conditional branch expressions and routes execution to matching decision branches.",
            Map.of(
                "type", "object",
                "required", List.of("evaluatorType", "expression"),
                "properties", Map.of(
                    "evaluatorType", Map.of("type", "string", "enum", List.of("value-param", "javascript", "spel"), "default", "value-param"),
                    "expression", Map.of("type", "string", "description", "Evaluation parameter key or script expression"),
                    "value", Map.of("description", "Direct value parameter evaluated against decision cases")
                )
            ),
            Map.of(
                "type", "object",
                "required", List.of("selectedCase"),
                "properties", Map.of(
                    "selectedCase", Map.of("type", "string", "description", "The matched case key routed to downstream")
                )
            ),
            List.of(
                Map.of("key", "evaluatorType", "label", "Evaluator Type", "type", "string", "required", true, "defaultValue", "value-param"),
                Map.of("key", "expression", "label", "Decision Expression", "type", "string", "required", true, "exampleValue", "speed"),
                Map.of("key", "value", "label", "Evaluation Value", "type", "string", "required", false, "exampleValue", "${workflow.input.speed}")
            )
        ));

        // 7. WAIT Node
        register(new TaskTypeContract(
            "WAIT",
            "SYSTEM",
            "Pauses execution for a specified duration or until a target ISO-8601 timestamp is reached.",
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "duration", Map.of("type", "string", "description", "ISO-8601 duration (e.g. PT5M for 5 minutes)"),
                    "until", Map.of("type", "string", "description", "ISO-8601 target wall-clock timestamp")
                )
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "waitedMs", Map.of("type", "integer", "description", "Total elapsed pause time in ms")
                )
            ),
            List.of(
                Map.of("key", "duration", "label", "Duration", "type", "string", "required", false, "exampleValue", "PT10M"),
                Map.of("key", "until", "label", "Wait Until (ISO)", "type", "string", "required", false, "exampleValue", "2026-12-31T23:59:59Z")
            )
        ));

        // 8. SUB_WORKFLOW Node
        register(new TaskTypeContract(
            "SUB_WORKFLOW",
            "SYSTEM",
            "Spawns and monitors an isolated child workflow execution, propagating sub-workflow terminal results.",
            Map.of(
                "type", "object",
                "required", List.of("subWorkflowKey"),
                "properties", Map.of(
                    "subWorkflowKey", Map.of("type", "string", "description", "Target workflow key to spawn as child"),
                    "subWorkflowVersion", Map.of("type", "integer", "default", 1, "description", "Target version number"),
                    "workflowInput", Map.of("type", "object", "description", "Input parameters passed to child execution")
                )
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "subWorkflowId", Map.of("type", "string", "description", "Child workflow execution ID"),
                    "subWorkflowOutput", Map.of("type", "object", "description", "Terminal output of child workflow")
                )
            ),
            List.of(
                Map.of("key", "subWorkflowKey", "label", "Sub-Workflow Key", "type", "string", "required", true, "exampleValue", "payment-settlement-subflow"),
                Map.of("key", "subWorkflowVersion", "label", "Version", "type", "number", "required", false, "defaultValue", 1),
                Map.of("key", "workflowInput", "label", "Child Input Payload", "type", "object", "required", false)
            )
        ));

        // 9. SET_VARIABLE Node
        register(new TaskTypeContract(
            "SET_VARIABLE",
            "SYSTEM",
            "Sets or mutates persistent execution variables in the workflow context without advancing step timers.",
            Map.of(
                "type", "object",
                "properties", Map.of(),
                "additionalProperties", true,
                "description", "Arbitrary key-value map to store into workflow variables context"
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "updatedVariables", Map.of("type", "object", "description", "Variables updated in context")
                )
            ),
            List.of(
                Map.of("key", "variableMap", "label", "Variables Map", "type", "object", "required", true)
            )
        ));

        // 10. JDBC Node
        register(new TaskTypeContract(
            "JDBC",
            "SYSTEM",
            "Executes synchronous SQL queries or mutations against tenant-isolated connection pools.",
            Map.of(
                "type", "object",
                "required", List.of("sql", "datasourceRef"),
                "properties", Map.of(
                    "sql", Map.of("type", "string", "description", "SQL statement to execute"),
                    "datasourceRef", Map.of("type", "string", "description", "Tenant datasource reference identifier"),
                    "parameters", Map.of("type", "array", "description", "Positional SQL binding parameters")
                )
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "rows", Map.of("type", "array", "description", "Query result set rows"),
                    "updateCount", Map.of("type", "integer", "description", "Affected row count for DML"),
                    "executionTimeMs", Map.of("type", "integer")
                )
            ),
            List.of(
                Map.of("key", "sql", "label", "SQL Query", "type", "string", "required", true, "exampleValue", "SELECT * FROM orders WHERE id = ?"),
                Map.of("key", "datasourceRef", "label", "Datasource", "type", "string", "required", true, "defaultValue", "primary-pool"),
                Map.of("key", "parameters", "label", "Query Parameters", "type", "array", "required", false)
            )
        ));

        // 11. CALL_MCP_TOOL Node
        register(new TaskTypeContract(
            "CALL_MCP_TOOL",
            "SYSTEM",
            "Dispatches tool call to a Model Context Protocol (MCP) server running in the unified sandbox.",
            Map.of(
                "type", "object",
                "required", List.of("toolName", "serverName"),
                "properties", Map.of(
                    "toolName", Map.of("type", "string", "description", "Name of the target MCP tool"),
                    "serverName", Map.of("type", "string", "description", "MCP server identifier"),
                    "arguments", Map.of("type", "object", "description", "Arguments map passed to MCP tool")
                )
            ),
            Map.of(
                "type", "object",
                "required", List.of("content"),
                "properties", Map.of(
                    "content", Map.of("type", "array", "description", "MCP tool content results"),
                    "isError", Map.of("type", "boolean", "description", "Whether tool encountered error")
                )
            ),
            List.of(
                Map.of("key", "toolName", "label", "Tool Name", "type", "string", "required", true, "exampleValue", "fetch_financial_record"),
                Map.of("key", "serverName", "label", "MCP Server", "type", "string", "required", true, "defaultValue", "default"),
                Map.of("key", "arguments", "label", "Tool Arguments", "type", "object", "required", false)
            )
        ));

        // 12. HUMAN Node
        register(new TaskTypeContract(
            "HUMAN",
            "SYSTEM",
            "Blocks workflow progression at an interactive review gate until an authorized reviewer approves or rejects.",
            Map.of(
                "type", "object",
                "required", List.of("reviewerRole"),
                "properties", Map.of(
                    "reviewerRole", Map.of("type", "string", "description", "Required security role to review"),
                    "promptMessage", Map.of("type", "string", "description", "Review request summary instructions"),
                    "timeoutSeconds", Map.of("type", "integer", "default", 86400)
                )
            ),
            Map.of(
                "type", "object",
                "required", List.of("decision"),
                "properties", Map.of(
                    "decision", Map.of("type", "string", "enum", List.of("APPROVED", "REJECTED")),
                    "reviewerId", Map.of("type", "string"),
                    "comments", Map.of("type", "string"),
                    "approvedAt", Map.of("type", "string")
                )
            ),
            List.of(
                Map.of("key", "reviewerRole", "label", "Reviewer Role", "type", "string", "required", true, "defaultValue", "ROLE_ADMIN"),
                Map.of("key", "promptMessage", "label", "Review Prompt", "type", "string", "required", false, "exampleValue", "Please verify order #${workflow.input.orderId}"),
                Map.of("key", "timeoutSeconds", "label", "Timeout (s)", "type", "number", "required", false, "defaultValue", 86400)
            )
        ));

        // 13. KAFKA_PUBLISH Node
        register(new TaskTypeContract(
            "KAFKA_PUBLISH",
            "SYSTEM",
            "Publishes message payloads asynchronously to Apache Kafka topics.",
            Map.of(
                "type", "object",
                "required", List.of("topic", "value"),
                "properties", Map.of(
                    "topic", Map.of("type", "string", "description", "Kafka destination topic"),
                    "key", Map.of("type", "string", "description", "Partition key"),
                    "value", Map.of("type", "object", "description", "Message payload"),
                    "headers", Map.of("type", "object", "description", "Kafka message headers")
                )
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "partition", Map.of("type", "integer"),
                    "offset", Map.of("type", "integer"),
                    "publishedAt", Map.of("type", "string")
                )
            ),
            List.of(
                Map.of("key", "topic", "label", "Topic", "type", "string", "required", true, "exampleValue", "order-events"),
                Map.of("key", "key", "label", "Message Key", "type", "string", "required", false, "exampleValue", "${workflow.input.orderId}"),
                Map.of("key", "value", "label", "Payload Value", "type", "object", "required", true)
            )
        ));

        // 14. TERMINATE Node
        register(new TaskTypeContract(
            "TERMINATE",
            "SYSTEM",
            "Explicitly terminates workflow execution with designated final status and audit reason.",
            Map.of(
                "type", "object",
                "required", List.of("terminationStatus"),
                "properties", Map.of(
                    "terminationStatus", Map.of("type", "string", "enum", List.of("COMPLETED", "FAILED", "TERMINATED")),
                    "terminationReason", Map.of("type", "string", "description", "Descriptive audit explanation")
                )
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "status", Map.of("type", "string"),
                    "reason", Map.of("type", "string")
                )
            ),
            List.of(
                Map.of("key", "terminationStatus", "label", "Termination Status", "type", "string", "required", true, "defaultValue", "FAILED"),
                Map.of("key", "terminationReason", "label", "Termination Reason", "type", "string", "required", false, "exampleValue", "Fraud check threshold exceeded")
            )
        ));

        // 15. FORK_JOIN Node
        register(new TaskTypeContract(
            "FORK_JOIN",
            "SYSTEM",
            "Spawns parallel independent execution branches.",
            Map.of("type", "object", "properties", Map.of()),
            Map.of("type", "object", "properties", Map.of(), "description", "Fork execution marker"),
            List.of()
        ));

        // 16. JOIN Node
        register(new TaskTypeContract(
            "JOIN",
            "SYSTEM",
            "Fan-in barrier that waits for all designated parallel prerequisite tasks to complete.",
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "joinOn", Map.of("type", "array", "items", Map.of("type", "string"), "description", "List of prerequisite task reference names")
                )
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "joinedBranches", Map.of("type", "array", "description", "Completed upstream branch task references")
                )
            ),
            List.of(
                Map.of("key", "joinOn", "label", "Join Task References", "type", "array", "required", true)
            )
        ));

        // 17. EXCLUSIVE_JOIN Node
        register(new TaskTypeContract(
            "EXCLUSIVE_JOIN",
            "SYSTEM",
            "Fan-in barrier for conditional branches; completes when the single active upstream branch completes.",
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "joinOn", Map.of("type", "array", "items", Map.of("type", "string"))
                )
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "activeBranch", Map.of("type", "string", "description", "The branch that completed")
                )
            ),
            List.of()
        ));

        // 18. DYNAMIC_FORK Node
        register(new TaskTypeContract(
            "DYNAMIC_FORK",
            "SYSTEM",
            "Dynamically computes and schedules runtime tasks based on runtime array payload.",
            Map.of(
                "type", "object",
                "required", List.of("dynamicTasksInputParamName"),
                "properties", Map.of(
                    "dynamicTasksInputParamName", Map.of("type", "string", "description", "Input parameter containing list of dynamic tasks")
                )
            ),
            Map.of("type", "object", "properties", Map.of("spawnedCount", Map.of("type", "integer"))),
            List.of(
                Map.of("key", "dynamicTasksInputParamName", "label", "Dynamic Tasks Param", "type", "string", "required", true)
            )
        ));

        // 19. DO_WHILE Node
        register(new TaskTypeContract(
            "DO_WHILE",
            "SYSTEM",
            "Iterates a loop body until a JavaScript or SpEL condition evaluates to false.",
            Map.of(
                "type", "object",
                "required", List.of("loopCondition"),
                "properties", Map.of(
                    "loopCondition", Map.of("type", "string", "description", "Loop condition script expression")
                )
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "iteration", Map.of("type", "integer", "description", "Total completed iterations")
                )
            ),
            List.of(
                Map.of("key", "loopCondition", "label", "Loop Condition", "type", "string", "required", true, "exampleValue", "if ($.iteration < 5) { true; } else { false; }")
            )
        ));

        // 20. INLINE Node
        register(new TaskTypeContract(
            "INLINE",
            "SYSTEM",
            "Executes zero-I/O sandboxed JavaScript expression in pure decider loop.",
            Map.of(
                "type", "object",
                "required", List.of("expression"),
                "properties", Map.of(
                    "expression", Map.of("type", "string", "description", "JavaScript expression to evaluate"),
                    "evaluatorType", Map.of("type", "string", "default", "javascript")
                )
            ),
            Map.of(
                "type", "object",
                "required", List.of("result"),
                "properties", Map.of(
                    "result", Map.of("description", "Evaluated expression output")
                )
            ),
            List.of(
                Map.of("key", "expression", "label", "Script Expression", "type", "string", "required", true, "exampleValue", "function() { return { sum: $.a + $.b }; }")
            )
        ));

        // 21. EVENT Node
        register(new TaskTypeContract(
            "EVENT",
            "SYSTEM",
            "Emits or listens for asynchronous domain lifecycle events.",
            Map.of(
                "type", "object",
                "required", List.of("eventName"),
                "properties", Map.of(
                    "eventName", Map.of("type", "string"),
                    "eventPayload", Map.of("type", "object")
                )
            ),
            Map.of("type", "object", "properties", Map.of("emitted", Map.of("type", "boolean"))),
            List.of(
                Map.of("key", "eventName", "label", "Event Name", "type", "string", "required", true)
            )
        ));

        // 22. DYNAMIC Node
        register(new TaskTypeContract(
            "DYNAMIC",
            "SYSTEM",
            "Resolves task definition dynamically at runtime from task input payload.",
            Map.of(
                "type", "object",
                "required", List.of("dynamicTaskNameParam"),
                "properties", Map.of(
                    "dynamicTaskNameParam", Map.of("type", "string")
                )
            ),
            Map.of("type", "object", "properties", Map.of("resolvedTask", Map.of("type", "string"))),
            List.of(
                Map.of("key", "dynamicTaskNameParam", "label", "Dynamic Task Param", "type", "string", "required", true)
            )
        ));

        // 23. NOOP Node
        register(new TaskTypeContract(
            "NOOP",
            "SYSTEM",
            "Pass-through operation for testing DAG structural topology.",
            Map.of("type", "object", "properties", Map.of()),
            Map.of("type", "object", "properties", Map.of()),
            List.of()
        ));

        // 24. SIMPLE (Domain Worker Default Fallback)
        register(new TaskTypeContract(
            "SIMPLE",
            "WORKER",
            "Domain worker task executed asynchronously by worker fleet pollers.",
            Map.of(
                "type", "object",
                "properties", Map.of(),
                "additionalProperties", true,
                "description", "Dynamic worker input contract (inherited from worker fleet catalog or node definition)"
            ),
            Map.of(
                "type", "object",
                "properties", Map.of(
                    "result", Map.of("type", "object", "description", "Execution result payload")
                ),
                "additionalProperties", true
            ),
            List.of()
        ));
    }

    private static void register(TaskTypeContract contract) {
        CONTRACTS.put(contract.taskType(), contract);
    }

    public static Map<String, TaskTypeContract> getContracts() {
        return Collections.unmodifiableMap(CONTRACTS);
    }

    public static Optional<TaskTypeContract> get(String taskType) {
        return Optional.ofNullable(CONTRACTS.get(taskType));
    }

    private BuiltInTaskContracts() {}
}
