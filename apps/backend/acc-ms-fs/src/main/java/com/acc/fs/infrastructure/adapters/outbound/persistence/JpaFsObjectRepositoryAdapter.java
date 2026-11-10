package com.acc.fs.infrastructure.adapters.outbound.persistence;

import com.acc.fs.domain.model.FsObjectAggregate;
import com.acc.fs.domain.model.valobj.FileId;
import com.acc.fs.domain.repository.FsObjectRepositoryPort;
import com.acc.fs.model.FsObjecRelation;
import com.acc.fs.model.FsObject;
import com.acc.fs.repository.jpa.FileDirectoryRepository;
import com.acc.fs.repository.jpa.FsObjectRepository;
import org.springframework.stereotype.Repository;

import java.time.ZoneId;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class JpaFsObjectRepositoryAdapter implements FsObjectRepositoryPort {

    private final FsObjectRepository fsObjectRepository;
    private final FileDirectoryRepository fileDirectoryRepository;

    public JpaFsObjectRepositoryAdapter(
        FsObjectRepository fsObjectRepository,
        FileDirectoryRepository fileDirectoryRepository
    ) {
        this.fsObjectRepository = fsObjectRepository;
        this.fileDirectoryRepository = fileDirectoryRepository;
    }

    @Override
    public void save(FsObjectAggregate aggregate) {
        FsObject entity = fsObjectRepository.findOneByUid(aggregate.getId().value());
        if (entity == null) {
            entity = new FsObject();
            entity.setUid(aggregate.getId().value());
            entity.setPersisted(true);
        }
        entity.setName(aggregate.name());
        entity.setIsDirectory(aggregate.isDirectory());
        entity.setSize(aggregate.sizeBytes());
        entity.setContentType(aggregate.contentType());
        entity.setRootLocation(aggregate.storagePath());
        entity.setChecksum(aggregate.checksumSha256());
        entity.setOwnerUid(aggregate.tenantId());
        fsObjectRepository.save(entity);
    }

    @Override
    public Optional<FsObjectAggregate> findById(FileId id) {
        FsObject entity = fsObjectRepository.findOneByUid(id.value());
        return Optional.ofNullable(toAggregate(entity));
    }

    @Override
    public List<FsObjectAggregate> findAllByParentUid(String tenantId, String parentUid) {
        if (parentUid == null || parentUid.isBlank()) {
            return Collections.emptyList();
        }
        FsObject parent = fsObjectRepository.findOneByUid(parentUid);
        if (parent == null) {
            return Collections.emptyList();
        }
        List<FsObjecRelation> relations = fileDirectoryRepository.findAllByParent(parent);
        return relations.stream()
            .map(FsObjecRelation::getChild)
            .filter(child -> child != null && (tenantId == null || tenantId.equals(child.getOwnerUid())))
            .map(this::toAggregate)
            .collect(Collectors.toList());
    }

    @Override
    public List<FsObjectAggregate> findAllDirectories(String tenantId, String parentUid) {
        if (parentUid == null || parentUid.isBlank()) {
            List<FsObject> rootDirs = fsObjectRepository.findAllByIsDirectoryTrueAndParent_ParentIdNullAndOwnerUidAndDeletedDateIsNull(tenantId);
            return rootDirs.stream().map(this::toAggregate).collect(Collectors.toList());
        }
        FsObject parent = fsObjectRepository.findOneByUid(parentUid);
        if (parent == null) {
            return Collections.emptyList();
        }
        List<FsObjecRelation> relations = fileDirectoryRepository.findAllByChild_IsDirectoryTrueAndChild_DeletedDateIsNullAndParent(parent);
        return relations.stream()
            .map(FsObjecRelation::getChild)
            .filter(child -> child != null && (tenantId == null || tenantId.equals(child.getOwnerUid())))
            .map(this::toAggregate)
            .collect(Collectors.toList());
    }

    @Override
    public void deleteById(FileId id) {
        fsObjectRepository.deleteByUid(id.value());
    }

    private FsObjectAggregate toAggregate(FsObject entity) {
        if (entity == null) {
            return null;
        }
        String parentUid = null;
        if (entity.getParent() != null && entity.getParent().getParent() != null) {
            parentUid = entity.getParent().getParent().getUid();
        }
        long createdEpochMs = entity.getCreatedDate() != null
            ? entity.getCreatedDate().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            : System.currentTimeMillis();
        long updatedEpochMs = entity.getLastUpdatedDate() != null
            ? entity.getLastUpdatedDate().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            : createdEpochMs;

        return new FsObjectAggregate(
            FileId.of(entity.getUid()),
            entity.getOwnerUid() != null ? entity.getOwnerUid() : "default",
            "default",
            entity.getName() != null ? entity.getName() : "unnamed",
            parentUid,
            Boolean.TRUE.equals(entity.getIsDirectory()),
            entity.getSize(),
            entity.getContentType(),
            entity.getRootLocation(),
            entity.getChecksum(),
            createdEpochMs,
            updatedEpochMs
        );
    }
}
