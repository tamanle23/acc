package com.acc.worker.batch;

import com.acc.core.logging.LoggerFactory;
import org.slf4j.Logger;
import org.springframework.batch.core.listener.ItemListenerSupport;
import org.springframework.batch.infrastructure.item.Chunk;
import org.springframework.stereotype.Component;

@Component
public class ItemLogListener<I,O> extends ItemListenerSupport<I,O> {
  private static Logger logger = LoggerFactory.getLogger(ItemLogListener.class);

  @Override
  public void onReadError(Exception e) {
    logger.error("Encountered error on read", e);
  }

  @Override
  public void onWriteError(Exception e, Chunk<? extends O> items) {
    logger.error("Encountered error on write", e);
  }
}
