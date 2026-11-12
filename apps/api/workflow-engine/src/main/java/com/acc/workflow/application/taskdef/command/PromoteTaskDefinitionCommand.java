package com.acc.workflow.application.taskdef.command;

import com.acc.core.mediator.Command;

public record PromoteTaskDefinitionCommand(
    String tenantId,
    String name,
    int version,
    String publisher
) implements Command<Void> {
}
