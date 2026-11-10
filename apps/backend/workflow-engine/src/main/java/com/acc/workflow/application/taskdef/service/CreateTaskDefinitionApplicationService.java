package com.acc.workflow.application.taskdef.service;

import com.acc.workflow.application.taskdef.command.CreateTaskDefinitionCommand;
import com.acc.workflow.application.taskdef.port.in.CreateTaskDefinitionUseCase;
import com.acc.workflow.domain.taskdef.model.TaskDefinitionAggregate;
import com.acc.workflow.domain.taskdef.repository.TaskDefinitionRepositoryPort;
import com.acc.workflow.domain.taskdef.valobj.TaskDefId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Application Service / Driving Port Implementation for creating or forking task definition drafts.
 */
@Service
public class CreateTaskDefinitionApplicationService implements CreateTaskDefinitionUseCase {

    private final TaskDefinitionRepositoryPort repositoryPort;

    public CreateTaskDefinitionApplicationService(TaskDefinitionRepositoryPort repositoryPort) {
        this.repositoryPort = repositoryPort;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED, isolation = Isolation.READ_COMMITTED, rollbackFor = Exception.class)
    public TaskDefId createOrForkDraft(CreateTaskDefinitionCommand command) {
        String effectiveTenant = (command.tenantId() != null && !command.tenantId().isBlank()) ? command.tenantId() : "system";
        Optional<TaskDefinitionAggregate> latestOpt = repositoryPort.findLatestByName(effectiveTenant, command.name());

        long now = System.currentTimeMillis();
        TaskDefinitionAggregate draft = TaskDefinitionAggregate.hardForkNewDraft(
            latestOpt.orElse(null),
            effectiveTenant,
            command.name(),
            command.description(),
            command.retryCount(),
            command.retryDelaySeconds(),
            command.backoffRate(),
            command.timeoutSeconds(),
            command.inputSchema(),
            command.outputSchema(),
            command.executionContract(),
            command.changelogNote(),
            now
        );

        repositoryPort.save(draft);
        return draft.getId();
    }
}
