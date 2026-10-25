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
 * Chooses matching branch tasks or defaultCase tasks, scheduling them and completing the switch.
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

        if (existing == null) {
            // First time evaluating switch node: schedule first task of selected branch or complete if empty
            List<EngineCommand> commands = new ArrayList<>();
            Map<String, Object> switchOutput = new HashMap<>();
            switchOutput.put("selectedCase", caseKey != null ? caseKey : "none");

            // Mark the SWITCH node itself as COMPLETED immediately, recording selectedCase
            commands.add(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.COMPLETED,
                switchOutput,
                null
            ));

            if (selectedBranch != null && !selectedBranch.isEmpty()) {
                TaskDefinition firstBranchTask = selectedBranch.get(0);
                String branchTaskId = snapshot.workflowId() + "_" + firstBranchTask.taskReferenceName() + "_att1";
                Map<String, Object> branchInput = resolver.resolve(firstBranchTask.inputParameters(), snapshot);

                commands.add(new EngineCommand.ScheduleTask(
                    branchTaskId,
                    firstBranchTask.taskType().name(),
                    firstBranchTask.taskReferenceName(),
                    firstBranchTask.domain(),
                    branchInput,
                    1,
                    nowEpochMs,
                    (long) firstBranchTask.timeoutSeconds() * 1000L
                ));
                return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, switchOutput, true);
            }

            return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, switchOutput, false);
        }

        return NodeEvaluationResult.completed(existing.outputData());
    }
}
