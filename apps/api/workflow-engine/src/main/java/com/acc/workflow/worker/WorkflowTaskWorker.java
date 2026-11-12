package com.acc.workflow.worker;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Declarative annotation for registering a SIMPLE task worker handler method or bean
 * with the Acc Workflow Engine and WorkerRegistry.
 */
@Documented
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface WorkflowTaskWorker {

    /**
     * The logical task name / taskReferenceName (e.g., "checkInventory", "expressCourier").
     */
    String taskName();

    /**
     * The routing domain (e.g., "inventory", "shipping", "billing", "default").
     */
    String domain() default "default";

    /**
     * Human-readable description surfaced in the Workflow Designer catalog.
     */
    String description() default "";

    /**
     * Maximum concurrent executions per worker instance.
     */
    int maxConcurrency() default 16;

    /**
     * Default task execution response timeout in seconds.
     */
    long timeoutSeconds() default 30L;
}
