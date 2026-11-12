package com.acc.workflow.worker.middleware;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Enterprise Retry-with-Jitter Policy:
 * Computes exponential backoff with Full Jitter to eliminate thundering-herd stampedes
 * across distributed workers and queues during transient downstream network/service faults.
 */
public final class RetryWithJitterPolicy {

    private final long baseBackoffMs;
    private final long maxBackoffMs;

    public RetryWithJitterPolicy() {
        this(1000L, 30000L);
    }

    public RetryWithJitterPolicy(long baseBackoffMs, long maxBackoffMs) {
        this.baseBackoffMs = Math.max(100L, baseBackoffMs);
        this.maxBackoffMs = Math.max(this.baseBackoffMs, maxBackoffMs);
    }

    /**
     * Computes next backoff interval with full jitter in milliseconds:
     * sleep = ThreadLocalRandom.current().nextLong(1, min(maxBackoffMs, baseBackoffMs * 2^(attempt - 1)) + 1)
     *
     * @param attempt 1-based attempt index (1, 2, 3...)
     * @return delay in milliseconds before next retry is scheduled.
     */
    public long computeBackoffMs(int attempt) {
        int shift = Math.max(0, Math.min(attempt - 1, 30));
        long exponentialLimit;
        try {
            exponentialLimit = Math.multiplyExact(baseBackoffMs, 1L << shift);
        } catch (ArithmeticException overflow) {
            exponentialLimit = maxBackoffMs;
        }
        long ceiling = Math.min(maxBackoffMs, exponentialLimit);
        if (ceiling <= 1L) {
            return 1L;
        }
        return ThreadLocalRandom.current().nextLong(1L, ceiling + 1L);
    }

    public long baseBackoffMs() {
        return baseBackoffMs;
    }

    public long maxBackoffMs() {
        return maxBackoffMs;
    }
}
