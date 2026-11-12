package com.acc.worker.application.saga;

import com.acc.worker.application.saga.service.UserRegistrationSagaApplicationService;
import com.acc.worker.domain.saga.model.SagaInstanceAggregate;
import com.acc.worker.domain.saga.repository.SagaStateRepositoryPort;
import com.acc.worker.domain.saga.valobj.SagaStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("UserRegistrationSagaApplicationService Unit Tests")
class UserRegistrationSagaApplicationServiceTest {

    private SagaStateRepositoryPort sagaStateRepositoryPort;
    private UserRegistrationSagaApplicationService applicationService;

    @BeforeEach
    void setUp() {
        sagaStateRepositoryPort = mock(SagaStateRepositoryPort.class);
        applicationService = new UserRegistrationSagaApplicationService(sagaStateRepositoryPort);
    }

    @Test
    @DisplayName("startUserRegistrationSaga orchestrates saga to COMPLETED status and persists state")
    void testStartUserRegistrationSaga() {
        applicationService.startUserRegistrationSaga(101L, "john_doe");

        ArgumentCaptor<SagaInstanceAggregate> captor = ArgumentCaptor.forClass(SagaInstanceAggregate.class);
        verify(sagaStateRepositoryPort).save(captor.capture());

        SagaInstanceAggregate savedSaga = captor.getValue();
        assertNotNull(savedSaga);
        assertEquals("USER_REGISTRATION", savedSaga.sagaType());
        assertEquals("101", savedSaga.correlationId());
        assertEquals(SagaStatus.COMPLETED, savedSaga.status());
        assertEquals("COMPLETED", savedSaga.currentStep());
        assertTrue(savedSaga.payloadJson().contains("john_doe"));
    }
}
