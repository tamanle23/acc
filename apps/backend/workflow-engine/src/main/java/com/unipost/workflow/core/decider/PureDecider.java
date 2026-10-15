package com.unipost.workflow.core.decider;

import com.unipost.workflow.core.decider.strategy.NodeEvaluatorStrategy;
import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.DecisionResult;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * PureDecider is the 100% pure, deterministic, zero-I/O state machine evaluator.
 * It delegates task evaluation to NodeStrategyRegistry adhering strictly to:
 * 1. Zero I/O (no JDBC, network, thread pools, Spring beans).
 * 2. Strategy + Registry pattern (Open/Closed principle).
 * 3. Deterministic parameter resolution via ParameterResolver.
 */
public final class PureDecider {

    private final NodeStrategyRegistry strategyRegistry;
    private final ParameterResolver parameterResolver;

    public PureDecider() {
        this(new NodeStrategyRegistry(), new ParameterResolver());
    }

    public PureDecider(NodeStrategyRegistry strategyRegistry, ParameterResolver parameterResolver) {
        this.strategyRegistry = strategyRegistry;
        this.parameterResolver = parameterResolver;
    }

    public DecisionResult decide(
        WorkflowDefinition definition,
        WorkflowSnapshot snapshot,
        long nowEpochMs
    ) {
        if (definition == null) {
            throw new IllegalArgumentException("definition cannot be null");
        }
        if (snapshot == null) {
            throw new IllegalArgumentException("snapshot cannot be null");
        }

        // If workflow is already terminal, no further decisions needed
        if (snapshot.status().isTerminal()) {
            return new DecisionResult(snapshot.status(), Collections.emptyList(), snapshot.outputPayload(), snapshot.failureReason());
        }

        List<EngineCommand> accumulatedCommands = new ArrayList<>();
        List<TaskDefinition> tasks = definition.tasks();

        boolean allCompleted = true;
        Map<String, Object> aggregatedOutput = new HashMap<>();

        for (int i = 0; i < tasks.size(); i++) {
            TaskDefinition taskDef = tasks.get(i);
            NodeEvaluatorStrategy strategy = strategyRegistry.get(taskDef.taskType());

            NodeEvaluatorStrategy.NodeEvaluationResult result = strategy.evaluate(
                taskDef, snapshot, nowEpochMs, parameterResolver
            );

            accumulatedCommands.addAll(result.commands());

            if (result.nodeStatus() == TaskStatus.FAILED) {
                // Task failed permanently
                String failureReason = "Workflow execution failed at node: " + taskDef.taskReferenceName();
                for (EngineCommand cmd : result.commands()) {
                    if (cmd instanceof EngineCommand.TransitionWorkflow tw && tw.reason() != null) {
                        failureReason = tw.reason();
                        break;
                    }
                }
                return DecisionResult.failed(accumulatedCommands, failureReason);
            }

            if (result.nodeStatus() == TaskStatus.COMPLETED) {
                if (result.output() != null && !result.output().isEmpty()) {
                    aggregatedOutput.putAll(result.output());
                }
                // Record the completed task into tasksByRef so downstream tasks in the same pass can reference its output
                Map<String, TaskSnapshot> updatedTasks = new HashMap<>(snapshot.tasksByRef());
                TaskSnapshot completedTaskSnap = new TaskSnapshot(
                    snapshot.workflowId() + "_" + taskDef.taskReferenceName(),
                    taskDef.taskReferenceName(),
                    taskDef.taskType(),
                    taskDef.domain(),
                    TaskStatus.COMPLETED,
                    1,
                    taskDef.inputParameters(),
                    result.output() != null ? result.output() : Collections.emptyMap(),
                    null,
                    nowEpochMs,
                    0L,
                    null
                );
                updatedTasks.put(taskDef.taskReferenceName(), completedTaskSnap);

                Map<String, Object> updatedVars = snapshot.variables();
                if (taskDef.taskType() == TaskType.SET_VARIABLE && result.output() != null) {
                    updatedVars = new HashMap<>(snapshot.variables());
                    updatedVars.putAll(result.output());
                }

                snapshot = new WorkflowSnapshot(
                    snapshot.workflowId(), snapshot.tenantId(), snapshot.workspaceId(),
                    snapshot.workflowKey(), snapshot.version(), snapshot.status(),
                    snapshot.inputPayload(), aggregatedOutput, updatedVars,
                    snapshot.failureReason(), updatedTasks
                );
            } else if (result.nodeStatus() != TaskStatus.SKIPPED) {
                allCompleted = false;
            }

            if (result.shouldHaltProgression()) {
                allCompleted = false;
                break;
            }
        }

        // A workflow cannot be completed if any task was scheduled in this decision pass
        boolean hasScheduledTasks = accumulatedCommands.stream()
            .anyMatch(c -> c instanceof EngineCommand.ScheduleTask);

        if (allCompleted && !hasScheduledTasks && !tasks.isEmpty()) {
            accumulatedCommands.add(new EngineCommand.TransitionWorkflow(
                WorkflowStatus.COMPLETED,
                aggregatedOutput,
                null
            ));
            return DecisionResult.completed(accumulatedCommands, aggregatedOutput);
        }

        return DecisionResult.continueRunning(accumulatedCommands);
    }
}
