package com.acc.fs.controller;

import java.util.List;
import java.util.stream.Collectors;

import jakarta.servlet.http.HttpServletRequest;

import com.acc.core.constant.PermissionActionConstants;
import com.acc.core.constant.ResourceConstants;
import com.acc.core.exception.ErrorCodes;
import com.acc.core.io.ContextHeader;
import com.acc.fs.controller.response.FileVm;
import com.acc.fs.model.FsObject;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.acc.core.io.Error;
import com.acc.core.io.ResponseWrapper;
import com.acc.fs.ValidatorConfiguration;
import com.acc.fs.controller.mapping.FileMapper;
import com.acc.fs.controller.request.ObjectCreationRequestBody;
import com.acc.fs.controller.request.FileDropRequestBody;
import com.acc.fs.controller.request.FileRemovalRequestBody;
import com.acc.fs.service.FileService;
import com.acc.fw.CommandController;
import com.acc.fw.controller.validation.Validate;

@RestController
@RequestMapping("api/fs")
public class ObjectCommandController extends CommandController<FsObject, FileVm>{

  @Autowired
  FileService fileService;

  @Autowired
  FileMapper fileMapper;

  @Override
  public String getResourceName() {
    return ResourceConstants.FILE;
  }

  @PostMapping(value="/create_container")
  @PreAuthorize(value = "hasPermission(this.getResourceName(), '"+ PermissionActionConstants.CREATION + "')")
  public ResponseWrapper<ContextHeader, Object> createContainer(@Validate(name = ValidatorConfiguration.FILE_CREATION) @RequestBody ObjectCreationRequestBody requestBody){
    requestBody.getObject().setIsDirectory(true);
    return success(this.fileService.register(extractRequest(requestBody)));
  }

  @PostMapping("/upload/{uid}/{overwrite}")
  @PreAuthorize(value = "hasPermission(this.getResourceName(), '"+ PermissionActionConstants.UPLOAD + "')")
  public ResponseWrapper<ContextHeader, List<FileVm>> upload(HttpServletRequest request, @PathVariable(required = false) String uid, @PathVariable(required=false) String overwrite) {
    if(StringUtils.equalsIgnoreCase("root",uid)) {
      uid = null;
    }
    List<FsObject> fsObjects = fileService.processUploadFile(request,uid,overwrite);
    if(fsObjects !=null) {
      return success(fsObjects.stream().map(fileMapper::fileToFileVM).collect(Collectors.toList()));
    }
    return fail(Error.builder().errorCodes(ErrorCodes.NONE).message("Cannot register file.").build());
  }

  @PostMapping(value="/delete")
  @PreAuthorize(value = "hasPermission(this.getResourceName(), '"+ PermissionActionConstants.DELETE + "')")
  public ResponseWrapper<ContextHeader, Void> deleteFolder(@Validate(name = ValidatorConfiguration.FILE_DELETE) @RequestBody FileRemovalRequestBody requestBody){
    this.fileService.deleteByUids(extractRequest(requestBody));
    return success();
  }

  @PostMapping(value="/drop")
  @PreAuthorize(value = "hasPermission(this.getResourceName(), '"+ PermissionActionConstants.CREATION + "') && hasPermission(this.getResourceName(), '"+ PermissionActionConstants.DELETE + "')")
  public ResponseWrapper<ContextHeader, Void> dropFiles(@Validate(name = ValidatorConfiguration.FILE_DROP) @RequestBody FileDropRequestBody requestBody){
    this.fileService.dropFiles(extractRequest(requestBody));
    return success();
  }

  @Override
  public ResponseWrapper<ContextHeader, FileVm> create(FileVm viewModel) {
    return null;
  }

  @Override
  public ResponseWrapper<ContextHeader, FileVm> update(Long id, FileVm viewModel) {
    return null;
  }
}
