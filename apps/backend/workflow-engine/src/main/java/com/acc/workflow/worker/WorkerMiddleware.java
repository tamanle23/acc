package com.acc.workflow.worker;

@FunctionalInterface
public interface WorkerMiddleware {
    TaskOutcome invoke(TaskContext context, MiddlewareChain next) throws Exception;

    @FunctionalInterface
    interface MiddlewareChain {
        TaskOutcome proceed(TaskContext context) throws Exception;
    }
}
