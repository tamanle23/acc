package com.unipost.identity.infra.user.repository.jpa;

import org.springframework.data.repository.NoRepositoryBean;

import com.unipost.repository.jpa.BaseRepository;
import com.unipost.user.model.User;

@NoRepositoryBean
public interface BaseUserRepository<T extends User> extends BaseRepository<T> {

  T findByUserName(String username);

  T deleteByUserName(String username);

  int countByIdNotAndUserNameIgnoreCase(Long id, String userName);

  int countByIdNotAndEmail(Long id, String email);

  int countByUserNameIgnoreCase(String userName);

  int countByEmail(String email);
}
