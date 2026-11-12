package com.acc.fw;

import jakarta.inject.Inject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import com.acc.core.context.Context;
import com.acc.core.helper.GenerationHelper;
import com.acc.core.io.CommonReponseBuilder;

public abstract class CommonController extends CommonReponseBuilder {

  protected final Logger logger = LoggerFactory.getLogger(this.getClass());

  @Autowired
  protected GenerationHelper generationHelper;

  @Autowired
  protected Context context;

  @Override
  protected Context getContext() {
    return context;
  }
}
