package com.acc.worker.domain.saga;

import com.acc.core.domain.exception.DomainValidationException;
import com.acc.worker.domain.saga.model.SagaInstanceAggregate;
import com.acc.worker.domain.saga.valobj.SagaStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("SagaInstanceAggregate Pure Domain Tests")
class SagaInstanceAggregateTest {

    @Test
    @DisplayName("start creates aggregate with STARTED status and INIT step")
    void testStartSaga() {
        long now = 1000000L;
        SagaInstanceAggregate saga = SagaInstanceAggregate.start(
            "USER_REGISTRATION", "user-42", "{\"userId\":42}", now
        );

        assertNotNull(saga.getId());
        assertEquals("USER_REGISTRATION", saga.sagaType());
        assertEquals("user-42", saga.correlationId());
        assertEquals("INIT", saga.currentStep());
        assertEquals(SagaStatus.STARTED, saga.status());
        assertEquals("{\"userId\":42}", saga.payloadJson());
        assertEquals(now, saga.createdAtEpochMs());
        assertEquals(now, saga.updatedAtEpochMs());
    }

    @Test
    @DisplayName("advanceStep updates currentStep and transitions status to PROCESSING")
    void testAdvanceStep() {
        long now = 1000000L;
        SagaInstanceAggregate saga = SagaInstanceAggregate.start(
            "USER_REGISTRATION", "user-42", "{}", now
        );

        long advanceTime = now + 1000L;
        saga.advanceStep("PROVISION_STORAGE", advanceTime);

        assertEquals("PROVISION_STORAGE", saga.currentStep());
        assertEquals(SagaStatus.PROCESSING, saga.status());
        assertEquals(advanceTime, saga.updatedAtEpochMs());
    }

    @Test
    @DisplayName("complete transitions status to COMPLETED")
    void testCompleteSaga() {
        long now = 1000000L;
        SagaInstanceAggregate saga = SagaInstanceAggregate.start(
            "USER_REGISTRATION", "user-42", "{}", now
        );

        long completeTime = now + 5000L;
        saga.complete(completeTime);

        assertEquals(SagaStatus.COMPLETED, saga.status());
        assertEquals("COMPLETED", saga.currentStep());
        assertEquals(completeTime, saga.updatedAtEpochMs());
    }

    @Test
    @DisplayName("fail transitions status to FAILED with reason")
    void testFailSaga() {
        long now = 1000000L;
        SagaInstanceAggregate saga = SagaInstanceAggregate.start(
            "USER_REGISTRATION", "user-42", "{}", now
        );

        long failTime = now + 2000L;
        saga.fail("Quota exceeded", failTime);

        assertEquals(SagaStatus.FAILED, saga.status());
        assertEquals("FAILED: Quota exceeded", saga.currentStep());
        assertEquals(failTime, saga.updatedAtEpochMs());
    }

    @Test
    @DisplayName("advanceStep rejects blank step or advancing after termination")
    void testInvalidStepTransitions() {
        long now = 1000000L;
        SagaInstanceAggregate saga = SagaInstanceAggregate.start(
            "USER_REGISTRATION", "user-42", "{}", now
        );

        assertThrows(DomainValidationException.class, () -> saga.advanceStep("", now + 100L));
        assertThrows(DomainValidationException.class, () -> saga.advanceStep(null, now + 100L));

        saga.complete(now + 200L);
        assertThrows(DomainValidationException.class, () -> saga.advanceStep("NEXT_ACTION", now + 300L));
    }
}
