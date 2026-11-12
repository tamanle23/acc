package com.acc.cache.jest;

import java.io.IOException;
import java.lang.reflect.ParameterizedType;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.StopWatch;

import com.google.gson.Gson;

import io.searchbox.client.JestClient;
import io.searchbox.client.JestResult;
import io.searchbox.client.JestResultHandler;
import io.searchbox.core.Bulk;
import io.searchbox.core.Count;
import io.searchbox.core.CountResult;
import io.searchbox.core.Delete;
import io.searchbox.core.DeleteByQuery;
import io.searchbox.core.DocumentResult;
import io.searchbox.core.Get;
import io.searchbox.core.Index;
import io.searchbox.core.MultiGet;
import io.searchbox.core.Search;
import io.searchbox.core.SearchResult;
import io.searchbox.core.Update;

public abstract class JestRepository<T, ID> implements EsRepository<T, ID> {

  private static Collection<Class<?>> ID_TYPES =
      Arrays.asList(
          Boolean.class,
          Character.class,
          Byte.class,
          Short.class,
          Integer.class,
          Long.class,
          Float.class,
          Double.class,
          String.class);

  @Autowired(required = false)
  protected Gson gson;

  protected String indexName;

  protected JestClient jestClient;

  protected Logger logger = LoggerFactory.getLogger(this.getClass());

  private Class<T> documentTypeClass;

  private String typeName;

  @SuppressWarnings("unchecked")
  public JestRepository(JestClient jestClient, String indexName, String typeName) {
    this.indexName = indexName + "-" + typeName;
    this.typeName = typeName;
    this.jestClient = jestClient;
    this.documentTypeClass =
        ((Class<T>)
            ((ParameterizedType) this.getClass().getGenericSuperclass())
                .getActualTypeArguments()[0]);
    Class<ID> idTypeClass =
        ((Class<ID>)
            ((ParameterizedType) this.getClass().getGenericSuperclass())
                .getActualTypeArguments()[1]);
    if (!ID_TYPES.contains(idTypeClass)) {
      throw new RuntimeException(
          String.format(
              "ID's type[%s] is not allowed.Only support primitive type for ID.", idTypeClass));
    }
    if (gson == null) {
      gson = new Gson();
    }
  }

  public String getIndexName() {
    return indexName;
  }

  boolean bulkIndex(Collection<T> entities, Boolean refreshFlag) {
    if (logger.isDebugEnabled()) {
      logger.debug("Start bulk indexing - {} objects", entities.size());
    }
    JestResult jestResult;
    Bulk.Builder bulkBuilder = new Bulk.Builder();
    entities.forEach(
        entity ->
            bulkBuilder.addAction(
                new Index.Builder(entity).index(this.indexName).type(this.typeName).build()));
    Bulk build = bulkBuilder.refresh(refreshFlag).build();
    try {
      jestResult = jestClient.execute(build);
      logger.info(
          "Bulk indexing objects of type[{}].index[{}] Started.",
          this.typeName,
          this.indexName);
      if (logger.isTraceEnabled()) {
        logger.trace("Reponse status {}", jestResult.getJsonString());
      }
      boolean isSuccess = jestResult.isSucceeded();
      logger.info(
              "Bulk indexing objects of type[{}].index[{}] {}.",
              this.typeName, this.indexName, isSuccess);
      // logging error when Index building failed for entities
		if (!isSuccess) {
			logger.error("ERROR while building bulk Indexing. ERROR details are : {}, Entities are : {}", jestResult.getJsonString());
		}
	 return isSuccess;
     } catch (IOException ex) {
      logger.error("FAIL to build bulk index for type[{}] in index[{}].", this.typeName, this.indexName, ex);
      throw new ElasticsearchOperationException("FAIL to build bulk index for type[" + this.typeName + "]", ex);
    }
  }

