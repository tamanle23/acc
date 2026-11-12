package com.acc.worker.application.saga.ports.in;

/**
 * Driving Inbound Port for orchestrating user registration saga state transitions.
 */
public interface AdvanceUserSagaUseCase {

    void startUserRegistrationSaga(Long userId, String userName);
}
