package com.acc.fs.domain.model;

import com.acc.core.domain.AggregateRoot;
import com.acc.core.domain.exception.DomainValidationException;
import com.acc.fs.domain.model.valobj.FileId;

import java.util.Objects;

/**
 * Pure Domain Aggregate Root for File System Objects.
 * ZERO framework, JPA, Hibernate, or Jackson imports.
 */
public final class FsObjectAggregate extends AggregateRoot<FileId> {

    private final String tenantId;
    private final String workspaceId;
    private String name;
    private final String parentUid;
    private final boolean isDirectory;
    private long sizeBytes;
    private String contentType;
    private String storagePath;
    private String checksumSha256;
    private final long createdAtEpochMs;
    private long updatedAtEpochMs;

    public FsObjectAggregate(
        FileId id, String tenantId, String workspaceId, String name, String parentUid,
        boolean isDirectory, long sizeBytes, String contentType, String storagePath,
        String checksumSha256, long createdAtEpochMs, long updatedAtEpochMs
    ) {
        this.setId(Objects.requireNonNull(id, "FileId cannot be null"));
        this.tenantId = Objects.requireNonNull(tenantId, "TenantId cannot be null");
        this.workspaceId = workspaceId != null ? workspaceId : "default";
        if (name == null || name.isBlank()) {
            throw new DomainValidationException("File name cannot be empty");
        }
        this.name = name.trim();
        this.parentUid = parentUid;
        this.isDirectory = isDirectory;
        if (sizeBytes < 0) {
            throw new DomainValidationException("File size cannot be negative: " + sizeBytes);
        }
        this.sizeBytes = sizeBytes;
        this.contentType = contentType != null ? contentType : "application/octet-stream";
        this.storagePath = storagePath != null ? storagePath : "";
        this.checksumSha256 = checksumSha256;
        this.createdAtEpochMs = createdAtEpochMs;
        this.updatedAtEpochMs = updatedAtEpochMs;
    }

    public FsObjectAggregate(
        FileId id, String tenantId, String workspaceId, String name, String parentUid,
        Boolean isDirectory, Long sizeBytes, String contentType, String storagePath,
        String checksumSha256, Long createdAtEpochMs, Long updatedAtEpochMs
    ) {
        this(
            id, tenantId, workspaceId, name, parentUid,
            Boolean.TRUE.equals(isDirectory),
            sizeBytes != null ? sizeBytes : 0L,
            contentType, storagePath, checksumSha256,
            createdAtEpochMs != null ? createdAtEpochMs : 0L,
            updatedAtEpochMs != null ? updatedAtEpochMs : 0L
        );
    }

    public static FsObjectAggregate createNewFile(
        String tenantId, String workspaceId, String name, String parentUid,
        long sizeBytes, String contentType, String storagePath, String checksumSha256,
        long nowEpochMs
    ) {
        FileId id = FileId.random();
        return new FsObjectAggregate(
            id, tenantId, workspaceId, name, parentUid, false,
            sizeBytes, contentType, storagePath, checksumSha256, nowEpochMs, nowEpochMs
        );
    }

    public static FsObjectAggregate createDirectory(
        String tenantId, String workspaceId, String name, String parentUid, long nowEpochMs
    ) {
        FileId id = FileId.random();
        return new FsObjectAggregate(
            id, tenantId, workspaceId, name, parentUid, true,
            0L, "application/x-directory", "", null, nowEpochMs, nowEpochMs
        );
    }

    public void rename(String newName, long nowEpochMs) {
        if (newName == null || newName.isBlank()) {
            throw new DomainValidationException("New file name cannot be blank");
        }
        this.name = newName.trim();
        this.updatedAtEpochMs = nowEpochMs;
    }

    public void updateStoragePath(String path, long nowEpochMs) {
        this.storagePath = path != null ? path : "";
        this.updatedAtEpochMs = nowEpochMs;
    }

    public String tenantId() { return tenantId; }
    public String workspaceId() { return workspaceId; }
    public String name() { return name; }
    public String parentUid() { return parentUid; }
    public boolean isDirectory() { return isDirectory; }
    public long sizeBytes() { return sizeBytes; }
    public String contentType() { return contentType; }
    public String storagePath() { return storagePath; }
    public String checksumSha256() { return checksumSha256; }
    public long createdAtEpochMs() { return createdAtEpochMs; }
    public long updatedAtEpochMs() { return updatedAtEpochMs; }

    // Standard JavaBean getters for framework and reflection compatibility
    public String getTenantId() { return tenantId; }
    public String getWorkspaceId() { return workspaceId; }
    public String getName() { return name; }
    public String getParentUid() { return parentUid; }
    public boolean getIsDirectory() { return isDirectory; }
    public long getSizeBytes() { return sizeBytes; }
    public String getContentType() { return contentType; }
    public String getStoragePath() { return storagePath; }
    public String getChecksumSha256() { return checksumSha256; }
    public long getCreatedAtEpochMs() { return createdAtEpochMs; }
    public long getUpdatedAtEpochMs() { return updatedAtEpochMs; }
}