  public Long countByQuery(String query) {
    String _query = this.wrapQuery(query);
    Count countAction =
        new Count.Builder().addIndex(this.indexName).addType(this.typeName).query(_query).build();
    CountResult result;
    try {
      result = jestClient.execute(countAction);
      if (result.isSucceeded()) {
        logger.trace(result.getJsonString());
        return result.getCount().longValue();
      } else {

        logger.error("FAIL to execute search request.\r\n{}", result.getErrorMessage());
        return 0L;
      }
    } catch (IOException ex) {
      logger.error("FAIL to execute search request for query: {}", query, ex);
      throw new ElasticsearchOperationException("FAIL to execute search count query: " + query, ex);
    }
  }

  public boolean delete(ID id) {
    String _id = String.valueOf(id);
    JestResult jestResult;
    Delete deleteByIndexAction =
        new Delete.Builder(_id)
            .index(this.indexName)
            .type(this.typeName)
            .refresh(Boolean.TRUE)
            .build();
    try {
      jestResult = jestClient.execute(deleteByIndexAction);
      logger.trace(
          "Delete object[id={}] of type[{}] successfully.",
          jestResult.getValue("_id"),
          jestResult.getPathToResult());
      return jestResult.isSucceeded();
    } catch (IOException ex) {
      logger.error("FAIL to delete object[id={}]", id, ex);
      throw new ElasticsearchOperationException("FAIL to delete object[id=" + id + "]", ex);
    }
  }

  public void deleteAsync(long id) {
    String _id = String.valueOf(id);
    Delete indexToBeDeleted =
        new Delete.Builder(_id).index(this.indexName).type(this.typeName).build();
    jestClient.executeAsync(
        indexToBeDeleted,
        new JestResultHandler<DocumentResult>() {
          @Override
          public void completed(DocumentResult documentResult) {
            logger.trace(
                "Delete object[id={}] of type[{}] successfully.",
                documentResult.getId(),
                documentResult.getType());
          }

          @Override
          public void failed(Exception e) {
            logger.error("FAIL to delete object.", e);
          }
        });
  }

  public boolean deleteByQuery(String query) {
    JestResult jestResult;
    String wrapQuery = wrapQuery(query);
    DeleteByQuery deleteByQueryAction =
        new DeleteByQuery.Builder(wrapQuery)
            .addIndex(this.indexName)
            .addType(this.typeName)
            .build();
    try {
      jestResult = jestClient.execute(deleteByQueryAction);
      logger.trace("Delete objects of type[{}] by query[{}] successfully.", this.typeName, query);
      return jestResult.isSucceeded();
    } catch (IOException ex) {
      logger.error("FAIL to delete objects by query[query={}]", query, ex);
      throw new ElasticsearchOperationException("FAIL to delete objects by query[" + query + "] in type[" + this.typeName + "]", ex);
    }
  }

  private boolean executeUpdate(List<Update> updateActions) {
    JestResult jestResult = null;
    Bulk bulkAction = new Bulk.Builder().addAction(updateActions).build();
    if (logger.isDebugEnabled()) {
      logger.debug("Start bulk partial indexing - {} objects", updateActions.size());
    }
    if (logger.isTraceEnabled()) {
      logger.trace("Bulk objects: {}");
    }
    try {
      jestResult = jestClient.execute(bulkAction);

      if (!jestResult.isSucceeded()) {
        logger.info(
            "Bulk partial indexing objects failed with message: {} ", jestResult.getErrorMessage());
      } else {
        logger.info(
            "Bulk partial indexing objects of type[{}].index[{}] successfully.",
            this.typeName,
            this.indexName);
      }
      return jestResult.isSucceeded();
    } catch (IOException ex) {
      logger.error("FAIL to update object's index for type[{}].", this.typeName, ex);
      throw new ElasticsearchOperationException("FAIL to update object's index in bulk for type[" + this.typeName + "]", ex);
    }
  }

  @Override
  public List<T> findAll(Collection<ID> ids) {
    return this.findByIds(ids);
  }

