package com.acc.identity.application.user.service;

import com.acc.core.domain.exception.DomainValidationException;
import com.acc.identity.application.user.command.RegisterUserCommand;
import com.acc.identity.application.user.port.in.RegisterUserUseCase;
import com.acc.identity.domain.user.model.UserAggregate;
import com.acc.identity.domain.user.repository.UserRepositoryPort;
import com.acc.identity.domain.user.valobj.UserId;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Application Service / Driving Port Implementation for User Registration.
 * Handles transaction demarcation and secondary driven port orchestration.
 */
@Service
public class RegisterUserService implements RegisterUserUseCase {

    private final UserRepositoryPort userRepositoryPort;
    private final ApplicationEventPublisher eventPublisher;

    public RegisterUserService(UserRepositoryPort userRepositoryPort, ApplicationEventPublisher eventPublisher) {
        this.userRepositoryPort = userRepositoryPort;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional
    public UserId registerUser(RegisterUserCommand command) {
        if (userRepositoryPort.existsByUsername(command.tenantId(), command.username())) {
            throw new DomainValidationException("Username already taken: " + command.username());
        }
        if (userRepositoryPort.existsByEmail(command.tenantId(), command.email())) {
            throw new DomainValidationException("Email already registered: " + command.email());
        }

        long now = System.currentTimeMillis();
        UserAggregate user = UserAggregate.registerNewUser(
            command.tenantId(),
            command.username(),
            command.email(),
            command.rawPassword(),
            now
        );

        userRepositoryPort.save(user);

        // Dispatch domain events
        user.pollUncommittedEvents().forEach(eventPublisher::publishEvent);

        return user.getId();
    }
}
