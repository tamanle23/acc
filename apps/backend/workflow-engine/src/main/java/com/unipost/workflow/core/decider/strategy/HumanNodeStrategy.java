package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * HUMAN system task:
 * Implements manual approval gates.
 * When first encountered, it transitions to IN_PROGRESS and halts progression.
 * It does NOT schedule worker queue leases since it expects a human action (via API/UI).
 * Once completed externally (via TaskStatus.COMPLETED or SKIPPED), it unblocks progression.
 */
public final class HumanNodeStrategy implements NodeEvaluatorStrategy {

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
            // First encounter: transition to WAITING_FOR_APPROVAL and wait for human review
            String taskId = snapshot.workflowId() + "_" + refName;
            Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);

            List<EngineCommand> commands = new ArrayList<>();
            // Save task directly in WAITING_FOR_APPROVAL state without worker lease polling
            commands.add(new EngineCommand.UpdateTaskStatus(
                taskId,
                refName,
                TaskStatus.WAITING_FOR_APPROVAL,
                resolvedInput,
                null
            ));

            return new NodeEvaluationResult(TaskStatus.WAITING_FOR_APPROVAL, commands, Collections.emptyMap(), true);
        }

        TaskStatus status = existing.status();
        if (status == TaskStatus.COMPLETED) {
            return NodeEvaluationResult.completed(existing.outputData());
        } else if (status == TaskStatus.SKIPPED) {
            return NodeEvaluationResult.skipped();
        } else if (status == TaskStatus.FAILED) {
            return NodeEvaluationResult.failed(Collections.emptyList(), existing.errorMessage());
        }

        // Still waiting for human approval
        return NodeEvaluationResult.inProgress();
    }
}
