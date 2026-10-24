package com.unipost.user.controller.request;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import com.unipost.user.controller.request.PermissionVm;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RoleVm {
  protected Long id;
  protected String uid;
  protected String code;
  protected String description;
  protected String createdBy;
  protected LocalDateTime createdDate;
  private String lastUpdatedBy;
  private LocalDateTime lastUpdatedDate;
  private Long version;
  private Long numberOfUsers;

  private List<RolePermissionVm> rolePermissions;
  private List<UserRoleVm> roleUsers;
}
