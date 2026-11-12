package com.acc.workflow.application.taskdef.service;

import com.acc.core.domain.exception.EntityNotFoundException;
import com.acc.workflow.application.taskdef.command.PromoteTaskDefinitionCommand;
import com.acc.workflow.application.taskdef.port.in.PromoteTaskDefinitionUseCase;
import com.acc.workflow.domain.taskdef.model.TaskDefinitionAggregate;
import com.acc.workflow.domain.taskdef.repository.TaskDefinitionRepositoryPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Application Service / Driving Port Implementation for promoting task definition drafts to active.
 */
@Service
public class PromoteTaskDefinitionApplicationService implements PromoteTaskDefinitionUseCase {

    private final TaskDefinitionRepositoryPort repositoryPort;

    public PromoteTaskDefinitionApplicationService(TaskDefinitionRepositoryPort repositoryPort) {
        this.repositoryPort = repositoryPort;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED, isolation = Isolation.READ_COMMITTED, rollbackFor = Exception.class)
    public void promoteToActive(PromoteTaskDefinitionCommand command) {
        String effectiveTenant = (command.tenantId() != null && !command.tenantId().isBlank()) ? command.tenantId() : "system";
        TaskDefinitionAggregate target = repositoryPort.findByNameAndVersion(effectiveTenant, command.name(), command.version())
            .orElseThrow(() -> new EntityNotFoundException(
                "Task definition not found: " + command.name() + " v" + command.version() + " for tenant " + effectiveTenant
            ));

        long now = System.currentTimeMillis();

        // Enforce single active version invariant across all other versions
        repositoryPort.deprecateActiveVersionsExcept(effectiveTenant, command.name(), target.getId(), now);

        // Mutate pure domain aggregate
        target.promoteToActive(now);

        // Persist via driven secondary port
        repositoryPort.save(target);
    }
}
