package com.unipost.workflow.worker.middleware;

import com.unipost.workflow.worker.TaskContext;
import com.unipost.workflow.worker.TaskOutcome;
import com.unipost.workflow.worker.WorkerMiddleware;

public final class SchemaValidationMiddleware implements WorkerMiddleware {

    private final java.util.List<String> requiredKeys;

    public SchemaValidationMiddleware() {
        this(java.util.Collections.emptyList());
    }

    public SchemaValidationMiddleware(java.util.List<String> requiredKeys) {
        this.requiredKeys = requiredKeys != null ? requiredKeys : java.util.Collections.emptyList();
    }

    @Override
    public TaskOutcome invoke(TaskContext context, MiddlewareChain next) throws Exception {
        if (context.input() == null) {
            return TaskOutcome.failedTerminal("Task input cannot be null");
        }
        for (String reqKey : requiredKeys) {
            if (!context.input().containsKey(reqKey)) {
                return TaskOutcome.failedTerminal("Missing required input field: " + reqKey);
            }
        }
        return next.proceed(context);
    }
}
