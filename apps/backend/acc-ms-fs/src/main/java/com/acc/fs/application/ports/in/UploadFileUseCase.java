package com.acc.fs.application.ports.in;

import com.acc.fs.application.command.UploadFileCommand;
import com.acc.fs.domain.model.valobj.FileId;

public interface UploadFileUseCase {

    FileId uploadFile(UploadFileCommand command);
}
