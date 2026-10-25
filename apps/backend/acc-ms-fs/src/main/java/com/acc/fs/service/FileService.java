package com.acc.fs.service;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;

import com.acc.core.io.ContextHeader;
import com.acc.core.io.RequestWrapper;
import com.acc.fs.controller.request.ObjectCreationRequestBody;
import com.acc.fs.controller.request.FileDropRequestBody;
import com.acc.fs.controller.request.FileRemovalRequestBody;
import com.acc.fs.model.FsObject;
import com.acc.service.CrudService;

public interface FileService extends CrudService<FsObject>{

  List<FsObject> findAllByParentUid(String uid);

  FsObject register(RequestWrapper<ContextHeader, ObjectCreationRequestBody> request);

  FsObject register(FsObject fsObject, String parentUid, boolean isOverwrite);

  List<FsObject> register(List<FsObject> fsObjects, String parentUid, boolean isOverwrite);

  List<FsObject> register(List<FsObject> fsObjects, String parentUid);

  List<FsObject> findAllDirectories(String uid);

  List<FsObject> findAllFilesByParentUid(String uid);

  List<FsObject> processUploadFile(HttpServletRequest request, String uid, String overwrite);

  void deleteByUids(RequestWrapper<ContextHeader, FileRemovalRequestBody> extractRequest);

  void dropFiles(RequestWrapper<ContextHeader, FileDropRequestBody> extractRequest);
}
