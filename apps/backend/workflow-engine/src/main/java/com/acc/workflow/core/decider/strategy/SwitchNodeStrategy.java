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
 * SWITCH node strategy:
 * Evaluates a condition/case expression (from inputParameters or decisionCases key).
 * Chooses matching branch tasks or defaultCase tasks, scheduling them sequentially
 * across multiple steps within the branch until the branch is completed.
 */
public final class SwitchNodeStrategy implements NodeEvaluatorStrategy {

    @Override
    public NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    ) {
        String refName = taskDef.taskReferenceName();
        TaskSnapshot existing = snapshot.tasksByRef().get(refName);

        // Resolve switch case key: e.g. input parameter "caseExpression"
        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
        Object rawCase = resolvedInput.get("caseExpression");
        String caseKey = rawCase != null ? String.valueOf(rawCase).trim() : null;

        List<TaskDefinition> selectedBranch = null;
        if (caseKey != null && taskDef.decisionCases().containsKey(caseKey)) {
            selectedBranch = taskDef.decisionCases().get(caseKey);
        } else if (taskDef.defaultCase() != null && !taskDef.defaultCase().isEmpty()) {
            selectedBranch = taskDef.defaultCase();
            caseKey = "default";
        }

        Map<String, Object> switchOutput = existing != null ? new HashMap<>(existing.outputData()) : new HashMap<>();
        switchOutput.put("selectedCase", caseKey != null ? caseKey : "none");

        List<EngineCommand> commands = new ArrayList<>();
        if (existing == null) {
            commands.add(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.COMPLETED,
                switchOutput,
                null
            ));
        }

        if (selectedBranch != null && !selectedBranch.isEmpty()) {
            for (int b = 0; b < selectedBranch.size(); b++) {
                TaskDefinition bTask = selectedBranch.get(b);
                TaskSnapshot bSnap = snapshot.tasksByRef().get(bTask.taskReferenceName());

                if (bSnap == null) {
                    boolean shouldSchedule = false;
                    if (b == 0) {
                        shouldSchedule = (existing == null);
                    } else {
                        TaskSnapshot prevSnap = snapshot.tasksByRef().get(selectedBranch.get(b - 1).taskReferenceName());
                        shouldSchedule = prevSnap != null && (prevSnap.status() == TaskStatus.COMPLETED || prevSnap.status() == TaskStatus.SKIPPED);
                    }

                    if (shouldSchedule) {
                        String branchTaskId = snapshot.workflowId() + "_" + bTask.taskReferenceName() + "_att1";
                        Map<String, Object> input = resolver.resolve(bTask.inputParameters(), snapshot);
                        commands.add(new EngineCommand.ScheduleTask(
                            branchTaskId,
                            bTask.taskType().name(),
                            bTask.taskReferenceName(),
                            bTask.domain(),
                            input,
                            1,
                            nowEpochMs,
                            (long) bTask.timeoutSeconds() * 1000L
                        ));
                    }

                    return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, switchOutput, true);
                } else if (bSnap.status() == TaskStatus.IN_PROGRESS || bSnap.status() == TaskStatus.SCHEDULED) {
                    return NodeEvaluationResult.inProgress();
                } else if (bSnap.status() == TaskStatus.FAILED || bSnap.status() == TaskStatus.TIMED_OUT) {
                    return NodeEvaluationResult.failed(Collections.emptyList(), bSnap.errorMessage());
                }
                // bSnap is COMPLETED or SKIPPED -> check next task in selectedBranch
            }
        }

        return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, switchOutput, false);
    }
}
