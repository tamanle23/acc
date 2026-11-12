package com.acc.cache.jest;

import io.searchbox.client.JestClient;
import io.searchbox.client.JestResult;
import io.searchbox.indices.CreateIndex;
import io.searchbox.indices.DeleteIndex;
import io.searchbox.indices.IndicesExists;
import io.searchbox.indices.Refresh;
import java.io.IOException;
import lombok.Builder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class IndexInitializer {

  private static final String ASSERT_MSG_INDEX_NOT_NULL = "Index cannot be null";

  private static final Logger logger = LoggerFactory.getLogger(IndexInitializer.class);

  private JestClient jestClient;

  @Builder
  public IndexInitializer(JestClient jestClient) {
    this.jestClient = jestClient;
  }

  public boolean isExisted(Index index) throws IOException {
    if (index == null) {
      throw new IllegalArgumentException(ASSERT_MSG_INDEX_NOT_NULL);
    }
    return jestClient.execute(new IndicesExists.Builder(index.getName()).build()).isSucceeded();
  }

  public boolean delete(Index index) throws IOException {
    if (index == null) {
      throw new IllegalArgumentException(ASSERT_MSG_INDEX_NOT_NULL);
    }

    logger.info("Index[name={}] is being deleted ...", index.getName());
    JestResult jestResult = jestClient.execute(new DeleteIndex.Builder(index.getName()).build());
    if (!jestResult.isSucceeded()) {
      logger.debug("Index deletion failed with error: {}", jestResult.getErrorMessage());
    } else {
      logger.debug("Index deletion succeed: {}", jestResult.getJsonString());
    }
    return jestResult.isSucceeded();
  }

  public boolean create(Index index) throws IOException {
    if (index == null) {
      throw new IllegalArgumentException(ASSERT_MSG_INDEX_NOT_NULL);
    }
    logger.info("Index[name={}] is being created ...", index.getName());
    CreateIndex.Builder actionBuilder = new CreateIndex.Builder(index.getName());
    actionBuilder.settings(index.getConfigurationJson());
    if (index.getParameterMap() != null && index.getParameterMap().size() > 0) {
      index.getParameterMap().keySet().forEach(key -> actionBuilder.setParameter(key, index.getParameterMap().get(key)));
    }
    JestResult jestResult = jestClient.execute(actionBuilder.build());
    if (!jestResult.isSucceeded()) {
      logger.debug("Index creation failed with error: {}", jestResult.getErrorMessage());
    } else {
      logger.debug("Index creation succeed: {}", jestResult.getJsonString());
    }
    return jestResult.isSucceeded();
  }

  public boolean refresh(Index index) {
    String indexName = index.getName();
    Refresh refresh = new Refresh.Builder().addIndex(indexName).refresh(true).build();
    JestResult jestResult;
    try {
      jestResult = jestClient.execute(refresh);
      boolean succeeded = jestResult.isSucceeded();
      if (succeeded) {
        logger.info("Refresh of Index [{}] successful.", indexName);
      } else {
        logger.error("Refresh of Index [{}] failed.", indexName);
      }
      return succeeded;
    } catch (IOException ex) {
      logger.error("FAIL to refresh index:{} with error {}", indexName, ex);
    }
    return false;
  }

}
