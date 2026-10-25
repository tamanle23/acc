package com.acc.domain.metadata;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class AttributeDefinitionUpdatedEvent extends ApplicationEvent {

    private final Long entityTypeId;
    private final String tenantId;

    public AttributeDefinitionUpdatedEvent(Object source, Long entityTypeId) {
        this(source, entityTypeId, null);
    }

    public AttributeDefinitionUpdatedEvent(Object source, Long entityTypeId, String tenantId) {
        super(source);
        this.entityTypeId = entityTypeId;
        this.tenantId = tenantId;
    }
}
