package com.acc.workflow.application.taskdef.command;

import com.acc.core.mediator.Command;
import com.acc.workflow.domain.taskdef.valobj.TaskDefId;

import java.util.Map;

public record CreateTaskDefinitionCommand(
    String tenantId,
    String name,
    String description,
    int retryCount,
    int retryDelaySeconds,
    double backoffRate,
    int timeoutSeconds,
    Map<String, Object> inputSchema,
    Map<String, Object> outputSchema,
    Map<String, Object> executionContract,
    String changelogNote,
    String author
) implements Command<TaskDefId> {
}
