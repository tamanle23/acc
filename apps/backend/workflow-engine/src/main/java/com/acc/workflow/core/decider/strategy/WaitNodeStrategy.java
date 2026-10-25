package com.acc.workflow.core.decider.strategy;

import com.acc.workflow.core.expression.ParameterResolver;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * WAIT node strategy:
 * Pauses execution until:
 * 1. An absolute timestamp `waitUntilEpochMs` is reached (or `waitDurationSeconds` has elapsed), OR
 * 2. An external signal/webhook marks the task COMPLETED.
 */
public final class WaitNodeStrategy implements NodeEvaluatorStrategy {

    @Override
    public NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    ) {
        String refName = taskDef.taskReferenceName();
        TaskSnapshot existing = snapshot.tasksByRef().get(refName);

        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);

        if (existing == null) {
            // First encounter: schedule or immediately evaluate wait conditions
            long waitUntilEpochMs = extractWaitUntil(resolvedInput, nowEpochMs);

            if (nowEpochMs >= waitUntilEpochMs) {
                // Wait time already satisfied: complete immediately
                List<EngineCommand> commands = new ArrayList<>();
                commands.add(new EngineCommand.UpdateTaskStatus(
                    snapshot.workflowId() + "_" + refName,
                    refName,
                    TaskStatus.COMPLETED,
                    Map.of("waitedUntilEpochMs", waitUntilEpochMs),
                    null
                ));
                return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, Map.of("waitedUntilEpochMs", waitUntilEpochMs), false);
            } else {
                // Must wait: schedule with visibleAtEpochMs set into the future
                String taskId = snapshot.workflowId() + "_" + refName + "_wait";
                EngineCommand.ScheduleTask waitCmd = new EngineCommand.ScheduleTask(
                    taskId,
                    taskDef.taskType().name(),
                    refName,
                    taskDef.domain(),
                    resolvedInput,
                    1,
                    waitUntilEpochMs,
                    86400000L // 24h safety timeout
                );
                return NodeEvaluationResult.scheduled(List.of(waitCmd));
            }
        }

        if (existing.status() == TaskStatus.COMPLETED) {
            return NodeEvaluationResult.completed(existing.outputData());
        }

        // Check if wait duration has now elapsed
        long waitUntilEpochMs = extractWaitUntil(resolvedInput, existing.visibleAtEpochMs());
        if (nowEpochMs >= waitUntilEpochMs) {
            List<EngineCommand> commands = new ArrayList<>();
            commands.add(new EngineCommand.UpdateTaskStatus(
                existing.taskId(),
                refName,
                TaskStatus.COMPLETED,
                Map.of("waitedUntilEpochMs", waitUntilEpochMs),
                null
            ));
            return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, Map.of("waitedUntilEpochMs", waitUntilEpochMs), false);
        }

        return NodeEvaluationResult.inProgress();
    }

    private long extractWaitUntil(Map<String, Object> input, long fallbackEpochMs) {
        if (input.containsKey("waitUntilEpochMs")) {
            Object val = input.get("waitUntilEpochMs");
            if (val instanceof Number num) {
                return num.longValue();
            }
        }
        if (input.containsKey("durationSeconds")) {
            Object val = input.get("durationSeconds");
            if (val instanceof Number num) {
                return fallbackEpochMs + (num.longValue() * 1000L);
            }
        }
        return fallbackEpochMs;
    }
}
