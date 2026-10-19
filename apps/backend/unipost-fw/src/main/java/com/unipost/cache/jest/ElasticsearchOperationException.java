package com.unipost.cache.jest;

/**
 * Standardized domain exception thrown when Elasticsearch / Jest operations fail.
 */
public class ElasticsearchOperationException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public ElasticsearchOperationException(String message) {
        super(message);
    }

    public ElasticsearchOperationException(String message, Throwable cause) {
        super(message, cause);
    }
}
