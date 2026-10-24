package com.unipost.user.controller.request;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RoleRequestBody {
  Long roleId;
  String roleUid;
}
