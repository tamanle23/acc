package com.acc.workflow.worker.middleware;

import com.acc.workflow.worker.TaskContext;
import com.acc.workflow.worker.TaskOutcome;
import com.acc.workflow.worker.WorkerMiddleware;

public final class ErrorClassificationMiddleware implements WorkerMiddleware {

    @Override
    public TaskOutcome invoke(TaskContext context, MiddlewareChain next) {
        try {
            return next.proceed(context);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return TaskOutcome.failedTerminal(e.getMessage());
        } catch (Exception e) {
            return TaskOutcome.failedRetryable(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        }
    }
}
