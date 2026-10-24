package com.unipost.user.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.unipost.domain.BaseModel;

import com.unipost.user.Constants;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode(callSuper=false)
@NoArgsConstructor
@Entity
@Table(name = Constants.TABLE_PREFIX + "userPermission")
public class UserPermission extends BaseModel {

  private static final long serialVersionUID = 5830125153427440216L;

  @ManyToOne(fetch=FetchType.EAGER)
  @JoinColumn(name="user_uid",referencedColumnName="uid")
  private User user;

  @ManyToOne(fetch=FetchType.EAGER)
  @JoinColumn(name="permission_uid",referencedColumnName="uid")
  private Permission permission;

  private Byte status;

  @Builder
  public UserPermission(User user, Permission permission, Byte status) {
    this.user = user;
    this.permission = permission;
    this.status = status;
  }

}
