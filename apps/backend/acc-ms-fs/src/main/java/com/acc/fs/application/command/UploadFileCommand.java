package com.acc.fs.application.command;

import com.acc.core.mediator.Command;
import com.acc.fs.domain.model.valobj.FileId;

import java.io.InputStream;

/**
 * Pure domain command representing a file upload request.
 * ZERO Jakarta Servlet dependencies.
 */
public record UploadFileCommand(
    FileId fileId,
    String tenantId,
    String workspaceId,
    String parentUid,
    String filename,
    String contentType,
    long sizeBytes,
    InputStream inputStream,
    boolean overwrite
) implements Command<FileId> {
}
