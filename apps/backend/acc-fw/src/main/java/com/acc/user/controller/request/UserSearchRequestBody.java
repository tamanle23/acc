package com.acc.user.controller.request;

import com.acc.core.io.PageRequest;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserSearchRequestBody {
  PageRequest pageRequest;
  UserSearchCondition searchCondition;
}
