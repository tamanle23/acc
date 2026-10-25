package com.acc.service;

import java.util.List;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;

import com.acc.core.io.ContextHeader;

import com.acc.core.io.RequestWrapper;

/**
 * Generic CRUD service
 *
 * @param <T> the generic type
 */
public interface CrudService<T> {

    public T findById(Long id);

    public T findByUid(String uid);

    public T create(Supplier<T> entitySupplier);

    public List<T> createBulk(Supplier<List<T>>  entities);

    public T modify(Long id, Consumer<T> updateMapping);

    public T modify(String uid, Consumer<T> updateMapping);

    public void delete(T entity);

    public boolean deleteById(Long id);

    public boolean deleteByUid(String uid);

    public void deleteByUids(Set<String> uids);

    public List<T> findAll(RequestWrapper<ContextHeader, Void> request);

    public T checkExistence(Long id);

    public void checkConsistency(T entity, T existing);

}
