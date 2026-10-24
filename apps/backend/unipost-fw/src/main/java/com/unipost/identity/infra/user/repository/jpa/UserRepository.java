package com.unipost.identity.infra.user.repository.jpa;

import com.unipost.repository.jpa.BaseRepository;
import com.unipost.user.model.User;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends BaseRepository<User> {

  User findByUserName(String username);

  User deleteByUserName(String username);

  int countByIdNotAndUserNameIgnoreCase(Long id, String userName);

  int countByIdNotAndEmail(Long id, String email);

  int countByUserNameIgnoreCase(String userName);

  int countByEmail(String email);

  @Modifying
  @Query("UPDATE #{#entityName} A SET A.status = ENABLED WHERE A.userName = ?1 AND A.deletedDate IS NULL")
  Integer enableUser(String userName);

  @Modifying
  @Query("UPDATE #{#entityName} A SET A.status = DISABLED WHERE A.userName = ?1 AND A.deletedDate IS NULL")
  Integer disableUser(String userName);

}
