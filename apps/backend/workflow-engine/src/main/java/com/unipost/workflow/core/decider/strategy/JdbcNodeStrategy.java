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

        if (existing == null) {
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

            String taskId = snapshot.workflowId() + "_" + refName + "_att1";
            long timeoutMs = taskDef.timeoutSeconds() > 0 ? (long) taskDef.timeoutSeconds() * 1000L : 30000L;
            String domain = (taskDef.domain() != null && !taskDef.domain().isBlank() && !"default".equals(taskDef.domain()))
                ? taskDef.domain()
                : "system:jdbc";

            EngineCommand.ScheduleTask scheduleCmd = new EngineCommand.ScheduleTask(
                taskId,
                "JDBC",
                refName,
                domain,
                resolvedInput,
                1,
                nowEpochMs,
                timeoutMs
            );
            return NodeEvaluationResult.scheduled(List.of(scheduleCmd));
        }

        TaskStatus status = existing.status();
        if (status == TaskStatus.COMPLETED) {
            return NodeEvaluationResult.completed(existing.outputData());
        } else if (status == TaskStatus.SKIPPED) {
            return NodeEvaluationResult.skipped();
        } else if (status == TaskStatus.IN_PROGRESS || status == TaskStatus.SCHEDULED) {
            return NodeEvaluationResult.inProgress();
        } else if (status == TaskStatus.FAILED || status == TaskStatus.TIMED_OUT) {
            if (existing.attempt() < taskDef.retryCount()) {
                int nextAttempt = existing.attempt() + 1;
                String nextTaskId = snapshot.workflowId() + "_" + refName + "_att" + nextAttempt;
                long backoffDelayMs = (long) (taskDef.retryDelaySeconds() * Math.pow(taskDef.backoffRate(), existing.attempt() - 1)) * 1000L;
                long nextVisibleAtEpochMs = nowEpochMs + backoffDelayMs;
                long timeoutMs = taskDef.timeoutSeconds() > 0 ? (long) taskDef.timeoutSeconds() * 1000L : 30000L;
                Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
                String domain = (taskDef.domain() != null && !taskDef.domain().isBlank() && !"default".equals(taskDef.domain()))
                    ? taskDef.domain()
                    : "system:jdbc";

                EngineCommand.ScheduleTask retryCmd = new EngineCommand.ScheduleTask(
                    nextTaskId,
                    "JDBC",
                    refName,
                    domain,
                    resolvedInput,
                    nextAttempt,
                    nextVisibleAtEpochMs,
                    timeoutMs
                );
                return NodeEvaluationResult.scheduled(List.of(retryCmd));
            }
            return NodeEvaluationResult.failed(Collections.emptyList(), existing.errorMessage());
        }

        return NodeEvaluationResult.inProgress();
    }
}
