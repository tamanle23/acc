package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;

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
