package com.unipost.user.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.unipost.domain.BaseModel;

import com.unipost.user.Constants;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
@Entity
@Table(name = Constants.TABLE_PREFIX + "userRole")
public class UserRole extends BaseModel {

  private static final long serialVersionUID = -4012955347774504236L;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "user_uid", referencedColumnName = "uid")
  private User user;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "role_uid", referencedColumnName = "uid")
  private Role role;
}
