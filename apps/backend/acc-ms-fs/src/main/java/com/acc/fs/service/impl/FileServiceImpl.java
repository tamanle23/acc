package com.acc.fs.service.impl;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.acc.core.exception.ErrorCodes;
import com.acc.fs.config.MultipartHelper;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.RequestWrapper;
import com.acc.core.logging.LoggerFactory;
import com.acc.fs.connector.StorageException;
import com.acc.fs.connector.StorageServiceFactory;
import com.acc.fs.controller.request.ObjectCreationRequestBody;
import com.acc.fs.model.*;
import com.acc.fs.repository.jpa.FsObjectRepository;
import io.reactivex.rxjava3.disposables.Disposable;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.BooleanUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.util.Strings;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.acc.core.exception.BusinessException;
import com.acc.core.helper.GenerationHelper;
import com.acc.domain.JpaHelpers;
import com.acc.fs.controller.request.FileDropRequestBody;
import com.acc.fs.controller.request.FileRemovalRequestBody;
import com.acc.fs.repository.jpa.FileDirectoryRepository;
import com.acc.fs.service.FileService;
import com.acc.fs.connector.StorageConnector;
import com.acc.service.shared.UserService;
import com.acc.service.BaseModelService;
import org.apache.commons.fileupload.FileItemStream;


@Service
public class FileServiceImpl extends BaseModelService<FsObject, FsObjectRepository>  implements FileService  {

  Logger logger = LoggerFactory.getLogger(this.getClass());

  @Autowired
  FileDirectoryRepository fileDirectoryRepository;

  @Autowired
  FsObjectRepository fileRepository;

  @Autowired
  JpaHelpers jpaHelpers;

  @Autowired
  StorageServiceFactory storageServiceFactory;

  @Autowired
  GenerationHelper generationHelper;

  @Autowired
  UserService userServiceEx;

  @Autowired
  FileConnectorConverter fileConnectorConverter;

  @Autowired
  MultipartHelper multipartHelper;

  @Autowired
  ObjectMapper objectMapper;

  @Override
  public List<FsObject> findAllByParentUid(String uid) {
    FsObject fsObject = this.findByUid(uid);
    if(fsObject.getIsDirectory()!=null && fsObject.getIsDirectory()){
      return fileDirectoryRepository.findAllByParent(fsObject)
                                    .stream()
                                    .<FsObject>map(FsObjecRelation::getChild)
                                    .collect(Collectors.toList());
    }
    return Collections.emptyList();
  }

  @Override
  @Transactional
  public FsObject register(RequestWrapper<ContextHeader, ObjectCreationRequestBody> request) {
    return this.register(request.getBody().getObject(), request.getBody().getParentUid(), false);
  }

  @Override
  @Transactional
  public FsObject register(FsObject fsObject, String parentUid, boolean isOverwrite) {
    FsObject parent = null;
    isOverwrite = true;
    if(StringUtils.isNotBlank(parentUid)){
      parent = fileRepository.findOneByUidAndOwnerUid(parentUid,context.getAuthenticationUser());
      if(parent==null) {
        throw BusinessException.create()
                                .add(ErrorCodes.FAIL_PARENT_NOT_EXIST);
      }
      if(BooleanUtils.isFalse(parent.getIsDirectory())) {
        throw BusinessException.create()
                              .add(ErrorCodes.FAIL_PARENT_FILE_NOT_DIRECTORY);
      }
    }
    FsObjecRelation fileDir = null;
    if(isOverwrite) {
      fileDir = this.fileDirectoryRepository.findFirstByChild_OwnerUidAndChild_NameAndChild_ExtensionAndParent_UidAndChild_DeletedDateIsNull(context.getAuthenticationUser(), fsObject.getName(), fsObject.getExtension(), parentUid);
    }
    if(parent != null) {
      fsObject.setLevel(parent.getLevel() + 1);
    } else {
      fsObject.setLevel(0);
    }
    if(fileDir!=null) {
      fileDir.getChild().setChecksum(fsObject.getChecksum());
      fileDir.getChild().setContentType(fsObject.getContentType());
      fileDir.getChild().setPersisted(fsObject.isPersisted());
      fileDir.getChild().setCode(fsObject.getCode());
      fileDir.getChild().setSize(fsObject.getSize());
      fileDir.getChild().setRootLocation(fsObject.getRootLocation());
      fsObject = fileDir.getChild();
    } else {
      fileDir = FsObjecRelation.builder()
                             .child(fsObject)
                             .parent(parent)
                             .build();
    }

    if(!jpaHelpers.isManaged(fsObject)) {
      fsObject.setOwnerUid(context.getAuthenticationUser());
    }

    fsObject = this.getRepository().save(fsObject);
    fileDirectoryRepository.save(fileDir);
    return fsObject;
  }

