package com.acc.service;

import java.lang.reflect.ParameterizedType;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import com.acc.core.exception.ErrorCodes;
import com.acc.core.io.CommonReponseBuilder;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.RequestWrapper;
import com.acc.domain.BaseModel;
import org.apache.commons.collections.CollectionUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import com.acc.core.context.Context;
import com.acc.core.exception.BusinessException;
import com.acc.repository.jpa.BaseRepository;

public abstract class BaseModelService<T extends BaseModel,R extends BaseRepository<T>> extends CommonReponseBuilder implements CrudService<T> {

  protected Class<T> entityClass;

  @Autowired
  protected R repository;

  @Autowired
  protected EntityManager entityManager;

  @Autowired
  protected Context context;

  @Autowired
  protected PageBuilder pageBuilder;

  @Override
  protected Context getContext() {
    return context;
  }

  @Value("${application.data.softDelete:true}")
  Boolean softDelete;

  @Value("${application.data.bulkSize:50}")
  Integer bulkSize;

  public R getRepository() {
    return this.repository;
  }

  @SuppressWarnings("unchecked")
  public BaseModelService() {
    entityClass = ((Class<T>) ((ParameterizedType) this.getClass().getGenericSuperclass()).getActualTypeArguments()[0]);
  }

  @Override
  public void checkConsistency(T entity, T existing) {
    if (!entity.getVersion().equals(existing.getVersion())) {
      throw BusinessException.create().add(ErrorCodes.ERROR_NOT_CONSISTENT);
    }
  }

  @Override
  public T checkExistence(Long id) {
    T existing = this.getRepository().findOne(id);
    if (existing == null) {
      throw BusinessException.create().add(ErrorCodes.ERROR_NOT_EXISTED);
    }
    return existing;
  }

  public T checkExistenceByUid(String uid) {
    T existing = this.getRepository().findOneByUid(uid);
    if (existing == null) {
      throw BusinessException.create().add(ErrorCodes.ERROR_NOT_EXISTED);
    }
    return existing;
  }

  public void checkExistenceByUids(Set<String> uids) {
    List<String> notExistedUids = this.getRepository()
                                      .findUidsByUidIn(uids)
                                      .stream()
                                      .filter(uid -> !uids.contains(uid))
                                      .collect(Collectors.toList());
    if (CollectionUtils.isNotEmpty(notExistedUids)) {
      throw BusinessException.create().addMessages(ErrorCodes.ERROR_NOT_EXISTED, notExistedUids.toArray(new String[0]));
    }
  }

  protected T checkExistence(T entity) {
    return this.checkExistence(entity.getId());
  }

  @Override
  public T findById(Long id) {
    return this.checkExistence(id);
  }

  @Override
  public List<T> findAll(RequestWrapper<ContextHeader, Void> request) {
    return this.getRepository().findAll();
  }

  public Page<T> findAll(Pageable pageable) {
    return this.getRepository().findAll(pageable);
  }

  public Page<T> findAll(PageRequest pageable) {
    if (pageable == null) {
      return this.getRepository().findAll(PageRequest.of(0, 20));
    }
    return this.getRepository().findAll((Pageable) pageable);
  }


  public List<T> findAll() {
    return this.getRepository().findAll();
  }

  public Page<T> findAllByCriteria(Specification<T> criteria, Pageable pageable) {
    return this.getRepository().findAll(criteria, pageable);
  }

  @Override
  public void delete(T baseModel) {
    this.deleteById(baseModel.getId());
  }

  @Override
  public boolean deleteById(Long id) {
    if(softDelete) {
      this.getRepository().deleteById(id);
    } else {
      this.getRepository().delete(this.getRepository().getOne(id));
    }
    return true;
  }

  @Override
  @Transactional
  public boolean deleteByUid(String uid) {
    if(softDelete) {
      if(this.getRepository().deleteByUid(uid) != 1) {
        return false;
      }
    } else {
      this.getRepository().delete(this.findByUid(uid));
    }
    return true;
  }

  @Override
  @Transactional
  public void deleteByUids(Set<String> uids) {
    if(uids.size() > this.bulkSize) {
      BusinessException.create().add(ErrorCodes.ERROR_MAX_BULK_REACHED).throwEx();
    }
    if(softDelete) {
      this.getRepository().deleteByUidIn(uids);
    } else {
      this.getRepository().deleteAll(this.getRepository().findAllByUidIn(uids));
    }
  }

  @Override
  public T findByUid(String uid) {
    return this.checkExistenceByUid(uid);
  }

  @Override
  public List<T> createBulk(Supplier<List<T>> entities) {
    return Optional.ofNullable(entities.get())
                   .map(List::stream)
                   .orElse(Stream.empty())
                   .map(entity -> this.create(() -> entity))
                   .collect(Collectors.toList());
  }

  @Override
  public T create(Supplier<T> entitySupplier) {
    if(entitySupplier != null) {
      T entity = entitySupplier.get();
      return this.getRepository().save(entity);
    }
    return null;
  }

  @Override
  public T modify(Long id, Consumer<T> updateMapping) {
    T existing = this.getRepository().getOne(id);
    updateMapping.accept(existing);
    return this.getRepository().save(existing);
  }

  @Override
  public T modify(String uid, Consumer<T> updateMapping) {
    T existing = this.checkExistenceByUid(uid);
    updateMapping.accept(existing);
    return this.getRepository().save(existing);
  }
}
