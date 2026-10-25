package com.acc.core.domain;

import java.time.Instant;

public interface DomainEvent {
    Instant occurredOn();
}