  @Override
  @Transactional
  public List<FsObject> register(List<FsObject> fsObjects, String parentUid) {
    return this.register(fsObjects, parentUid, false);
  }

  @Override
  @Transactional
  public List<FsObject> register(List<FsObject> fsObjects, String parentUid, boolean isOverwrite) {
    if(CollectionUtils.isNotEmpty(fsObjects)){
      return fsObjects.stream()
                  .map(file->this.register(file,parentUid,isOverwrite))
                  .collect(Collectors.toList());

    }
    return fsObjects;
  }

  @Override
  public List<FsObject> findAllDirectories(String uid) {
    if(StringUtils.isEmpty(uid) || "null".equalsIgnoreCase(uid)) {
      String userUid = super.context.getAuthenticationUser();
      return fileRepository.findAllByIsDirectoryTrueAndParent_ParentIdNullAndOwnerUidAndDeletedDateIsNull(userUid);
    }
    FsObject fsObject = this.findByUid(uid);
    if(fsObject.getIsDirectory() != null && fsObject.getIsDirectory()){
      return fileDirectoryRepository.findAllByChild_IsDirectoryTrueAndChild_DeletedDateIsNullAndParent(fsObject)
                                    .stream()
                                    .<FsObject>map(FsObjecRelation::getChild)
                                    .collect(Collectors.toList());
    }
    return Collections.emptyList();
  }

  @Override
  public List<FsObject> findAllFilesByParentUid(String uid){
    FsObject fsObject = null;
    if(StringUtils.isNotBlank(uid)) {
      fsObject = this.findByUid(uid);
      if(fsObject.getIsDirectory() == null || !fsObject.getIsDirectory()){
        throw BusinessException.create()
                         .add(ErrorCodes.FAIL_PARENT_FILE_NOT_DIRECTORY);
      }
    }
    List<FsObject> fsObjects = fileDirectoryRepository.findAllByChild_DeletedDateIsNullAndParentAndChild_OwnerUid(fsObject, this.context.getAuthenticationUser())
                                  .stream()
                                  .<FsObject>map(FsObjecRelation::getChild)
                                  .collect(Collectors.toList());
    List<String> userUids = Stream.concat(fsObjects.stream().map(FsObject::getCreatedBy), fsObjects.stream().map(FsObject::getLastUpdatedBy))
                                  .filter(Objects::nonNull)
                                  .distinct()
                                  .collect(Collectors.toList());
//    Map<String, String> usersName = Optional.ofNullable(userUids)
//                                            .map(userServiceEx::getUsersName)
//                                            .map(ResponseWrapper::getBody)
//                                            .orElse(new HashMap<>());
    return fsObjects.stream()
                .map(f -> {
//                   f.setCreatedBy(usersName.get(f.getCreatedBy()));
//                   f.setLastUpdatedBy(usersName.get(f.getLastUpdatedBy()));
                   return f;
                })
                .collect(Collectors.toList());
  }

