package com.acc.identity.domain.user.event;

import com.acc.core.domain.DomainEvent;
import com.acc.identity.domain.user.valobj.UserId;

import java.time.Instant;

public record UserRegisteredEvent(
    UserId userId,
    String tenantId,
    String email,
    long occurredAtEpochMs
) implements DomainEvent {
    @Override
    public Instant occurredOn() {
        return Instant.ofEpochMilli(occurredAtEpochMs);
    }
}
