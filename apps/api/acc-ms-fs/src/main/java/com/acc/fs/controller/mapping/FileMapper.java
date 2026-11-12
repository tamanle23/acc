package com.acc.fs.controller.mapping;

import com.acc.fs.controller.response.FileVm;
import com.acc.fs.model.FsObject;

public interface FileMapper {

  FileVm fileToFileVM(FsObject fsObject);
}
