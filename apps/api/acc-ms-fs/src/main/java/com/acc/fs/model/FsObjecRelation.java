package com.acc.fs.model;

import jakarta.persistence.Entity;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import com.acc.domain.BaseModel;

import com.acc.fs.FsConstants;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
@Table(name = FsConstants.TABLE_PREFIX + "objectRelation")
@Entity
public class FsObjecRelation extends BaseModel {

  private static final long serialVersionUID = 4599635207086267918L;

  @OneToOne
  private FsObject parent;

  @OneToOne
  private FsObject child;

  @Builder(toBuilder = true)
  public FsObjecRelation(FsObject parent, FsObject child){
    this.parent = parent;
    this.child = child;
  }
}