  public T findById(ID id) {
    T resultObject = null;
    String _id = String.valueOf(id);
    Get get = new Get.Builder(this.indexName, _id).type(this.typeName).build();
    JestResult jestResult = null;
    try {
      jestResult = jestClient.execute(get);
    } catch (IOException e) {
      logger.error("FAIL to get index[id={}] of type[{}].", id, this.typeName, e);
      throw new ElasticsearchOperationException("FAIL to get index[id=" + id + "] of type[" + this.typeName + "]", e);
    }
    if (jestResult != null) {
      resultObject = jestResult.getSourceAsObject(this.documentTypeClass);
    }
    return resultObject;
  }

  public List<T> findByIds(Collection<ID> ids) {
    List<T> resultObjects = null;
    MultiGet multiGet =
        new MultiGet.Builder.ById(this.indexName, this.typeName)
            .addId(ids.stream().map(String::valueOf).collect(Collectors.toList()))
            .build();
    JestResult jestResult;
    if (logger.isTraceEnabled()) {
      logger.trace("Bulk get - IDs of type[{}]: {}\r\n{}", ids, this.typeName, multiGet);
    }
    try {
      jestResult = jestClient.execute(multiGet);
      if (jestResult != null && jestResult.isSucceeded()) {
        resultObjects = jestResult.getSourceAsObjectList(this.documentTypeClass);
        if (logger.isDebugEnabled()) {
          logger.debug("Bulk get {} successfully with count: {} ",this.typeName, resultObjects.size());
        }
        if (logger.isTraceEnabled()) {
          logger.trace("\r\n{}", jestResult.getJsonString());
        }
      }
    } catch (IOException e) {
      logger.error("FAIL to get index[id={}] of type[{}].", ids, this.typeName, e);
      throw new ElasticsearchOperationException("FAIL to get bulk indices for ids in type[" + this.typeName + "]", e);
    }
    return resultObjects;
  }

  public boolean index(T entity, Boolean refreshFlag) {
    Index indexAction =
        new Index.Builder(entity)
            .index(this.indexName)
            .type(this.typeName)
            .refresh(refreshFlag)
            .build();
    JestResult jestResult = null;
    try {
      jestResult = jestClient.execute(indexAction);
      logger.info(
          "Indexing object[id={}] of type[{}] successfully.",
          jestResult.getValue("_id"),
          jestResult.getPathToResult());

      return jestResult.isSucceeded();
    } catch (IOException ex) {
      logger.error("FAIL to build object's index for type[{}].", this.typeName, ex);
      throw new ElasticsearchOperationException("FAIL to build object's index for entity in type[" + this.typeName + "]", ex);
    }
  }

  public void indexAsync(T entity) {
    Index index = new Index.Builder(entity).index(this.indexName).type(this.typeName).build();
    jestClient.executeAsync(
        index,
        new JestResultHandler<JestResult>() {
          @Override
          public void completed(JestResult result) {
            logger.info(
                "Indexing object[id={}] of type[{}] successfully.",
                result.getValue("_id"),
                result.getPathToResult());
          }

          @Override
          public void failed(Exception e) {
            logger.error("FAIL to build object's index.", e);
          }
        });
  }

  public boolean partiallyUpdate(ID id, Map<String, Object> objectMap) {
    String _id = String.valueOf(id);
    Update updateAction =
        new Update.Builder(this.wrapPartialUpdate(objectMap))
            .index(this.indexName)
            .type(this.typeName)
            .id(_id)
            .build();
    JestResult jestResult = null;
    try {
      jestResult = jestClient.execute(updateAction);
      logger.info(
          "Partial indexing object of type[{}].index[{}] successfully.",
          this.typeName,
          this.indexName);
      return jestResult.isSucceeded();
    } catch (IOException ex) {
      logger.error("FAIL to partial indexing object.", ex);
      throw new ElasticsearchOperationException("FAIL to partially update object[id=" + id + "] in type[" + this.typeName + "]", ex);
    }
  }

