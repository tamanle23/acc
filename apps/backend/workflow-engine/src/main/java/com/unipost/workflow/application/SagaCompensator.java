package com.unipost.workflow.application;

import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * SagaCompensator executes reverse topological compensation.
 * When a workflow encounters an unrecoverable failure, this orchestrator identifies
 * all successfully completed tasks that define a 'compensateHandlerRef', sorts them
 * in reverse completion order, and constructs the corresponding compensation ScheduleTask commands.
 */
public final class SagaCompensator {

    private static final Logger log = LoggerFactory.getLogger(SagaCompensator.class);

    public record CompensationPlan(
        String workflowId,
        String failureReason,
        List<CompensationStep> steps
    ) {}

    public record CompensationStep(
        String originalTaskId,
        String originalReferenceName,
        String compensateTaskType,
        Map<String, Object> compensationInput
    ) {}

    /**
     * Computes the list of compensation commands to run for a failed workflow.
     * The tasks are evaluated in reverse order of definition execution.
     */
    public List<EngineCommand.ScheduleTask> planCompensation(
        WorkflowDefinition definition,
        WorkflowSnapshot snapshot,
        long nowEpochMs
    ) {
        Objects.requireNonNull(definition, "definition required");
        Objects.requireNonNull(snapshot, "snapshot required");

        List<EngineCommand.ScheduleTask> compensationCommands = new ArrayList<>();

        // Iterate in reverse topological/execution order
        for (int i = definition.tasks().size() - 1; i >= 0; i--) {
            TaskDefinition taskDef = definition.tasks().get(i);
            TaskSnapshot executedSnapshot = snapshot.tasksByRef().get(taskDef.taskReferenceName());

            if (executedSnapshot != null && executedSnapshot.status() == TaskStatus.COMPLETED) {
                if (taskDef.compensateHandlerRef() != null && !taskDef.compensateHandlerRef().isBlank()) {
                    String compTaskId = snapshot.workflowId() + "_" + taskDef.taskReferenceName() + "_compensate";
                    Map<String, Object> compInput = new HashMap<>(taskDef.inputParameters());
                    compInput.put("_originalOutput", executedSnapshot.outputData());
                    compInput.put("_originalTaskId", executedSnapshot.taskId());

                    log.info("Scheduling compensation task: {} for original task: {}", compTaskId, executedSnapshot.taskId());

                    compensationCommands.add(new EngineCommand.ScheduleTask(
                        compTaskId,
                        taskDef.compensateHandlerRef(),
                        taskDef.taskReferenceName() + "_COMPENSATE",
                        taskDef.domain(),
                        compInput,
                        1,
                        nowEpochMs,
                        (long) taskDef.timeoutSeconds() * 1000L
                    ));
                }
            }
        }

        return Collections.unmodifiableList(compensationCommands);
    }
}
