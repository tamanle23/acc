package com.unipost.user.controller.request;

import com.unipost.core.io.PageRequest;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserSearchRequestBody {
  PageRequest pageRequest;
  UserSearchCondition searchCondition;
}
