package com.acc.fw.core.jwt;

import java.io.Serializable;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import javax.crypto.SecretKey;
import jakarta.servlet.http.Cookie;

import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import com.acc.domain.AuthenticationToken;
import com.acc.service.authentication.UserDetailsImpl;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.security.core.userdetails.UserDetails;


public class JwtTokenHelper implements Serializable {

  private static final long serialVersionUID = -3301605591108950415L;

  public static final String CLAIM_KEY_USERNAME = "sub";
  public static final String CLAIM_KEY_AUDIENCE = "audience";
  public static final String CLAIM_KEY_CREATED = "created";
  public static final String CLAIM_KEY_AUTHORITIES = "authorities";
  public static final String CLAIM_KEY_PERMISSIONS = "permissions";
  public static final String CLAIM_KEY_TENANT_ID = "tid";
  public static final String CLAIM_KEY_USER_DETAILS = "userDetails";
  public static final String CLAIM_KEY_TYPE = "type";
  public static final String TOKEN_TYPE_REFRESH = "refresh";

  private static final String AUDIENCE_UNKNOWN = "unknown";
  private static final String AUDIENCE_WEB = "web";
  private static final String AUDIENCE_MOBILE = "mobile";
  private static final String AUDIENCE_TABLET = "tablet";

  @Value("${application.security.jwtTokenHeader}")
  private String tokenHeader;

  @Value("${application.security.jwtTokenSecret}")
  private String secret;

  @Value("${application.security.jwtTokenExpiration}")
  private Long expiration;

  @Value("${application.security.jwtTokenExpirationWeb:#{null}}")
  private Long webExpiration;

  @Value("${application.security.jwtTokenExpirationMobile:#{null}}")
  private Long mobileExpiration;

  @Value("${application.security.jwtRefreshTokenExpiration:2592000000}")
  private Long refreshExpiration;

  @Value("${application.security.jwtCookieName}")
  private String jwtCookieName;

  @Value("${application.security.jwtCookieDomain}")
  private String jwtCookieDomain;

  @Value("${application.security.jwtCookiePath}")
  private String jwtCookiePath;

  @Value("${application.security.jwtCookieSecure}")
  private boolean jwtCookieSecure;


  @SuppressWarnings("unchecked")
  public List<GrantedAuthority> getAuthorities(Claims claims) {
    if (claims == null) {
      return List.of();
    }
    List<String> authorities = Optional.ofNullable(claims.get(CLAIM_KEY_AUTHORITIES))
                  .filter(Objects::nonNull)
                  .map(o -> (List<String>)o)
                  .orElse(List.of());

    List<String> permissions = Optional.ofNullable(claims.get(CLAIM_KEY_PERMISSIONS))
                  .filter(Objects::nonNull)
                  .map(o -> (List<String>)o)
                  .orElse(List.of());

    return Stream.concat(authorities.stream(), permissions.stream())
                 .distinct()
                 .map(SimpleGrantedAuthority::new)
                 .collect(Collectors.toList());
  }

  public Optional<String> getTenantId(Claims claims) {
    return Optional.ofNullable(claims)
                   .map(c -> c.get(CLAIM_KEY_TENANT_ID, String.class))
                   .filter(StringUtils::isNotBlank);
  }

  public Optional<String> getUsername(Claims claims) {
    return Optional.ofNullable(claims).map(Claims::getSubject);
  }

  public Optional<Date> getCreatedDateFromToken(Claims claims) {
    return Optional.ofNullable(claims).map(c->c.get(CLAIM_KEY_CREATED))
                  .filter(Objects::nonNull)
                  .map(Long.class::cast).map(Date::new);
  }

  private Optional<Date> getExpirationDateFromToken(Claims claims) {
    return Optional.ofNullable(claims).map(Claims::getExpiration);
  }

  public Optional<String> getAudienceFromToken(Claims claims) {
    return Optional.ofNullable(claims).map(c->c.get(CLAIM_KEY_AUDIENCE)).map(String.class::cast);
  }

  public Optional<Claims> getClaims(String token) {
    Claims claims;
    try {
      SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
      Jws<Claims> jwsClaims = Jwts.parserBuilder()
//                                  .deserializeJsonWith(new JacksonDeserializer(Maps.of(CLAIM_KEY_USER_DETAILS, UserDetailsImpl.class).build()))
                                  .setSigningKey(key)
                                  .build()
                                  .parseClaimsJws(token);
      claims = jwsClaims.getBody();
    } catch (ExpiredJwtException e) {
      claims = e.getClaims();
    } catch (Exception e) {
      claims = null;
    }
    return Optional.ofNullable(claims);
  }

  private Date getExpDate(Long expiration) {
    return new Date(System.currentTimeMillis() + expiration);
  }

  private Date getRefreshExpDate() {
    return new Date(System.currentTimeMillis() + refreshExpiration);
  }


