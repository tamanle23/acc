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
 * EXCLUSIVE_JOIN operator:
 * Fan-in barrier that unblocks as soon as the FIRST of its joinOn prerequisite tasks completes.
 * If at least one prerequisite is COMPLETED, EXCLUSIVE_JOIN completes with that winning output.
 * If all prerequisites fail, EXCLUSIVE_JOIN fails.
 */
public final class ExclusiveJoinStrategy implements NodeEvaluatorStrategy {

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

        List<String> joinOn = taskDef.joinOn();
        if (joinOn == null || joinOn.isEmpty()) {
            // Nothing to join, complete immediately
            return NodeEvaluationResult.completed(Collections.emptyMap());
        }

        boolean anyCompleted = false;
        String winningRef = null;
        Map<String, Object> winningOutput = null;
        int failedCount = 0;

        for (String prereqRef : joinOn) {
            TaskSnapshot prereq = snapshot.tasksByRef().get(prereqRef);
            if (prereq != null) {
                if (prereq.status() == TaskStatus.COMPLETED) {
                    anyCompleted = true;
                    winningRef = prereqRef;
                    winningOutput = prereq.outputData();
                    break;
                } else if (prereq.status() == TaskStatus.FAILED || prereq.status() == TaskStatus.TIMED_OUT) {
                    failedCount++;
                }
            }
        }

        if (anyCompleted) {
            Map<String, Object> output = new HashMap<>();
            output.put("winningBranch", winningRef);
            if (winningOutput != null) {
                output.putAll(winningOutput);
            }

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

        if (failedCount == joinOn.size()) {
            // All branches failed
            String errorMsg = "All exclusive join branches failed";
            List<EngineCommand> commands = new ArrayList<>();
            commands.add(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.FAILED,
                Collections.emptyMap(),
                errorMsg
            ));
            return NodeEvaluationResult.failed(commands, errorMsg);
        }

        // Waiting for the first branch to complete
        return NodeEvaluationResult.inProgress();
    }
}
