package com.acc.fs.controller.mapping;

import com.acc.fs.model.FsObject;
import org.mapstruct.Mapper;

import com.acc.fs.controller.response.FileVm;

@Mapper
public interface FileMapper {

  FileVm fileToFileVM(FsObject fsObject);
}
