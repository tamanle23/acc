package com.acc.worker.saga;

import com.acc.core.domain.UserRegisteredEvent;
import com.acc.worker.application.saga.ports.in.AdvanceUserSagaUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Inbound Primary Driving Adapter reacting to domain transaction commits
 * and initiating distributed sagas via AdvanceUserSagaUseCase.
 */
@Component
public class UserRegistrationSaga {

    private static final Logger log = LoggerFactory.getLogger(UserRegistrationSaga.class);

    private final AdvanceUserSagaUseCase advanceUserSagaUseCase;

    public UserRegistrationSaga(AdvanceUserSagaUseCase advanceUserSagaUseCase) {
        this.advanceUserSagaUseCase = advanceUserSagaUseCase;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUserRegistered(UserRegisteredEvent event) {
        log.info("Saga triggered: Starting background tasks for newly registered user ID: {}, Username: {}", event.userId(), event.userName());
        advanceUserSagaUseCase.startUserRegistrationSaga(event.userId(), event.userName());
    }
}
