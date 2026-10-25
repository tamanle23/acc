package com.acc.domain;

import jakarta.servlet.http.Cookie;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AuthenticationToken {
  private String accessToken;
  private String refreshToken;
  private String userType;
  private Long tokenAge;
  @JsonIgnore
  private Cookie cookie;

  private List<String> authorities;

}
