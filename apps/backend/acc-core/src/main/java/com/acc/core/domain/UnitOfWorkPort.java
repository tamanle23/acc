package com.acc.core.domain;

import java.util.concurrent.Callable;

/**
 * Secondary Driven Port (SPI) for isolating transaction demarcation
 * from pure domain logic.
 */
public interface UnitOfWorkPort {

    <T> T executeInTransaction(Callable<T> action);

    void executeInTransaction(Runnable action);
}
