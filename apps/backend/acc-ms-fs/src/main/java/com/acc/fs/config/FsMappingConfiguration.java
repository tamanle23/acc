package com.acc.fs.config;

import com.acc.fs.controller.mapping.FileMapper;
import com.acc.fs.controller.response.FileVm;
import com.acc.fs.model.FsObject;
import org.mapstruct.factory.Mappers;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FsMappingConfiguration {

  @Bean
  @ConditionalOnMissingBean(FileMapper.class)
  public FileMapper fileMapper() {
    try {
      return Mappers.getMapper(FileMapper.class);
    } catch (Throwable t) {
      return new FileMapper() {
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
      };
    }
  }
}
