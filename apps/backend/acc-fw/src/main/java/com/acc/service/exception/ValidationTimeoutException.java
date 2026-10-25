package com.acc.service.exception;

/**
 * Exception thrown when a JSON schema evaluation or regular expression matching
 * exceeds the allocated computational time budget, mitigating ReDoS attacks.
 */
public class ValidationTimeoutException extends RuntimeException {
    public ValidationTimeoutException(String message) {
        super(message);
    }

    public ValidationTimeoutException(String message, Throwable cause) {
        super(message, cause);
    }
}
