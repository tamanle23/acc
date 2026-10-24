package com.unipost.identity.infra.user.repository.jpa;

import java.util.List;

import com.unipost.domain.UserBaseModel;

import com.unipost.repository.jpa.NamedModelBaseRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean
public interface UserBaseRepository<T extends UserBaseModel> extends NamedModelBaseRepository<T> {

  @Query("SELECT A FROM #{#entityName} A WHERE A.deletedDate IS NULL AND A.ownerUid = ?1")
  List<T> findAllByOwner(String userUid);
}
