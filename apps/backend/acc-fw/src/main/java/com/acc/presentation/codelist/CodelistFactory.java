package com.acc.presentation.codelist;

import java.util.SortedMap;
import java.util.TreeMap;

import jakarta.inject.Inject;

import com.acc.domain.resource.Resource;
import com.acc.repository.jpa.ResourceRepository;
import org.springframework.beans.factory.FactoryBean;

public class CodelistFactory implements FactoryBean<Codelist> {

  @Inject
  ResourceRepository resourceRepository;

  public Codelist getObject() throws Exception {
    Iterable<Resource> resources = resourceRepository.findAll();
    Codelist codelist = new CodelistImpl();
    SortedMap<String, Resource> resourceList = null;
    for (Resource resource : resources) {
      if (codelist.containsKey(resource.getCategory())) {
        resourceList = codelist.get(resource.getCategory());
      } else {
        resourceList = new TreeMap<String, Resource>();
        codelist.put(resource.getCategory(), resourceList);
      }
      resourceList.put(resource.getResourceKey(), resource);
    }
    return codelist;
  }

  public Class<?> getObjectType() {
    return Codelist.class;
  }

  public boolean isSingleton() {
    return true;
  }
}
