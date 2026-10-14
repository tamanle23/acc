package com.unipost.workflow.worker;

@FunctionalInterface
public interface TaskHandler {
    TaskOutcome execute(TaskContext context) throws Exception;
}
