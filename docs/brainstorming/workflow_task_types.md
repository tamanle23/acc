# Workflow Task Types


## 1. Worker Tasks (Custom Logic)

These are executed by external workers. You write the custom business logic in your preferred language (Python, Java, Go, C#, Node.js) and run it on your own infrastructure. The worker polls the Conductor server for tasks, executes the code, and returns the result.

| Task Name | Description | Frequency of Use |
| :--- | :--- | :--- |
| **`SIMPLE`** | Executes custom business logic on external workers. Core to almost all workflows. | **High** |

## 2. System Tasks (Built-in)

System tasks are built directly into the Conductor server and execute without requiring external workers. They handle common orchestration needs.

| Task Name               | Description                                                                                       | Frequency of Use |
| :---------------------- | :------------------------------------------------------------------------------------------------ | :--------------- |
| **`HTTP`**              | Makes external REST/HTTP calls (GET, POST, PUT, DELETE).                                          | **High**         |
| **`INLINE`**            | Executes lightweight JavaScript (GraalJS) or Python expressions directly on the server.           | **High**         |
| **`JSON_JQ_TRANSFORM`** | Transforms, filters, or aggregates JSON payloads using `jq` syntax.                               | **High**         |
| **`EVENT`**             | Publishes messages to external event brokers like Kafka, SQS, NATS, or RabbitMQ.                  | **Medium**       |
| **`KAFKA_PUBLISH`**     | A specialized task for publishing directly to Kafka topics.                                       | **Low / Medium** |
| **`WAIT`**              | Pauses workflow execution until a specific timestamp, a relative duration, or an external signal. | **High**         |
| **`HUMAN`**             | Pauses the workflow indefinitely until an external manual action (like an approval) completes it. | **High**         |
| **`JDBC`**              | Executes SQL queries and updates against relational databases.                                    | **Low**          |
| **`NOOP`**              | Does nothing; often used as a placeholder or to cleanly merge branches.                           | **Low**          |
|                         |                                                                                                   |                  |

## 3. Operators (Flow Control)

Operators are a special subset of system tasks used to dictate the execution path and control flow of the workflow.

| Task Name                     | Description                                                                        | Frequency of Use |
| :---------------------------- | :--------------------------------------------------------------------------------- | :--------------- |
| **`SWITCH`**                  | Conditional branching (acts like an `if...else` or `switch` statement).            | **High**         |
| **`FORK_JOIN`**               | Spawns multiple parallel execution branches statically.                            | **High**         |
| **`FORK_JOIN_DYNAMIC`**       | Spawns a variable number of parallel branches at runtime based on incoming arrays. | **High**         |
| **`JOIN` / `EXCLUSIVE_JOIN`** | Waits for parallel branches to complete (all branches vs. first to finish).        | **High**         |
| **`DO_WHILE`**                | Loops over a sequence of tasks until a specified condition is met.                 | **High**         |
| **`SUB_WORKFLOW`**            | Synchronously executes another Conductor workflow as a subroutine.                 | **Medium**       |
| **`START_WORKFLOW`**          | Asynchronously starts another workflow in a "fire-and-forget" manner.              | **Medium**       |
| **`DYNAMIC`**                 | Determines which task to execute at runtime based on incoming variables.           | **Low / Medium** |
| **`SET_VARIABLE`**            | Declares or updates global workflow-level state variables.                         | **High**         |
| **`TERMINATE`**               | Ends the workflow immediately with a specified final status (success or failure).  | **Medium**       |

## 4. AI and LLM Tasks

Recent versions of Conductor OSS include specialized built-in tasks for AI agent workflows.

| Task Name | Description | Frequency of Use |
| :--- | :--- | :--- |
| **`LLM_CHAT_COMPLETE` / `LLM_TEXT_COMPLETE`** | Interacts with LLM providers (OpenAI, Anthropic, Gemini) for text generation. | **Medium** (Growing) |
| **Vector Search / Embeddings** | Generates embeddings and queries vector databases for RAG architectures. | **Low / Medium** |
| **`LIST_MCP_TOOLS` / `CALL_MCP_TOOL`** | Discovers and invokes external tools exposed by Model Context Protocol servers. | **Low** (Emerging) |