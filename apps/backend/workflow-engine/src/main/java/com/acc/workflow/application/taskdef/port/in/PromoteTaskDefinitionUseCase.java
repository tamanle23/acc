package com.acc.workflow.application.taskdef.port.in;

import com.acc.workflow.application.taskdef.command.PromoteTaskDefinitionCommand;

public interface PromoteTaskDefinitionUseCase {

    void promoteToActive(PromoteTaskDefinitionCommand command);
}
