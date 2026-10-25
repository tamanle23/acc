package com.acc.workflow.core.decider;

import com.acc.workflow.core.decider.strategy.NodeEvaluatorStrategy;
import com.acc.workflow.core.expression.ParameterResolver;
import com.acc.workflow.core.model.DecisionResult;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;

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
            String refName = taskDef.taskReferenceName();

            // Check engine-level debugger breakpoints before scheduling an unstarted node
            if (!snapshot.tasksByRef().containsKey(refName) && isBreakpointActive(snapshot, refName)) {
                Map<String, Object> bpOutput = new HashMap<>(aggregatedOutput);
                bpOutput.put("pausedAtNode", refName);
                String reason = "Paused at breakpoint: " + refName;
                accumulatedCommands.add(new EngineCommand.TransitionWorkflow(
                    WorkflowStatus.PAUSED_AT_BREAKPOINT,
                    bpOutput,
                    reason
                ));
                return new DecisionResult(WorkflowStatus.PAUSED_AT_BREAKPOINT, accumulatedCommands, bpOutput, reason);
            }

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
                    } else if (cmd instanceof EngineCommand.UpdateTaskStatus us && us.error() != null) {
                        failureReason = us.error();
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

        // If any strategy emitted an explicit TransitionWorkflow (e.g. TERMINATE), return that decision immediately
        for (EngineCommand cmd : accumulatedCommands) {
            if (cmd instanceof EngineCommand.TransitionWorkflow tw) {
                if (tw.status() == WorkflowStatus.COMPLETED) {
                    return DecisionResult.completed(accumulatedCommands, tw.output() != null ? tw.output() : aggregatedOutput);
                } else if (tw.status() == WorkflowStatus.FAILED) {
                    return DecisionResult.failed(accumulatedCommands, tw.reason());
                } else {
                    return new DecisionResult(tw.status(), accumulatedCommands, tw.output() != null ? tw.output() : aggregatedOutput, tw.reason());
                }
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

    private boolean isBreakpointActive(WorkflowSnapshot snapshot, String refName) {
        Object stepOver = snapshot.variables().getOrDefault("__stepOverNode",
            snapshot.inputPayload() != null ? snapshot.inputPayload().get("__stepOverNode") : null);
        if (refName.equals(stepOver)) {
            return false;
        }
        Object bps = snapshot.variables().getOrDefault("__breakpoints",
            snapshot.inputPayload() != null ? snapshot.inputPayload().get("__breakpoints") : null);
        if (bps instanceof java.util.Collection<?> col) {
            return col.contains(refName);
        }
        return false;
    }
}
