package com.unipost.user.controller.response;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RoleRm {
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
}
