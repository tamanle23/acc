package com.acc.user.model;

import jakarta.persistence.*;

import com.acc.domain.NamedModel;
import com.acc.user.Constants;
import com.acc.user.model.enums.PermissionLevel;
import com.acc.user.model.enums.PermissionType;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = Constants.TABLE_PREFIX + "permission")
public class Permission extends NamedModel {

  private static final long serialVersionUID = 4396393555601831943L;

  @Enumerated(EnumType.STRING)
  protected PermissionType type;

  @Enumerated(EnumType.STRING)
  protected PermissionLevel level;

  private String target;

  private String action;
}
