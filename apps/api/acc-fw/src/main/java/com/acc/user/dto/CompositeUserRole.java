package com.acc.user.dto;

import com.acc.user.model.UserRole;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper=true)
@NoArgsConstructor
@AllArgsConstructor
public class CompositeUserRole extends UserRole {

  private static final long serialVersionUID = -4181928368870065447L;
  Boolean enabled;
  Long version;
}
