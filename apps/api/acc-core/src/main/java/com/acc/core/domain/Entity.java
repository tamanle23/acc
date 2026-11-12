package com.acc.core.domain;

import java.io.Serializable;
import java.util.Objects;

/**
 * Base DDD Entity with explicit identity-based equality.
 */
public abstract class Entity<ID extends Serializable> {

    private ID id;

    public ID getId() {
        return id;
    }

    protected void setId(ID id) {
        this.id = id;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Entity<?> entity = (Entity<?>) o;
        return Objects.equals(id, entity.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
