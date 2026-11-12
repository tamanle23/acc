package com.acc.fs.domain.repository;

import java.io.InputStream;

/**
 * Secondary Driven Port (SPI) for streaming binary assets to cloud or disk storage.
 * Enforces O(1) heap allocation streaming directly to S3 or filesystem.
 */
public interface BlobStoragePort {

    String store(InputStream inputStream, long sizeBytes, String storagePath);

    InputStream loadAsStream(String storagePath);

    boolean delete(String storagePath);

    boolean exists(String storagePath);
}
