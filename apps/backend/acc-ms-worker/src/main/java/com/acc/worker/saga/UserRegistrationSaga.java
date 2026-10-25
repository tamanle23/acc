package com.acc.worker.saga;

import com.acc.core.domain.UserRegisteredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class UserRegistrationSaga {

    private static final Logger log = LoggerFactory.getLogger(UserRegistrationSaga.class);

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUserRegistered(UserRegisteredEvent event) {
        log.info("Saga triggered: Starting background tasks for newly registered user ID: {}, Username: {}", event.userId(), event.userName());
        // E.g., provision worker environment, send welcome email
        setupWorkerEnvironment(event.userId());
    }

    private void setupWorkerEnvironment(Long userId) {
        log.info("Worker environment provisioning completed for user ID: {}", userId);
    }
}
