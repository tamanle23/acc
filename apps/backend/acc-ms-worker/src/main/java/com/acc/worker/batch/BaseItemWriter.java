package com.acc.worker.batch;

import org.springframework.batch.core.listener.StepExecutionListener;
import org.springframework.batch.infrastructure.item.ItemWriter;

public abstract class BaseItemWriter<T> implements ItemWriter<T>, StepExecutionListener {
  protected int itemCount = 0;
}
