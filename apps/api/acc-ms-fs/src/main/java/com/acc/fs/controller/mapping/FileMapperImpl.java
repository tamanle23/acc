package com.acc.fs.controller.mapping;

import org.springframework.stereotype.Component;

import com.acc.fs.controller.response.FileVm;
import com.acc.fs.model.FsObject;

@Component
public class FileMapperImpl implements FileMapper {

  @Override
  public FileVm fileToFileVM(FsObject fsObject) {
    if (fsObject == null) {
      return null;
    }

    FileVm fileVm = new FileVm();

    fileVm.setId(fsObject.getId());
    fileVm.setCode(fsObject.getCode());
    fileVm.setUid(fsObject.getUid());
    fileVm.setDescription(fsObject.getDescription());
    fileVm.setCreatedBy(fsObject.getCreatedBy());
    fileVm.setCreatedDate(fsObject.getCreatedDate());
    fileVm.setLastUpdatedBy(fsObject.getLastUpdatedBy());
    fileVm.setLastUpdatedDate(fsObject.getLastUpdatedDate());
    fileVm.setVersion(fsObject.getVersion());
    fileVm.setDeletedDate(fsObject.getDeletedDate());
    fileVm.setRootLocation(fsObject.getRootLocation());
    fileVm.setExtension(fsObject.getExtension());
    fileVm.setPersisted(fsObject.isPersisted());
    fileVm.setIsDirectory(fsObject.getIsDirectory());
    fileVm.setContentType(fsObject.getContentType());
    fileVm.setSize(fsObject.getSize());
    fileVm.setChecksum(fsObject.getChecksum());
    fileVm.setName(fsObject.getName());
    fileVm.setFullPath(fsObject.getFullPath());

    return fileVm;
  }
}
