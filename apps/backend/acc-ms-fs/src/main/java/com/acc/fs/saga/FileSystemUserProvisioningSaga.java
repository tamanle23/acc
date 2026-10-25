package com.acc.fs.saga;

import com.acc.core.domain.UserRegisteredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class FileSystemUserProvisioningSaga {

    private static final Logger log = LoggerFactory.getLogger(FileSystemUserProvisioningSaga.class);

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleUserRegistration(UserRegisteredEvent event) {
        log.info("Saga triggered: Provisioning file system resources for user ID: {}", event.userId());
        // E.g., allocate S3 bucket folder or local disk quota
        allocateStorage(event.userName());
    }

    private void allocateStorage(String userName) {
        log.info("Allocated default storage quota for user: {}", userName);
    }
}
