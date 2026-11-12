package com.acc.service.workflow;

import com.acc.domain.metadata.EntityStateChangedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Spring Modulith event listener listening for {@link EntityStateChangedEvent}
 * after successful commit to perform decoupled audit logging and notifications.
 */
@Slf4j
@Component
public class WorkflowAuditEventListener {

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStateChange(EntityStateChangedEvent event) {
        log.info("[WORKFLOW AUDIT] Record #{} changed state from '{}' to '{}' via action '{}' by user '{}' (Tenant: {})",
                event.recordId(), event.oldState(), event.newState(), event.action(), event.triggeredBy(), event.tenantId());
    }
}
