package com.acc.fw.core.jwt;

import com.acc.domain.AuthenticationToken;
import com.acc.service.authentication.UserDetailsImpl;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

public class JwtTokenHelperTest {

  private JwtTokenHelper jwtTokenHelper;
  private static final String SECRET_512_BIT = "OTMxMURGMEJFMjA0MTBFOEUyMUIzQTU1MjFGMzkxRTFBODM5Mzc1MkZDNUNGQkM4ODUyNTU2RENERUI3RkVGREVGODVFMjZENDQ2MkE3MjcyMTk2MDlDNzE5NDg3MzgyNEE2RDZDQ0QwMTA3Qjg4REFDRUI5OUZEMUYwQ0MwMDI=";

  @BeforeEach
  public void setUp() {
    jwtTokenHelper = new JwtTokenHelper();
    ReflectionTestUtils.setField(jwtTokenHelper, "secret", SECRET_512_BIT);
    ReflectionTestUtils.setField(jwtTokenHelper, "expiration", 3600000L); // 1 hour
    ReflectionTestUtils.setField(jwtTokenHelper, "refreshExpiration", 2592000000L); // 30 days
    ReflectionTestUtils.setField(jwtTokenHelper, "jwtCookieName", "X-AUTH-TOKEN");
    ReflectionTestUtils.setField(jwtTokenHelper, "jwtCookiePath", "/");
    ReflectionTestUtils.setField(jwtTokenHelper, "jwtCookieSecure", false);
  }

  private UserDetailsImpl createTestUser() {
    Map<String, Object> map = new HashMap<>();
    map.put("userName", "testuser");
    map.put("password", "password");
    map.put("isNonExpired", true);
    map.put("isNonLocked", true);
    map.put("isCredentialsNonExpired", true);
    map.put("isEnabled", true);
    return new UserDetailsImpl(map, Collections.emptyList());
  }

  @Test
  public void testGenerateTokenIncludesRefreshToken() {
    UserDetailsImpl userDetails = createTestUser();
    AuthenticationToken token = jwtTokenHelper.generateToken(userDetails, "web");

    assertNotNull(token);
    assertNotNull(token.getAccessToken());
    assertNotNull(token.getRefreshToken());
    assertFalse(token.getAccessToken().isEmpty());
    assertFalse(token.getRefreshToken().isEmpty());
  }

  @Test
  public void testValidateRefreshToken() {
    UserDetailsImpl userDetails = createTestUser();
    AuthenticationToken token = jwtTokenHelper.generateToken(userDetails, "web");

    Optional<Claims> claimsOpt = jwtTokenHelper.getClaims(token.getRefreshToken());
    assertTrue(claimsOpt.isPresent());
    assertEquals("testuser", claimsOpt.get().getSubject());
    assertTrue(jwtTokenHelper.validate(claimsOpt.get(), "web"));
  }
}
