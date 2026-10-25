package com.acc.fs.repository.jpa;

import java.util.List;

import com.acc.fs.model.FsObject;
import com.acc.repository.jpa.NamedModelBaseRepository;

public interface FsObjectRepository extends NamedModelBaseRepository<FsObject> {

  List<FsObject> findAllByIsDirectoryTrueAndParent_ParentIdNullAndOwnerUidAndDeletedDateIsNull(String uid);

  FsObject findOneByUidAndOwnerUid(String uid, String owner);
}