  @Override
  public boolean partiallyUpdate(ID id, T entity) {
    String _id = String.valueOf(id);
    Update updateAction =
        new Update.Builder(this.wrapPartialUpdate(entity))
            .index(this.indexName)
            .type(this.typeName)
            .id(_id)
            .build();
    JestResult jestResult = null;
    try {
      jestResult = jestClient.execute(updateAction);
      logger.info(
          "Partial indexing object of type[{}].index[{}] successfully.",
          this.typeName,
          this.indexName);
      return jestResult.isSucceeded();
    } catch (IOException ex) {
      logger.error("FAIL to partial indexing object.", ex);
      throw new ElasticsearchOperationException("FAIL to partially update entity[id=" + id + "] in type[" + this.typeName + "]", ex);
    }
  }

  @Override
  public boolean partiallyUpdate(Map<ID, T> objectsMap) {
    if (logger.isDebugEnabled()) {
      logger.debug("Start bulk partial indexing - {} objects", objectsMap.size());
    }
    if (logger.isTraceEnabled()) {
      logger.trace("Bulk objects: {}");
    }
    Bulk.Builder bulkBuilder = new Bulk.Builder();
    objectsMap.forEach(
        (id, entity) ->
            bulkBuilder.addAction(
                new Update.Builder(this.wrapPartialUpdate(entity))
                    .index(this.indexName)
                    .type(this.typeName)
                    .id(String.valueOf(id))
                    .build()));
    JestResult jestResult = null;
    try {
      jestResult = jestClient.execute(bulkBuilder.refresh(true).build());
      boolean status = jestResult.isSucceeded();
      if (status) {
        logger.info(
            "Bulk partial indexing objects of type[{}].index[{}] successfully.",
            this.typeName,
            this.indexName);
      } else {
        logger.error(
            "Bulk partial indexing objects of type[{}].index[{}] failed with error : {} ",
            this.typeName,
            this.indexName,
            jestResult.getErrorMessage());
      }
    } catch (IOException ex) {
      logger.error("FAIL to update object's index.", ex);
      throw new ElasticsearchOperationException("FAIL to bulk partial update objects in type[" + this.typeName + "]", ex);
    }
    return false;
  }

  public boolean partiallyUpdate(Map<ID, T> objectsMap, int batchSize) {
    boolean flag = true;
    if (batchSize <= 0) {
      throw new IllegalArgumentException("batchSize = " + batchSize);
    }
    List<Update> updateActions = new ArrayList<>(Math.min(objectsMap.size(), batchSize));
    for (Map.Entry<ID, T> keyValue : objectsMap.entrySet()) {
      updateActions.add(
          new Update.Builder(this.wrapPartialUpdate(keyValue.getValue()))
              .index(this.indexName)
              .type(this.typeName)
              .id(String.valueOf(keyValue.getKey()))
              .build());
      if (updateActions.size() == batchSize) {
        flag = flag && executeUpdate(updateActions);
        updateActions.clear();
      }
    }
    if (!updateActions.isEmpty()) {
      flag = flag && executeUpdate(updateActions);
    }
    return flag;
  }

  public boolean partiallyUpdateMap(Map<ID, Map<String, Object>> objectsMap) {
    if (logger.isDebugEnabled()) {
      logger.debug("Start bulk partial indexing - {} objects", objectsMap.size());
    }
    if (logger.isTraceEnabled()) {
      logger.trace("Bulk objects: {}");
    }
    Bulk.Builder bulkBuilder = new Bulk.Builder();
    objectsMap.forEach(
        (id, objectMap) ->
            bulkBuilder.addAction(
                new Update.Builder(this.wrapPartialUpdate(objectMap))
                    .index(this.indexName)
                    .type(this.typeName)
                    .id(String.valueOf(id))
                    .build()));
    JestResult jestResult = null;
    try {
      jestResult = jestClient.execute(bulkBuilder.build());
      logger.info(
          "Bulk partial indexing objects of type[{}].index[{}] successfully.",
          this.typeName,
          this.indexName);
      return jestResult.isSucceeded();
    } catch (IOException ex) {
      logger.error("FAIL to update object's index.", ex);
      throw new ElasticsearchOperationException("FAIL to bulk partial update object map in type[" + this.typeName + "]", ex);
    }
  }

