package com.acc.workflow.core.decider.strategy;

import com.acc.workflow.core.expression.ParameterResolver;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * DO_WHILE strategy:
 * Executes enclosed loop tasks iteratively until loopCondition/continueCondition evaluates to false
 * or maximum iteration limit (default: 100) is exceeded.
 * Supports multi-step tasks within each iteration and tracks current iteration attempt.
 */
public final class DoWhileStrategy implements NodeEvaluatorStrategy {

    private static final int DEFAULT_MAX_ITERATIONS = 100;

    @Override
    public NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    ) {
        String refName = taskDef.taskReferenceName();
        TaskSnapshot existing = snapshot.tasksByRef().get(refName);

        int currentIteration = existing != null ? existing.attempt() : 1;

        if (currentIteration > DEFAULT_MAX_ITERATIONS) {
            String reason = "DoWhile loop '" + refName + "' exceeded maximum iteration ceiling (" + DEFAULT_MAX_ITERATIONS + ")";
            EngineCommand.TransitionWorkflow failCmd = new EngineCommand.TransitionWorkflow(
                WorkflowStatus.FAILED,
                Collections.emptyMap(),
                reason
            );
            return NodeEvaluationResult.failed(List.of(failCmd), reason);
        }

        List<TaskDefinition> loopTasks = taskDef.loopOver();
        if (loopTasks == null || loopTasks.isEmpty()) {
            return NodeEvaluationResult.completed(Collections.emptyMap());
        }

        // Check task progression for current iteration
        boolean allCurrentIterTasksComplete = true;
        List<EngineCommand> commands = new ArrayList<>();
        Map<String, Object> iterOutputs = existing != null ? new HashMap<>(existing.outputData()) : new HashMap<>();

        for (int i = 0; i < loopTasks.size(); i++) {
            TaskDefinition lTask = loopTasks.get(i);
            String lRef = lTask.taskReferenceName();
            TaskSnapshot lSnap = snapshot.tasksByRef().get(lRef);

            boolean completedForThisIter = lSnap != null
                && (lSnap.status() == TaskStatus.COMPLETED || lSnap.status() == TaskStatus.SKIPPED)
                && lSnap.attempt() >= currentIteration;

            if (!completedForThisIter) {
                boolean prevComplete = (i == 0);
                if (i > 0) {
                    TaskSnapshot prevSnap = snapshot.tasksByRef().get(loopTasks.get(i - 1).taskReferenceName());
                    prevComplete = prevSnap != null
                        && (prevSnap.status() == TaskStatus.COMPLETED || prevSnap.status() == TaskStatus.SKIPPED)
                        && prevSnap.attempt() >= currentIteration;
                }

                if (prevComplete) {
                    if (lSnap == null || lSnap.attempt() < currentIteration) {
                        String loopTaskId = snapshot.workflowId() + "_" + lRef + "_iter" + currentIteration;
                        Map<String, Object> input = resolver.resolve(lTask.inputParameters(), snapshot);
                        commands.add(new EngineCommand.ScheduleTask(
                            loopTaskId,
                            lTask.taskType().name(),
                            lRef,
                            lTask.domain(),
                            input,
                            currentIteration,
                            nowEpochMs,
                            (long) lTask.timeoutSeconds() * 1000L
                        ));
                    }
                }

                if (lSnap != null && (lSnap.status() == TaskStatus.FAILED || lSnap.status() == TaskStatus.TIMED_OUT)) {
                    String err = "Loop task failed in iteration " + currentIteration + ": " + lRef;
                    return NodeEvaluationResult.failed(Collections.emptyList(), err);
                }

                allCurrentIterTasksComplete = false;
                break;
            } else if (lSnap != null && lSnap.outputData() != null) {
                iterOutputs.putAll(lSnap.outputData());
            }
        }

        if (!allCurrentIterTasksComplete) {
            if (existing == null || existing.attempt() != currentIteration) {
                commands.add(new EngineCommand.UpdateTaskStatus(
                    snapshot.workflowId() + "_" + refName,
                    refName,
                    TaskStatus.IN_PROGRESS,
                    iterOutputs,
                    null
                ));
            }
            return new NodeEvaluationResult(TaskStatus.IN_PROGRESS, commands, iterOutputs, true);
        }

        // All tasks in current iteration are complete: evaluate exit condition
        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
        Object continueCondition = resolvedInput.get("continueCondition");
        if (continueCondition == null && taskDef.loopCondition() != null) {
            continueCondition = resolver.resolveValue(taskDef.loopCondition(), snapshot);
        }

        boolean shouldContinue = continueCondition instanceof Boolean bool
            ? bool : Boolean.parseBoolean(String.valueOf(continueCondition));

        if (!shouldContinue) {
            // Loop finished!
            iterOutputs.put("finalIteration", currentIteration);
            commands.add(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.COMPLETED,
                iterOutputs,
                null
            ));
            return NodeEvaluationResult.completed(iterOutputs);
        }

        // Advance to next iteration
        int nextIteration = currentIteration + 1;
        if (nextIteration > DEFAULT_MAX_ITERATIONS) {
            String reason = "DoWhile loop '" + refName + "' exceeded maximum iteration ceiling (" + DEFAULT_MAX_ITERATIONS + ")";
            EngineCommand.TransitionWorkflow failCmd = new EngineCommand.TransitionWorkflow(
                WorkflowStatus.FAILED,
                Collections.emptyMap(),
                reason
            );
            return NodeEvaluationResult.failed(List.of(failCmd), reason);
        }

        TaskDefinition firstTask = loopTasks.get(0);
        String nextTaskId = snapshot.workflowId() + "_" + firstTask.taskReferenceName() + "_iter" + nextIteration;
        Map<String, Object> firstInput = resolver.resolve(firstTask.inputParameters(), snapshot);
        commands.add(new EngineCommand.ScheduleTask(
            nextTaskId,
            firstTask.taskType().name(),
            firstTask.taskReferenceName(),
            firstTask.domain(),
            firstInput,
            nextIteration,
            nowEpochMs,
            (long) firstTask.timeoutSeconds() * 1000L
        ));

        commands.add(new EngineCommand.UpdateTaskStatus(
            snapshot.workflowId() + "_" + refName,
            refName,
            TaskStatus.IN_PROGRESS,
            iterOutputs,
            null
        ));

        return new NodeEvaluationResult(TaskStatus.IN_PROGRESS, commands, iterOutputs, true);
    }
}
