package com.unipost.workflow.worker;

import java.util.Map;

public sealed interface TaskOutcome permits
    TaskOutcome.Completed,
    TaskOutcome.InProgress,
    TaskOutcome.Failed {

    record Completed(Map<String, Object> output) implements TaskOutcome {}

    record InProgress(long callbackAfterSeconds, Map<String, Object> partialOutput) implements TaskOutcome {}

    record Failed(String errorMessage, boolean retryable, Map<String, Object> output) implements TaskOutcome {}

    static TaskOutcome completed(Map<String, Object> output) {
        return new Completed(output != null ? output : Map.of());
    }

    static TaskOutcome inProgress(long callbackAfterSeconds, Map<String, Object> partialOutput) {
        return new InProgress(callbackAfterSeconds, partialOutput != null ? partialOutput : Map.of());
    }

    static TaskOutcome failedRetryable(String reason) {
        return new Failed(reason, true, Map.of());
    }

    static TaskOutcome failedTerminal(String reason) {
        return new Failed(reason, false, Map.of());
    }
}
