package com.acc.worker.application.saga.service;

import com.acc.worker.application.saga.ports.in.AdvanceUserSagaUseCase;
import com.acc.worker.domain.saga.model.SagaInstanceAggregate;
import com.acc.worker.domain.saga.repository.SagaStateRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Application Service orchestrating distributed User Registration Sagas.
 */
@Service
public class UserRegistrationSagaApplicationService implements AdvanceUserSagaUseCase {

    private static final Logger log = LoggerFactory.getLogger(UserRegistrationSagaApplicationService.class);

    private final SagaStateRepositoryPort sagaStateRepositoryPort;

    public UserRegistrationSagaApplicationService(SagaStateRepositoryPort sagaStateRepositoryPort) {
        this.sagaStateRepositoryPort = sagaStateRepositoryPort;
    }

    @Override
    public void startUserRegistrationSaga(Long userId, String userName) {
        long now = System.currentTimeMillis();
        log.info("Saga starting: Orchestrating background provisioning for user ID: {}, Username: {}", userId, userName);

        String correlationId = String.valueOf(userId);
        String initialPayload = "{\"userId\":" + userId + ",\"userName\":\"" + (userName != null ? userName : "") + "\"}";

        SagaInstanceAggregate saga = SagaInstanceAggregate.start(
            "USER_REGISTRATION",
            correlationId,
            initialPayload,
            now
        );

        // Step 1: Advance to environment provisioning
        saga.advanceStep("PROVISION_ENVIRONMENT", now);
        setupWorkerEnvironment(userId);

        // Step 2: Complete the saga
        saga.complete(System.currentTimeMillis());
        sagaStateRepositoryPort.save(saga);

        log.info("Saga completed successfully for user ID: {}, SagaId: {}", userId, saga.getId().value());
    }

    private void setupWorkerEnvironment(Long userId) {
        log.info("Worker environment provisioning completed for user ID: {}", userId);
    }
}
