package com.acc.repository.jpa;

import java.util.List;

import com.acc.domain.resource.Resource;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResourceRepository extends JpaRepository<Resource, Long>{
  public List<Resource> findAllByCategory(String category);
}
