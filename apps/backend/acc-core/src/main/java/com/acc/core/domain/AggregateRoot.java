package com.acc.core.domain;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Pure DDD Aggregate Root managing its identity and uncommitted domain events.
 * ZERO framework dependencies.
 */
public abstract class AggregateRoot<ID extends Serializable> extends Entity<ID> {

    private final List<DomainEvent> uncommittedEvents = new ArrayList<>();

    protected void registerEvent(DomainEvent event) {
        if (event != null) {
            this.uncommittedEvents.add(event);
        }
    }

    public List<DomainEvent> pollUncommittedEvents() {
        if (uncommittedEvents.isEmpty()) {
            return Collections.emptyList();
        }
        List<DomainEvent> events = List.copyOf(uncommittedEvents);
        uncommittedEvents.clear();
        return events;
    }

    public List<DomainEvent> getUncommittedEvents() {
        return Collections.unmodifiableList(uncommittedEvents);
    }
}
