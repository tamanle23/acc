package com.acc.workflow.core.decider.strategy;

import com.acc.workflow.core.expression.ParameterResolver;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * FORK_JOIN strategy:
 * Concurrently schedules all initial tasks of each fork branch.
 * If joinOn is defined, enforces a fan-in barrier: blocks until all specified
 * joinOn prerequisite tasks have reached COMPLETED.
 */
public final class ForkJoinStrategy implements NodeEvaluatorStrategy {

    @Override
    public NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    ) {
        String refName = taskDef.taskReferenceName();
        TaskSnapshot existing = snapshot.tasksByRef().get(refName);

        // Check if this node is acting as a JOIN barrier
        if (taskDef.joinOn() != null && !taskDef.joinOn().isEmpty()) {
            boolean allJoinedComplete = true;
            Map<String, Object> aggregatedJoinOutput = new HashMap<>();

            for (String prerequisiteRef : taskDef.joinOn()) {
                TaskSnapshot prereq = snapshot.tasksByRef().get(prerequisiteRef);
                if (prereq == null || prereq.status() != TaskStatus.COMPLETED) {
                    allJoinedComplete = false;
                    break;
                } else {
                    aggregatedJoinOutput.put(prerequisiteRef, prereq.outputData());
                }
            }

            if (!allJoinedComplete) {
                // Barrier not yet satisfied; wait
                return NodeEvaluationResult.inProgress();
            }

            // All branches completed! Complete the JOIN node
            List<EngineCommand> commands = new ArrayList<>();
            if (existing == null || existing.status() != TaskStatus.COMPLETED) {
                commands.add(new EngineCommand.UpdateTaskStatus(
                    snapshot.workflowId() + "_" + refName,
                    refName,
                    TaskStatus.COMPLETED,
                    aggregatedJoinOutput,
                    null
                ));
            }
            return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, aggregatedJoinOutput, false);
        }

        // Otherwise this is a FORK node: schedule the first task of every parallel branch
        if (existing == null) {
            List<EngineCommand> commands = new ArrayList<>();
            Map<String, Object> forkOutput = new HashMap<>();
            int branchCount = 0;

            if (taskDef.forkTasks() != null) {
                for (List<TaskDefinition> branch : taskDef.forkTasks()) {
                    if (branch != null && !branch.isEmpty()) {
                        TaskDefinition firstTask = branch.get(0);
                        String branchTaskId = snapshot.workflowId() + "_" + firstTask.taskReferenceName() + "_att1";
                        Map<String, Object> input = resolver.resolve(firstTask.inputParameters(), snapshot);

                        commands.add(new EngineCommand.ScheduleTask(
                            branchTaskId,
                            firstTask.taskType().name(),
                            firstTask.taskReferenceName(),
                            firstTask.domain(),
                            input,
                            1,
                            nowEpochMs,
                            (long) firstTask.timeoutSeconds() * 1000L
                        ));
                        branchCount++;
                    }
                }
            }

            forkOutput.put("forkedBranches", branchCount);
            commands.add(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.COMPLETED,
                forkOutput,
                null
            ));

            return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, forkOutput, false);
        }

        return NodeEvaluationResult.completed(existing.outputData());
    }
}