  private boolean isTokenExpired(Claims claims) {
    Date currentDate = new Date();
    return getExpirationDateFromToken(claims)
              .map(d -> d.before(currentDate))
              .orElse(true);
  }

  public boolean validate(Claims claims, String userAgent) {
    Optional<String> userAgentOpt = Optional.ofNullable(claims).map(c -> (String)c.get(CLAIM_KEY_AUDIENCE)).filter(u -> userAgent == null || StringUtils.equals(userAgent, u));
    Optional<String> userNameOpt = Optional.ofNullable(claims).map(Claims::getSubject).filter(Objects::nonNull);
    return userNameOpt.isPresent() && userAgentOpt.isPresent() && !isTokenExpired(claims)
//          && !isCreatedBeforeLastPasswordReset(userName, getCreatedDateFromToken(token))
    ;
  }

  private Boolean isCreatedBeforeLastPasswordReset(Date created, Date lastPasswordReset) {
    return (lastPasswordReset != null && created.before(lastPasswordReset));
  }

  private Boolean ignoreTokenExpiration(Claims claims) {
    return Optional.ofNullable(claims).filter(audience -> AUDIENCE_TABLET.equals(audience) || AUDIENCE_MOBILE.equals(audience)).isPresent();
  }

  public AuthenticationToken generateToken(UserDetails userDetails, String userAgent) {
    Map<String, Object> claims = new HashMap<>();
    claims.put(CLAIM_KEY_USERNAME, userDetails.getUsername());
    claims.put(CLAIM_KEY_AUDIENCE, userAgent);
    claims.put(CLAIM_KEY_CREATED, new Date());
    claims.put(CLAIM_KEY_USER_DETAILS, userDetails);
    if(CollectionUtils.isNotEmpty(userDetails.getAuthorities())){
      claims.put(CLAIM_KEY_AUTHORITIES, userDetails.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toList()));
    }
    return getAuthenticationToken(claims);
  }

  public String generateRefreshToken() {
    return generateRefreshToken(new HashMap<>());
  }

  public String generateRefreshToken(Map<String, Object> claims) {
    SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    Map<String, Object> refreshClaims = new HashMap<>();
    if (claims != null) {
      if (claims.containsKey(CLAIM_KEY_USERNAME)) {
        refreshClaims.put(CLAIM_KEY_USERNAME, claims.get(CLAIM_KEY_USERNAME));
      }
      if (claims.containsKey(CLAIM_KEY_AUDIENCE)) {
        refreshClaims.put(CLAIM_KEY_AUDIENCE, claims.get(CLAIM_KEY_AUDIENCE));
      }
    }
    refreshClaims.put(CLAIM_KEY_CREATED, new Date());
    refreshClaims.put(CLAIM_KEY_TYPE, TOKEN_TYPE_REFRESH);
    return Jwts.builder()
        .setClaims(refreshClaims)
        .setExpiration(getRefreshExpDate())
        .signWith(key, SignatureAlgorithm.HS512)
        .compact();
  }

  public AuthenticationToken getAuthenticationToken(Map<String, Object> claims) {
    Date exp = getExpDate(expiration);
    String token = this.generateToken(claims, exp);
    String refreshToken = this.generateRefreshToken(claims);
    Cookie cookie = this.getTokenCookie(token);
    return AuthenticationToken.builder()
                              .accessToken(token)
                              .refreshToken(refreshToken)
                              .tokenAge(exp.getTime())
                              .cookie(cookie)
                              .authorities((List<String>) claims.get(CLAIM_KEY_AUTHORITIES))
                              .build();
  }

  private Boolean canTokenBeRefreshed(Claims claims, Date lastPasswordReset) {
    final Optional<Date> createdOpt = getCreatedDateFromToken(claims);
    return createdOpt.isPresent() && !isCreatedBeforeLastPasswordReset(createdOpt.get(), lastPasswordReset)
        && (!isTokenExpired(claims) || ignoreTokenExpiration(claims));
  }

  private String generateToken(Map<String, Object> claims, Date exp) {
    SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    return Jwts.builder()
                      .setClaims(claims)
                      .setExpiration(exp)
                      .signWith(key, SignatureAlgorithm.HS512)
                      .compact();
  }

  public Optional<String> refreshToken(String token) {
    return getClaims(token).filter(Objects::nonNull)
                           .map(c-> { c.put(CLAIM_KEY_CREATED, new Date()); return c; })
                           .map(c -> this.generateToken(c,  getExpDate(expiration)));
  }

  public Cookie getTokenCookie(String token) {
    final Cookie cookie = new Cookie(jwtCookieName, token);
    if(StringUtils.isNotBlank(jwtCookieDomain)) {
      cookie.setDomain(jwtCookieDomain);
    }
    cookie.setPath(jwtCookiePath);
    cookie.setSecure(jwtCookieSecure);
    cookie.setHttpOnly(true);
    // Cookie lives along with browser session change to 0 to delete cookie immediately
    cookie.setMaxAge(-1);
    return cookie;
  }
}
