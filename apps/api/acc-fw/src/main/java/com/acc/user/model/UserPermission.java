package com.acc.user.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.acc.domain.BaseModel;

import com.acc.user.Constants;
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

  @jakarta.persistence.Column(name = "tenant_id")
  private String tenantId;

  @jakarta.persistence.Column(name = "is_granted")
  private Boolean isGranted;

  @jakarta.persistence.Column(name = "delegated_by_uid")
  private String delegatedByUid;

  @jakarta.persistence.Column(name = "reason")
  private String reason;

  @Builder
  public UserPermission(User user, Permission permission, Byte status, String tenantId, Boolean isGranted, String delegatedByUid, String reason) {
    this.user = user;
    this.permission = permission;
    this.status = status;
    this.tenantId = tenantId;
    this.isGranted = isGranted != null ? isGranted : (status == null || status == 1);
    this.delegatedByUid = delegatedByUid;
    this.reason = reason;
  }
}
