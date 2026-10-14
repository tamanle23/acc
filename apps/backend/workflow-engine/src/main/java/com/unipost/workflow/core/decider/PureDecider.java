package com.unipost.workflow.core.decider;

import com.unipost.workflow.core.model.DecisionResult;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
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
 * It strictly adheres to:
 * 1. Zero I/O (no JDBC, network, thread pools, Spring beans).
 * 2. Deterministic execution: accepts explicitly passed nowEpochMs and generates deterministic task IDs.
 * 3. Open/Closed pattern ready for Phase 27 node strategy dispatch.
 */
public final class PureDecider {

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

        List<EngineCommand> commands = new ArrayList<>();
        List<TaskDefinition> tasks = definition.tasks();

        boolean allCompleted = true;
        boolean hasRunningOrScheduled = false;

        for (int i = 0; i < tasks.size(); i++) {
            TaskDefinition taskDef = tasks.get(i);
            String refName = taskDef.taskReferenceName();
            TaskSnapshot existingTask = snapshot.tasksByRef().get(refName);

            if (existingTask == null) {
                // Task has not been scheduled yet.
                // In linear dependency, can only schedule if all preceding tasks are COMPLETED.
                if (allCompleted) {
                    // Generate deterministic task ID: {workflowId}_{refName}_att1
                    String deterministicTaskId = snapshot.workflowId() + "_" + refName + "_att1";
                    long responseTimeoutMs = (long) taskDef.timeoutSeconds() * 1000L;

                    commands.add(new EngineCommand.ScheduleTask(
                        deterministicTaskId,
                        taskDef.taskType().name(),
                        refName,
                        taskDef.domain(),
                        resolveTaskInput(taskDef.inputParameters(), snapshot),
                        1,
                        nowEpochMs,
                        responseTimeoutMs
                    ));
                    hasRunningOrScheduled = true;
                }
                allCompleted = false;
                break; // Stop progressing further down the line until this task runs
            } else {
                TaskStatus status = existingTask.status();

                if (status == TaskStatus.FAILED || status == TaskStatus.TIMED_OUT) {
                    // Check retry count
                    if (existingTask.attempt() < taskDef.retryCount()) {
                        int nextAttempt = existingTask.attempt() + 1;
                        String nextTaskId = snapshot.workflowId() + "_" + refName + "_att" + nextAttempt;
                        long backoffDelayMs = (long) (taskDef.retryDelaySeconds() * Math.pow(taskDef.backoffRate(), existingTask.attempt() - 1)) * 1000L;
                        long nextVisibleAtEpochMs = nowEpochMs + backoffDelayMs;
                        long responseTimeoutMs = (long) taskDef.timeoutSeconds() * 1000L;

                        commands.add(new EngineCommand.ScheduleTask(
                            nextTaskId,
                            taskDef.taskType().name(),
                            refName,
                            taskDef.domain(),
                            existingTask.inputData(),
                            nextAttempt,
                            nextVisibleAtEpochMs,
                            responseTimeoutMs
                        ));
                        hasRunningOrScheduled = true;
                        allCompleted = false;
                        break;
                    } else {
                        // Exhausted retries -> Terminal Failure
                        String reason = "Task '" + refName + "' failed permanently after attempt " + existingTask.attempt()
                            + ": " + (existingTask.errorMessage() != null ? existingTask.errorMessage() : "Timeout/Error");

                        commands.add(new EngineCommand.TransitionWorkflow(
                            WorkflowStatus.FAILED,
                            Collections.emptyMap(),
                            reason
                        ));
                        return DecisionResult.failed(commands, reason);
                    }
                } else if (status == TaskStatus.SCHEDULED || status == TaskStatus.IN_PROGRESS) {
                    hasRunningOrScheduled = true;
                    allCompleted = false;
                    break;
                } else if (status == TaskStatus.COMPLETED || status == TaskStatus.SKIPPED) {
                    // Proceed to inspect subsequent task
                    continue;
                }
            }
        }

        if (allCompleted && !tasks.isEmpty()) {
            // Aggregate output from the last task (or all completed tasks)
            Map<String, Object> finalOutput = new HashMap<>();
            for (TaskDefinition taskDef : tasks) {
                TaskSnapshot snap = snapshot.tasksByRef().get(taskDef.taskReferenceName());
                if (snap != null && snap.outputData() != null) {
                    finalOutput.putAll(snap.outputData());
                }
            }
            commands.add(new EngineCommand.TransitionWorkflow(
                WorkflowStatus.COMPLETED,
                finalOutput,
                null
            ));
            return DecisionResult.completed(commands, finalOutput);
        }

        return DecisionResult.continueRunning(commands);
    }

    private Map<String, Object> resolveTaskInput(
        Map<String, Object> declaredInputs,
        WorkflowSnapshot snapshot
    ) {
        if (declaredInputs == null || declaredInputs.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Object> resolved = new HashMap<>(declaredInputs);
        // Phase 27 will wire the full ParameterResolver here; base map is preserved for now
        return Collections.unmodifiableMap(resolved);
    }
}