  @Override
  @Transactional
  public List<FsObject> processUploadFile(HttpServletRequest request, String uid, String overwrite) {

    final Map<String, FsObject> files = new HashMap<>();
    final Map<String, FileItemStream> fileItems = new HashMap<>();
    List<FsObject> registeredFsObjects = new ArrayList<>();
    final AtomicReference<Boolean> isPersistFail = new AtomicReference<>(true);
    final AtomicReference<Long> size = new AtomicReference<>(0L);
    final AtomicReference<String> connector = new AtomicReference<String>(Strings.EMPTY);
    Disposable disposable = this.multipartHelper
        .flowable(request)
        .filter(fileItem -> "props".equals(fileItem.getFieldName())
            || ("object".equals(fileItem.getFieldName()) && !fileItem.isFormField()))
        .doOnError(error -> isPersistFail.set(true))
        .subscribe(fileItem ->{
          if("object".equals(fileItem.getFieldName())) {
            FsObject fsObject = FsObject.builder()
              .name(FilenameUtils.getBaseName(fileItem.getName()))
              .extension(FilenameUtils.getExtension(fileItem.getName()))
              .contentType(fileItem.getContentType())
              .isPersisted(false)
              .isDirectory(false)
              .connector(fileConnectorConverter.convertToEntityAttribute(connector.get()))
              .build();
            fsObject = this.register(fsObject, uid, true);
            StorageConnector storageConnector;
            if(fsObject.getConnector()!=null) {
              storageConnector = storageServiceFactory.getConnector(fsObject.getConnector());
            } else {
              storageConnector = storageServiceFactory.getConnector(FileConnector.S3);
            }
            String code = storageConnector.acquireIdentifier();
            try {
              FileAttributes attributes = storageConnector.store(fileItem.getInputStream(), size.get(), code);
              fsObject.setAttributesJson(attributes);
              fsObject.setCode(code);
              fsObject.setSize(attributes.getSize());
              fsObject.setContentType(attributes.getContentType());
              fsObject.setConnector(storageConnector.getConnector());
              fsObject.setPersisted(true);
              this.fileRepository.save(fsObject);
              registeredFsObjects.add(fsObject);
              isPersistFail.set(false);
            } catch(StorageException ex) {
              isPersistFail.set(true);
            }
          } else if("props".equals(fileItem.getFieldName())){
            ObjectNode propsNode = this.objectMapper.readValue(IOUtils.toString(fileItem.getInputStream(), StandardCharsets.UTF_8), ObjectNode.class);
            size.set(Long.parseLong(propsNode.path("size").asText()));
            connector.set(propsNode.path("connector").asText());
          }
        });
    if(isPersistFail.get()) {
      BusinessException.create().add(ErrorCodes.ERROR_FILE_PERSIST_FAILED).throwEx();;
    }
    return registeredFsObjects;
  }

  private String getFileNameKey(String uid, String name, String extension) {
    return String.format("%s-%s-%s", uid, name, extension);
  }


  @Override
  @Transactional
  public void deleteByUids(RequestWrapper<ContextHeader, FileRemovalRequestBody> request) {
    this.deleteByUids(request.getBody().getUids());
  }

  @Override
  @Transactional
  public void dropFiles(RequestWrapper<ContextHeader, FileDropRequestBody> request) {
    FsObject target = fileRepository.findOneByUid(request.getBody().getTarget().getUid());
    if(target == null || !target.getIsDirectory()) {
      throw BusinessException.create().add(ErrorCodes.ERROR_TARGET_FILE_NOT_FOUND);
    }
    List<FsObjecRelation> fileDirectories = null;
    List<String> cutUids = new ArrayList<>();
    if(CollectionUtils.isNotEmpty(request.getBody().getCut())) {
      cutUids.addAll(request.getBody().getCut().stream().map(FsObject::getUid).collect(Collectors.toList()));
    }
    if(CollectionUtils.isNotEmpty(cutUids)) {
      fileDirectories = this.fileDirectoryRepository.findAllByChild_UidIn(cutUids);
      fileDirectories.forEach(fileDirectory -> fileDirectory.setParent(target));
      this.fileDirectoryRepository.saveAll(fileDirectories);
    }

    Set<String> copyUids = new HashSet<>();
    if(CollectionUtils.isNotEmpty(request.getBody().getCopy())) {
      copyUids.addAll(request.getBody().getCopy().stream().map(FsObject::getUid).collect(Collectors.toList()));
    }
    if(CollectionUtils.isNotEmpty(copyUids)) {
      List<FsObject> fsObjects = this.fileRepository.findAllByUidIn(copyUids);
      StorageConnector storageConnector = storageServiceFactory.getConnector(FileConnector.DEFAULT_CONNECTOR);
      jpaHelpers.detach(fsObjects);
      fsObjects.parallelStream().forEach(file -> {
        file.setId(null);
        file.setParent(null);
        file.setChildren(null);
        if(file.isPersisted()) {
          FileAttributes newAttributes = storageConnector.copy(file.getAttributesJson());
          file.setCode(newAttributes.getCode());
          file.setAttributesJson(newAttributes);
        } else {
          file.setCode(storageConnector.acquireIdentifier());
        }
      });
      fsObjects = this.repository.saveAll(fsObjects);
      this.repository.flush();
      fileDirectories = fsObjects.stream().map(file -> new FsObjecRelation(target, file)).collect(Collectors.toList());
      this.fileDirectoryRepository.saveAll(fileDirectories);
    }
  }
}
