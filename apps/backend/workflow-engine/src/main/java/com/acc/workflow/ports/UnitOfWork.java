package com.acc.workflow.ports;

import java.io.Closeable;

/**
 * Atomic Unit of Work managing transaction boundary.
 */
public interface UnitOfWork extends Closeable {
    void commit();
    void rollback();
    @Override
    void close();
}
