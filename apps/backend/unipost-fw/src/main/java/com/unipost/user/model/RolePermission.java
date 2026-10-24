package com.unipost.user.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.unipost.domain.BaseModel;
import com.unipost.user.Constants;
import org.hibernate.annotations.DynamicInsert;
import org.hibernate.annotations.DynamicUpdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = Constants.TABLE_PREFIX + "rolePermission")
@Builder
@NoArgsConstructor
@AllArgsConstructor
@DynamicInsert
@DynamicUpdate
public class RolePermission extends BaseModel {

  private static final long serialVersionUID = 1217557527599530076L;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "permission_uid", referencedColumnName = "uid")
  private Permission permission;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "role_uid", referencedColumnName = "uid")
  private Role role;
}
