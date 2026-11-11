package com.acc.fs.domain.repository;

import com.acc.fs.domain.model.FsObjectAggregate;
import com.acc.fs.domain.model.valobj.FileId;

import java.util.List;
import java.util.Optional;

/**
 * Secondary Driven Port (SPI) for file metadata persistence.
 */
public interface FsObjectRepositoryPort {

    void save(FsObjectAggregate aggregate);

    Optional<FsObjectAggregate> findById(FileId id);

    List<FsObjectAggregate> findAllByParentUid(String tenantId, String parentUid);

    List<FsObjectAggregate> findAllDirectories(String tenantId, String parentUid);

    void deleteById(FileId id);
}
