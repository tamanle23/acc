package com.acc.workflow.application.taskdef.port.in;

import com.acc.workflow.application.taskdef.command.CreateTaskDefinitionCommand;
import com.acc.workflow.domain.taskdef.valobj.TaskDefId;

public interface CreateTaskDefinitionUseCase {

    TaskDefId createOrForkDraft(CreateTaskDefinitionCommand command);
}
