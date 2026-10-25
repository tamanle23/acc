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
 * Executes enclosed loop tasks iteratively until loopCondition evaluates to false
 * or maximum iteration limit (default: 100) is exceeded.
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

        // Check if loop condition is satisfied
        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
        Object continueCondition = resolvedInput.get("continueCondition");
        boolean shouldContinue = continueCondition instanceof Boolean bool ? bool : Boolean.parseBoolean(String.valueOf(continueCondition));

        if (!shouldContinue && existing != null) {
            // Loop completed!
            Map<String, Object> output = new HashMap<>(existing.outputData());
            output.put("finalIteration", currentIteration);
            return NodeEvaluationResult.completed(output);
        }

        // Schedule loop tasks
        List<EngineCommand> commands = new ArrayList<>();
        if (taskDef.loopOver() != null && !taskDef.loopOver().isEmpty()) {
            TaskDefinition firstLoopTask = taskDef.loopOver().get(0);
            String loopTaskId = snapshot.workflowId() + "_" + firstLoopTask.taskReferenceName() + "_iter" + currentIteration;
            Map<String, Object> input = resolver.resolve(firstLoopTask.inputParameters(), snapshot);

            commands.add(new EngineCommand.ScheduleTask(
                loopTaskId,
                firstLoopTask.taskType().name(),
                firstLoopTask.taskReferenceName(),
                firstLoopTask.domain(),
                input,
                currentIteration,
                nowEpochMs,
                (long) firstLoopTask.timeoutSeconds() * 1000L
            ));
        }

        return NodeEvaluationResult.scheduled(commands);
    }
}
