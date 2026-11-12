package com.acc.fw;

import java.lang.reflect.ParameterizedType;

import jakarta.inject.Inject;

import com.acc.domain.NamedModel;
import com.acc.service.CrudService;

public abstract class BaseRestController<T extends NamedModel> extends CommonController {

    @Inject
    protected CrudService<T> dataService;

    private Class<T> entityClass;

    @SuppressWarnings("unchecked")
    public BaseRestController(){
      this.entityClass = ((Class<T>) ((ParameterizedType) this.getClass()
                                                              .getGenericSuperclass())
                                                              .getActualTypeArguments()[0]);

    }
}
