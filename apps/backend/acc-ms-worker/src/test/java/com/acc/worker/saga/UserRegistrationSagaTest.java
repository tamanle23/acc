package com.acc.worker.saga;

import com.acc.core.domain.UserRegisteredEvent;
import com.acc.worker.application.saga.ports.in.AdvanceUserSagaUseCase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.*;

@DisplayName("UserRegistrationSaga Inbound Adapter Tests")
class UserRegistrationSagaTest {

    @Test
    @DisplayName("onUserRegistered delegates to AdvanceUserSagaUseCase")
    void testOnUserRegistered() {
        AdvanceUserSagaUseCase useCase = mock(AdvanceUserSagaUseCase.class);
        UserRegistrationSaga sagaAdapter = new UserRegistrationSaga(useCase);

        UserRegisteredEvent event = new UserRegisteredEvent(42L, "alice", "alice@example.com");
        sagaAdapter.onUserRegistered(event);

        verify(useCase).startUserRegistrationSaga(42L, "alice");
    }
}
