package com.unipost.sandbox.simulators;

import com.unipost.sandbox.spi.ExternalServiceSimulator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory simulator for S3/MinIO cloud object storage.
 * Eliminates external network dependencies on MinIO or AWS S3 during local development and testing.
 */
@Component
public class InMemoryStorageSimulator implements ExternalServiceSimulator {

    private static final Logger log = LoggerFactory.getLogger(InMemoryStorageSimulator.class);

    public record StoredObject(
            String bucket,
            String key,
            byte[] content,
            String contentType,
            String md5Checksum,
            long sizeBytes,
            long createdAtEpochMs
    ) {}

    private final Map<String, StoredObject> objectStore = new ConcurrentHashMap<>();

    @Override
    public String getId() {
        return "inmemory-storage";
    }

    @Override
    public String getName() {
        return "In-Memory S3 / MinIO Object Storage Simulator";
    }

    @Override
    public void reset() {
        objectStore.clear();
        log.info("InMemoryStorageSimulator state reset.");
    }

    @Override
    public Map<String, Object> getDiagnostics() {
        long totalBytes = objectStore.values().stream().mapToLong(StoredObject::sizeBytes).sum();
        return Map.of(
                "totalFiles", objectStore.size(),
                "totalSizeBytes", totalBytes,
                "buckets", objectStore.values().stream().map(StoredObject::bucket).distinct().toList()
        );
    }

    public StoredObject putObject(String bucket, String key, byte[] content, String contentType) {
        String md5 = computeMd5(content);
        StoredObject obj = new StoredObject(bucket, key, content, contentType, md5, content.length, System.currentTimeMillis());
        String fullPath = bucket + "/" + key;
        objectStore.put(fullPath, obj);
        log.debug("Simulated storage write: {} ({} bytes, MD5={})", fullPath, content.length, md5);
        return obj;
    }

    public Optional<StoredObject> getObject(String bucket, String key) {
        return Optional.ofNullable(objectStore.get(bucket + "/" + key));
    }

    public Optional<InputStream> getObjectStream(String bucket, String key) {
        return getObject(bucket, key).map(obj -> new ByteArrayInputStream(obj.content()));
    }

    public boolean deleteObject(String bucket, String key) {
        return objectStore.remove(bucket + "/" + key) != null;
    }

    public boolean exists(String bucket, String key) {
        return objectStore.containsKey(bucket + "/" + key);
    }

    private String computeMd5(byte[] content) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(content);
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "md5-error";
        }
    }
}
