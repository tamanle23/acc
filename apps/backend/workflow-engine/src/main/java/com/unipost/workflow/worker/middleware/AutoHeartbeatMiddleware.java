package com.unipost.workflow.worker.middleware;

import com.unipost.workflow.worker.TaskContext;
import com.unipost.workflow.worker.TaskOutcome;
import com.unipost.workflow.worker.WorkerMiddleware;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Periodically extends task lease timestamp in the background while handler executes.
 */
public final class AutoHeartbeatMiddleware implements WorkerMiddleware {

    private final long intervalMs;

    public AutoHeartbeatMiddleware(long intervalMs) {
        this.intervalMs = intervalMs > 0 ? intervalMs : 10000L;
    }

    @Override
    public TaskOutcome invoke(TaskContext context, MiddlewareChain next) throws Exception {
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        AtomicBoolean active = new AtomicBoolean(true);

        scheduler.scheduleAtFixedRate(() -> {
            if (active.get()) {
                try {
                    context.heartbeat();
                } catch (Exception ignored) {}
            }
        }, intervalMs, intervalMs, TimeUnit.MILLISECONDS);

        try {
            return next.proceed(context);
        } finally {
            active.set(false);
            scheduler.shutdownNow();
        }
    }
}
