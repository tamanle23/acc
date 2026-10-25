package com.acc.workflow.worker;

@FunctionalInterface
public interface TaskHandler {
    TaskOutcome execute(TaskContext context) throws Exception;
}
