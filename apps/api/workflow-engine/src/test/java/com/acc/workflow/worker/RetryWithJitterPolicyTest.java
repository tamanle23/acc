package com.acc.workflow.worker;

import com.acc.workflow.worker.middleware.RetryWithJitterPolicy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RetryWithJitterPolicyTest {

    @Test
    @DisplayName("Should compute bounded backoff with full jitter")
    void shouldComputeBoundedBackoffWithJitter() {
        RetryWithJitterPolicy policy = new RetryWithJitterPolicy(100L, 1600L);

        for (int i = 0; i < 50; i++) {
            long delay1 = policy.computeBackoffMs(1);
            assertThat(delay1).isBetween(1L, 100L);

            long delay2 = policy.computeBackoffMs(2);
            assertThat(delay2).isBetween(1L, 200L);

            long delay3 = policy.computeBackoffMs(3);
            assertThat(delay3).isBetween(1L, 400L);

            long delayExceeded = policy.computeBackoffMs(10);
            assertThat(delayExceeded).isBetween(1L, 1600L);
        }
    }
}
