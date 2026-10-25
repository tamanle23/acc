package com.acc.boot.config.properties;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Security {
  private int maxSession;
  private String[] permitAlls;
  private String sessionExpiredUrl;
  private String jwtTokenHeader;
  private String jwtTokenSecret;
  private Long jwtTokenExpiration;
  private Long jwtTokenExpirationWeb;
  private Long jwtTokenExpirationMobile;
  private Long jwtRefreshTokenExpiration;

}
