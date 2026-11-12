package com.acc.sandbox.simulators;

import com.acc.fs.connector.StorageConnector;
import com.acc.fs.connector.impl.BaseStorageConnector;
import com.acc.fs.model.FileAttributes;
import com.acc.fs.model.FileConnector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Drop-in primary StorageConnector bean for acc-ms-fs.
 * Activated strictly when application.sandbox.enabled=true.
 * Transparently stores uploaded files in InMemoryStorageSimulator without requiring MinIO or S3.
 */
@Service
@Primary
@ConditionalOnClass(name = "com.acc.fs.connector.StorageConnector")
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class InMemoryStorageConnector implements StorageConnector {

    private static final Logger log = LoggerFactory.getLogger(InMemoryStorageConnector.class);

    private final InMemoryStorageSimulator storageSimulator;

    public InMemoryStorageConnector(InMemoryStorageSimulator storageSimulator) {
        this.storageSimulator = storageSimulator;
        log.info("InMemoryStorageConnector activated as @Primary StorageConnector bean for sandbox.");
    }

    @Override
    public String acquireIdentifier() {
        return UUID.randomUUID().toString();
    }

    @Override
    public FileAttributes store(InputStream inputStream) {
        return store(inputStream, -1, acquireIdentifier());
    }

    @Override
    public FileAttributes store(InputStream inputStream, long length, String code) {
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            int nRead;
            byte[] data = new byte[8192];
            while ((nRead = inputStream.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }
            buffer.flush();
            byte[] bytes = buffer.toByteArray();

            String bucket = "sandbox-bucket";
            storageSimulator.putObject(bucket, code, bytes, "application/octet-stream");

            return FileAttributes.builder()
                    .bucket(bucket)
                    .code(code)
                    .s3endpoint("http://localhost:8000/fs/sandbox")
                    .s3region("sandbox-1")
                    .size(length > 0 ? length : (long) bytes.length)
                    .build();
        } catch (Exception e) {
            log.error("Failed to store stream in InMemoryStorageConnector", e);
            throw new RuntimeException("Sandbox storage write failed", e);
        }
    }

    @Override
    public void remove(List<FileAttributes> attributes) {
        if (attributes != null) {
            for (FileAttributes attr : attributes) {
                remove(attr);
            }
        }
    }

    @Override
    public void remove(FileAttributes attributes) {
        if (attributes != null) {
            storageSimulator.deleteObject(attributes.getBucket() != null ? attributes.getBucket() : "sandbox-bucket", attributes.getCode());
        }
    }

    @Override
    public Stream<Path> list(String prefix) {
        return Stream.empty();
    }

    @Override
    public Resource loadAsResource(FileAttributes attributes) {
        if (attributes == null || attributes.getCode() == null) {
            return new ByteArrayResource(new byte[0]);
        }
        String bucket = attributes.getBucket() != null ? attributes.getBucket() : "sandbox-bucket";
        return storageSimulator.getObject(bucket, attributes.getCode())
                .map(obj -> (Resource) new ByteArrayResource(obj.content()))
                .orElseGet(() -> new ByteArrayResource(new byte[0]));
    }

    @Override
    public void deleteAll() {
        storageSimulator.reset();
    }

    @Override
    public FileConnector getConnector() {
        return FileConnector.S3;
    }

    @Override
    public FileAttributes copy(FileAttributes attributes) {
        if (attributes == null) return null;
        Resource res = loadAsResource(attributes);
        try (InputStream is = res.getInputStream()) {
            return store(is, attributes.getSize() != null ? attributes.getSize() : 0, attributes.getCode() + "-copy");
        } catch (Exception e) {
            throw new RuntimeException("Sandbox copy failed", e);
        }
    }
}
