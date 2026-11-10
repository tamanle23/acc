package com.acc.workflow.core.decider.strategy;

import com.acc.workflow.core.expression.ParameterResolver;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public final class SimpleTaskStrategy implements NodeEvaluatorStrategy {

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
            // First attempt scheduling
            String taskId = snapshot.workflowId() + "_" + refName + "_att1";
            long responseTimeoutMs = (long) taskDef.timeoutSeconds() * 1000L;
            Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);

            // Pre-dispatch input schema validation gate
            if (taskDef.inputSchema() != null && !taskDef.inputSchema().isEmpty()) {
                com.acc.workflow.core.schema.WorkflowSchemaValidator validator = new com.acc.workflow.core.schema.WorkflowSchemaValidator();
                List<com.acc.workflow.core.schema.WorkflowSchemaValidator.ValidationError> errors = validator.validate(resolvedInput, taskDef.inputSchema());
                if (!errors.isEmpty()) {
                    String errorMsg = "Task '" + refName + "' input violates inputSchema: " + errors.get(0).message();
                    List<EngineCommand> failCmds = List.of(
                        new EngineCommand.UpdateTaskStatus(
                            taskId,
                            refName,
                            TaskStatus.FAILED,
                            resolvedInput,
                            errorMsg
                        ),
                        new EngineCommand.TransitionWorkflow(
                            WorkflowStatus.FAILED,
                            snapshot.outputPayload(),
                            errorMsg
                        )
                    );
                    return NodeEvaluationResult.failed(failCmds, errorMsg);
                }
            }

            EngineCommand.ScheduleTask scheduleCmd = new EngineCommand.ScheduleTask(
                taskId,
                taskDef.taskType().name(),
                refName,
                taskDef.domain(),
                resolvedInput,
                1,
                nowEpochMs,
                responseTimeoutMs
            );
            return NodeEvaluationResult.scheduled(List.of(scheduleCmd));
        }

        TaskStatus status = existing.status();
        if (status == TaskStatus.COMPLETED) {
            // Defensive post-completion outputSchema validation gate
            if (taskDef.outputSchema() != null && !taskDef.outputSchema().isEmpty()) {
                com.acc.workflow.core.schema.WorkflowSchemaValidator validator = new com.acc.workflow.core.schema.WorkflowSchemaValidator();
                List<com.acc.workflow.core.schema.WorkflowSchemaValidator.ValidationError> errors = validator.validate(existing.outputData(), taskDef.outputSchema());
                if (!errors.isEmpty()) {
                    String errorMsg = "Task '" + refName + "' output violates outputSchema: " + errors.get(0).message();
                    List<EngineCommand> failCmds = List.of(
                        new EngineCommand.UpdateTaskStatus(
                            existing.taskId(),
                            refName,
                            TaskStatus.FAILED,
                            existing.outputData(),
                            errorMsg
                        ),
                        new EngineCommand.TransitionWorkflow(
                            WorkflowStatus.FAILED,
                            snapshot.outputPayload(),
                            errorMsg
                        )
                    );
                    return NodeEvaluationResult.failed(failCmds, errorMsg);
                }
            }
            return NodeEvaluationResult.completed(existing.outputData());
        } else if (status == TaskStatus.SKIPPED) {
            return NodeEvaluationResult.skipped();
        } else if (status == TaskStatus.IN_PROGRESS || status == TaskStatus.SCHEDULED) {
            return NodeEvaluationResult.inProgress();
        } else if (status == TaskStatus.FAILED || status == TaskStatus.TIMED_OUT) {
            // Check retry policy
            if (existing.attempt() < taskDef.retryCount()) {
                int nextAttempt = existing.attempt() + 1;
                String nextTaskId = snapshot.workflowId() + "_" + refName + "_att" + nextAttempt;
                long backoffDelayMs = (long) (taskDef.retryDelaySeconds() * Math.pow(taskDef.backoffRate(), existing.attempt() - 1)) * 1000L;
                long nextVisibleAtEpochMs = nowEpochMs + backoffDelayMs;
                long responseTimeoutMs = (long) taskDef.timeoutSeconds() * 1000L;

                EngineCommand.ScheduleTask retryCmd = new EngineCommand.ScheduleTask(
                    nextTaskId,
                    taskDef.taskType().name(),
                    refName,
                    taskDef.domain(),
                    existing.inputData(),
                    nextAttempt,
                    nextVisibleAtEpochMs,
                    responseTimeoutMs
                );
                return NodeEvaluationResult.scheduled(List.of(retryCmd));
            } else {
                // Permanent failure
                String reason = "Task '" + refName + "' failed permanently after attempt " + existing.attempt()
                    + ": " + (existing.errorMessage() != null ? existing.errorMessage() : "Timeout/Error");

                EngineCommand.TransitionWorkflow failCmd = new EngineCommand.TransitionWorkflow(
                    WorkflowStatus.FAILED,
                    Collections.emptyMap(),
                    reason
                );
                return NodeEvaluationResult.failed(List.of(failCmd), reason);
            }
        }

        return NodeEvaluationResult.inProgress();
    }
}
