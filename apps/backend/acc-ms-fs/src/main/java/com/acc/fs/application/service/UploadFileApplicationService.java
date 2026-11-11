package com.acc.fs.application.service;

import com.acc.fs.application.command.UploadFileCommand;
import com.acc.fs.application.ports.in.UploadFileUseCase;
import com.acc.fs.domain.model.FsObjectAggregate;
import com.acc.fs.domain.model.valobj.FileId;
import com.acc.fs.domain.repository.BlobStoragePort;
import com.acc.fs.domain.repository.FsObjectRepositoryPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Application Service / Driving Port Implementation for streaming file uploads.
 * Streams bytes directly to BlobStoragePort with O(1) heap allocation.
 */
@Service
public class UploadFileApplicationService implements UploadFileUseCase {

    private final BlobStoragePort blobStoragePort;
    private final FsObjectRepositoryPort repositoryPort;

    public UploadFileApplicationService(BlobStoragePort blobStoragePort, FsObjectRepositoryPort repositoryPort) {
        this.blobStoragePort = blobStoragePort;
        this.repositoryPort = repositoryPort;
    }

    @Override
    @Transactional
    public FileId uploadFile(UploadFileCommand command) {
        long now = System.currentTimeMillis();
        String relativeStoragePath = command.tenantId() + "/" + command.workspaceId() + "/" + command.fileId().value() + "_" + command.filename();

        // Direct streaming into storage port without buffering entire file in memory
        String storedPath = blobStoragePort.store(command.inputStream(), command.sizeBytes(), relativeStoragePath);

        FsObjectAggregate fileAggregate = new FsObjectAggregate(
            command.fileId(),
            command.tenantId(),
            command.workspaceId(),
            command.filename(),
            command.parentUid(),
            false,
            command.sizeBytes(),
            command.contentType(),
            storedPath,
            null,
            now,
            now
        );

        repositoryPort.save(fileAggregate);
        return fileAggregate.getId();
    }
}