  @Override
  public void save(List<T> objects) {
    this.bulkIndex(objects, true);
  }

  @Override
  public void saveWithoutRefresh(List<T> objects) {
    this.bulkIndex(objects, false);
  }

  @Override
  public void save(T object) {
    this.index(object, true);
  }

  public JestQueryResult<T> search(String query) {
    Long count = this.countByQuery(query);
    if (count == null || count <= 0) {
      return JestQueryResult.<T>builder().content(new ArrayList<>()).build();
    }
    return this.search(query, 1, count);
  }

  public JestQueryResult<T> search(String query, Integer page, Long size) {
    StopWatch stopWatch = new StopWatch();
    stopWatch.start();
    String _query = this.wrapQuery(query, page, size);
    logger.trace("Execute search query={}", _query);
    Search search =
        new Search.Builder(_query).addIndex(this.indexName).addType(this.typeName).build();
    JestQueryResult.JestQueryResultBuilder<T> resultBuilder =
        new JestQueryResult.JestQueryResultBuilder<>();
    SearchResult result = null;
    try {
      result = jestClient.execute(search);
    } catch (IOException ex) {
      logger.error("FAIL to execute search request.", ex);
      throw new ElasticsearchOperationException("FAIL to execute search query[" + query + "] in type[" + this.typeName + "]", ex);
    }
    if (result != null && result.isSucceeded()) {
      List<SearchResult.Hit<T, Void>> hits = result.getHits(this.documentTypeClass);
      resultBuilder.total(result.getTotal());
      resultBuilder.size(hits.size());
      resultBuilder.page(page > 0 ? page : 1);
      resultBuilder.totalPages(
          (int) (result.getTotal() / size + (result.getTotal() % size > 0 ? 1 : 0)));
      resultBuilder.content(hits.stream().map(hit -> hit.source).collect(Collectors.toList()));
      logger.info("Finished searching. Total found={}", result.getTotal());
      if (logger.isTraceEnabled()) {
        logger.trace("\r\n{}", result.getJsonString());
      }
    }
    stopWatch.stop();
    logger.info("ES Search Query for {} took {} ms", this.typeName, stopWatch.getTotalTimeMillis());
    return resultBuilder.build();
  }

  protected String wrapPartialUpdate(Map<String, Object> objectMap) {
    StringBuilder payloadBuilder = new StringBuilder();
    payloadBuilder.append("{ \"doc\": ");
    payloadBuilder.append(this.gson.toJson(objectMap));
    payloadBuilder.append("\r\n}");
    return payloadBuilder.toString();
  }

  protected String wrapPartialUpdate(T entity) {
    StringBuilder payloadBuilder = new StringBuilder();
    payloadBuilder.append("{ \"doc\": ");
    payloadBuilder.append(this.gson.toJson(entity));
    payloadBuilder.append("}");
    return payloadBuilder.toString();
  }

  protected String wrapQuery(String query) {
    StringBuilder queryBuilder = new StringBuilder();
    queryBuilder.append("{ \"query\":\r\n");
    queryBuilder.append(query);
    queryBuilder.append("\r\n}");
    return queryBuilder.toString();
  }

  protected String wrapQuery(String query, int page, Long size) {
    if (page <= 0) {
      page = 1;
    }
    if (size < 0) {
      size = 50L;
    }
    StringBuilder queryBuilder = new StringBuilder();
    queryBuilder.append("{ \"query\":\r\n");
    queryBuilder.append(query);
    queryBuilder.append(",\r\n\"from\":");
    queryBuilder.append(page * size - size);
    queryBuilder.append(",\r\n\"size\":");
    queryBuilder.append(size);
    queryBuilder.append("\r\n}");
    return queryBuilder.toString();
  }
}
