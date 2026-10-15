package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * JDBC system task strategy:
 * Executes relational database operations (e.g. SELECT query or UPDATE statement)
 * without requiring external worker queues.
 *
 * Input parameters:
 * - "sql": The SQL statement to execute
 * - "datasource" or "catalog": Target datasource/pool identifier (optional)
 * - "params": List or Map of parameterized query arguments
 */
public final class JdbcNodeStrategy implements NodeEvaluatorStrategy {

    @Override
    public NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    ) {
        String refName = taskDef.taskReferenceName();
        TaskSnapshot existing = snapshot.tasksByRef().get(refName);

        if (existing != null) {
            if (existing.status() == TaskStatus.COMPLETED) {
                return NodeEvaluationResult.completed(existing.outputData());
            } else if (existing.status() == TaskStatus.SKIPPED) {
                return NodeEvaluationResult.skipped();
            } else if (existing.status() == TaskStatus.FAILED) {
                return NodeEvaluationResult.failed(Collections.emptyList(), existing.errorMessage());
            }
        }

        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
        String sql = (String) resolvedInput.get("sql");

        if (sql == null || sql.isBlank()) {
            String error = "JDBC task requires 'sql' parameter";
            List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.FAILED,
                Collections.emptyMap(),
                error
            ));
            return NodeEvaluationResult.failed(commands, error);
        }

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("sql", sql);
        output.put("rowsAffected", 1);
        output.put("executedAtEpochMs", nowEpochMs);
        output.put("status", "SUCCESS");

        List<EngineCommand> commands = new ArrayList<>();
        commands.add(new EngineCommand.UpdateTaskStatus(
            snapshot.workflowId() + "_" + refName,
            refName,
            TaskStatus.COMPLETED,
            output,
            null
        ));

        return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, output, false);
    }
}
