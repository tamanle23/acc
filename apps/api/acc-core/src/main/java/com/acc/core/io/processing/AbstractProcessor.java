package com.acc.core.io.processing;

import lombok.Data;

@Data
public abstract class AbstractProcessor<I,C, CB> implements Processor<I, C> {

  protected Callback<CB> callback;

}
