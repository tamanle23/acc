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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * END_WORKFLOW canonical exit boundary:
 * 1. Acts as a fan-in barrier if joinOn is configured, ensuring all converging branches complete.
 * 2. Resolves final workflow outputs from inputParameters mappings.
 * 3. Transitions workflow status to COMPLETED.
 */
public final class EndWorkflowStrategy implements NodeEvaluatorStrategy {

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
            }
        }

        // 1. Fan-in Barrier: Check that all prerequisite tasks in joinOn are completed
        if (taskDef.joinOn() != null && !taskDef.joinOn().isEmpty()) {
            for (String prereqRef : taskDef.joinOn()) {
                TaskSnapshot prereq = snapshot.tasksByRef().get(prereqRef);
                if (prereq == null || (prereq.status() != TaskStatus.COMPLETED && prereq.status() != TaskStatus.SKIPPED)) {
                    // Upstream branches still in flight; hold execution
                    return NodeEvaluationResult.inProgress();
                }
            }
        }

        // 2. Resolve output mappings from inputParameters (if defined, strictly use them; otherwise fall back to outputPayload)
        Map<String, Object> resolvedOutput = new LinkedHashMap<>();
        if (taskDef.inputParameters() != null && !taskDef.inputParameters().isEmpty()) {
            Map<String, Object> resolved = resolver.resolve(taskDef.inputParameters(), snapshot);
            resolvedOutput.putAll(resolved);
        } else if (snapshot.outputPayload() != null) {
            resolvedOutput.putAll(snapshot.outputPayload());
        }

        // 3. Strict Exit Gate: Validate resolved output against outputSchema if defined
        if (taskDef.outputSchema() != null && !taskDef.outputSchema().isEmpty()) {
            com.acc.workflow.core.schema.WorkflowSchemaValidator validator = new com.acc.workflow.core.schema.WorkflowSchemaValidator();
            List<com.acc.workflow.core.schema.WorkflowSchemaValidator.ValidationError> validationErrors = validator.validate(resolvedOutput, taskDef.outputSchema());
            if (!validationErrors.isEmpty()) {
                String errorMsg = "Workflow output violates outputSchema: " + validationErrors.get(0).message();
                List<EngineCommand> failCmds = List.of(
                    new EngineCommand.UpdateTaskStatus(
                        snapshot.workflowId() + "_" + refName,
                        refName,
                        TaskStatus.FAILED,
                        resolvedOutput,
                        errorMsg
                    ),
                    new EngineCommand.TransitionWorkflow(
                        WorkflowStatus.FAILED,
                        resolvedOutput,
                        errorMsg
                    )
                );
                return NodeEvaluationResult.failed(failCmds, errorMsg);
            }
        }

        List<EngineCommand> commands = new ArrayList<>();
        commands.add(new EngineCommand.UpdateTaskStatus(
            snapshot.workflowId() + "_" + refName,
            refName,
            TaskStatus.COMPLETED,
            resolvedOutput,
            null
        ));
        commands.add(new EngineCommand.TransitionWorkflow(
            WorkflowStatus.COMPLETED,
            resolvedOutput,
            "Workflow reached canonical END_WORKFLOW exit boundary"
        ));

        return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, resolvedOutput, false);
    }
}
