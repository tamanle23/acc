package com.acc.fs.controller;

import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.core.constant.PermissionActionConstants;
import com.acc.core.constant.ResourceConstants;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.SearchCondition;
import com.acc.fs.controller.response.FileVm;
import com.acc.fs.controller.response.Link;
import com.acc.fs.model.FileAttributes;
import com.acc.fs.model.FsObject;
import com.acc.fs.service.LinkService;
import org.apache.commons.lang.BooleanUtils;
import org.apache.commons.lang.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.MvcUriComponentsBuilder;

import com.acc.core.io.ResponseWrapper;
import com.acc.fs.controller.mapping.FileMapper;
import com.acc.fs.service.FileService;
import com.acc.fs.connector.StorageConnector;
import com.acc.fs.connector.StorageServiceFactory;
import com.acc.fw.QueryController;

@RestController
@RequestMapping("api/fs")
public class ObjectQueryController extends QueryController<FsObject, FileVm, SearchCondition>{

  @Autowired
  StorageServiceFactory storageServiceFactory;

  @Autowired
  FileService fileService;

  @Autowired
  LinkService linkService;

  @Autowired
  FileMapper fileMapper;

  @Autowired
  private ObjectMapper objectMapper;

  @Override
  public String getResourceName() {
    return ResourceConstants.FILE;
  }

  private void populateDownloadLink(List<FileVm> files) {
    files.forEach(file -> {
      if(BooleanUtils.isFalse(file.getIsDirectory())) {
        file.setFullPath(MvcUriComponentsBuilder.fromMethodName(ObjectQueryController.class, "download" , file.getUid())
                                                .build()
                                                .toString());
      }
    });
  }

  @GetMapping("/{uid}/_uid/download")
  @ResponseBody
  @PreAuthorize(value = "hasPermission(this.getResourceName(), '"+ PermissionActionConstants.DOWNLOAD + "')")
  public ResponseEntity<Resource> download(@PathVariable String uid) throws IOException {
    FsObject fsObject = fileService.findByUid(uid);
    StorageConnector storageConnector = storageServiceFactory.getConnector(fsObject.getConnector());
    FileAttributes fileAttributes = Optional.ofNullable(fsObject.getAttributesJson())
                                            .filter(Objects::nonNull)
                                            .orElse(FileAttributes.builder().code(fsObject.getCode()).build());
    if (StringUtils.isBlank(fileAttributes.getCode())) {
      fileAttributes.setCode(fsObject.getCode());
    }
    Resource resource = storageConnector.loadAsResource(fileAttributes);
    return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION
                               ,String.format("attachment; filename=\"%s.%s\"", fsObject.getName(), fsObject.getExtension()))
                        .contentLength(fileAttributes.getSize())
                        .contentType(MediaType.APPLICATION_OCTET_STREAM)
                        .body(resource);
  }

  @GetMapping(value="/{uid}/_parent_uid")
  @PreAuthorize(value = "hasPermission(this.getResourceName(), '"+ PermissionActionConstants.LIST + "')")
  @ResponseBody
  public ResponseWrapper<ContextHeader, List<FileVm>> getAllInDirectory(@PathVariable String uid){
    return success(this.fileService.findAllByParentUid(uid).stream().map(fileMapper::fileToFileVM).collect(Collectors.toList()));
  }

  @GetMapping(value="/{uid}/_parent_uid/_directory")
  @PreAuthorize(value = "hasPermission(this.getResourceName(), '"+ PermissionActionConstants.LIST + "')")
  @ResponseBody
  public ResponseWrapper<ContextHeader, List<FsObject>> getAllFileInDirectory(@PathVariable String uid){
    return success(this.fileService.findAllDirectories(uid));
  }

  @GetMapping(value="/{uid}/_parent_uid/_object")
  @PreAuthorize(value = "hasPermission(this.getResourceName(), '"+ PermissionActionConstants.LIST + "')")
  @ResponseBody
  public ResponseWrapper<ContextHeader,?> getAllSubDirectory(@PathVariable(required = false) String uid, Pageable pageable){
    List<FileVm> files = this.fileService.findAllFilesByParentUid("null".equalsIgnoreCase(uid)? null : uid)
                           .stream()
                           .map(file -> fileMapper.fileToFileVM(file))
                           .collect(Collectors.toList());

//    if(context.checkPermissions(Arrays.asList(PermissionConstants.FILE_DOWNLOAD))) {
      this.populateDownloadLink(files);
//    }
    return success(files);
  }

  @GetMapping(value="/link/{uid}")
  @PreAuthorize(value = "hasPermission(this.getResourceName(), '"+ PermissionActionConstants.DOWNLOAD + "')")
  @ResponseBody
  public ResponseWrapper<ContextHeader, Link> getLink(@PathVariable("uid") String uid){
    return success(linkService.getLink(uid));
  }
}
