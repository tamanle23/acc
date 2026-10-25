package com.acc.repository.jpa;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import com.acc.domain.BaseModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean
public interface BaseRepository<T extends BaseModel>
    extends JpaRepository<T, Long>, JpaSpecificationExecutor<T> {

  @Override
  @Query("SELECT A FROM #{#entityName} A WHERE A.deletedDate IS NULL")
  List<T> findAll();

  @Query("SELECT A FROM #{#entityName} A WHERE A.deletedDate IS NULL AND A.id IN ?1")
  List<T> findAllByIdIn(List<Long> ids);

  @Query("SELECT A FROM #{#entityName} A WHERE A.deletedDate IS NULL AND A.uid IN ?1")
  List<T> findAllByUidIn(Set<String> uids);

  @Query("SELECT A FROM #{#entityName} A WHERE A.id=?1 AND A.deletedDate IS NULL")
  T findOne(Long id);

  @Modifying
  @Query("UPDATE #{#entityName} A SET A.deletedDate = ?#{T(com.acc.core.helper.DateTimeHelper).getCurrentDateTime()} WHERE A.id NOT IN ?1")
  Integer deleteByIdNotIn(List<Long> ids, LocalDateTime date);

  @Modifying
  @Query("UPDATE #{#entityName} A SET A.deletedDate = ?#{T(com.acc.core.helper.DateTimeHelper).getCurrentDateTime()} WHERE A.id IN ?1")
  Integer deleteByIdIn(List<Long> ids);

  @Modifying
  @Query("UPDATE #{#entityName} A SET A.deletedDate = ?#{T(com.acc.core.helper.DateTimeHelper).getCurrentDateTime()} WHERE A.uid IN ?1")
  Integer deleteByUidIn(Set<String> uids);

  @Modifying
  @Query("UPDATE #{#entityName} A SET A.deletedDate = ?#{T(com.acc.core.helper.DateTimeHelper).getCurrentDateTime()} WHERE A.id = ?1")
  void deleteById(Long id);

  @Modifying
  @Query("UPDATE #{#entityName} A SET A.deletedDate = ?#{T(com.acc.core.helper.DateTimeHelper).getCurrentDateTime()} WHERE A.uid = ?1 AND A.deletedDate IS NULL")
  Integer deleteByUid(String uid);

  @Query("SELECT A FROM #{#entityName} A WHERE A.uid=?1 AND A.deletedDate IS NULL")
  T findOneByUid(String uid);

  @Query("SELECT A.uid FROM #{#entityName} A WHERE A.uid in (?1) AND A.deletedDate IS NULL")
  List<String> findUidsByUidIn(Set<String> uids);
}
