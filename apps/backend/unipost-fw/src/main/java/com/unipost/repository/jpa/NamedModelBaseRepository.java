package com.unipost.repository.jpa;

import com.unipost.domain.NamedModel;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean
public interface NamedModelBaseRepository<T extends NamedModel>
    extends BaseRepository<T> {
  @Modifying
  @Query("UPDATE #{#entityName} A SET A.deletedDate = ?#{T(com.unipost.core.helper.DateTimeHelper).getCurrentDateTime()} WHERE A.code = ?1")
  Integer deleteByCode(String code);

  @Query("SELECT A FROM #{#entityName} A WHERE A.code=?1 AND A.deletedDate IS NULL")
  T findOneByCode(String code);

}
