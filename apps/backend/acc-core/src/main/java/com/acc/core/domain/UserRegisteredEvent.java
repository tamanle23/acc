package com.acc.core.domain;

import java.time.Instant;

public record UserRegisteredEvent(Long userId, String userName, String email, Instant occurredOn) implements DomainEvent {
    public UserRegisteredEvent(Long userId, String userName, String email) {
        this(userId, userName, email, Instant.now());
    }
}
