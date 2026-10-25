package com.acc.sandbox.auth;

import com.acc.core.io.ContextHeader;
import com.acc.core.io.RequestWrapper;
import com.acc.core.io.ResponseWrapper;
import com.acc.domain.AuthenticationToken;
import com.acc.fw.core.jwt.JwtTokenHelper;
import com.acc.user.controller.request.AuthenticationRequestBody;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * AOP Aspect intercepting standard TokenService authentication to dynamically issue
 * authentic cryptographic JWTs for sandbox personas without hitting database tables.
 */
@Slf4j
@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@ConditionalOnClass(name = "com.acc.user.service.TokenService")
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class SandboxTokenAspect {

    private final SandboxPersonaRegistry personaRegistry;
    private final ObjectProvider<JwtTokenHelper> jwtTokenHelperProvider;

    public SandboxTokenAspect(
            SandboxPersonaRegistry personaRegistry,
            ObjectProvider<JwtTokenHelper> jwtTokenHelperProvider
    ) {
        this.personaRegistry = personaRegistry;
        this.jwtTokenHelperProvider = jwtTokenHelperProvider;
    }

    @Around("execution(* com.acc.user.service.TokenService.getToken(..)) && args(request)")
    public Object interceptGetToken(ProceedingJoinPoint pjp, RequestWrapper<ContextHeader, AuthenticationRequestBody> request) throws Throwable {
        if (request == null || request.getBody() == null) {
            return pjp.proceed();
        }

        String username = request.getBody().getUserName();
        String password = request.getBody().getPassword();

        Optional<SandboxPersona> personaOpt = personaRegistry.resolve(username, password);
        if (personaOpt.isPresent()) {
            JwtTokenHelper jwtTokenHelper = jwtTokenHelperProvider.getIfAvailable();
            if (jwtTokenHelper == null) {
                return pjp.proceed();
            }

            SandboxPersona persona = personaOpt.get();
            log.info("[SANDBOX-AUTH] Authenticating sandbox persona '{}' ({}) via /api/auth/token", persona.id(), persona.username());

            String clientType = request.getHeader() != null && request.getHeader().getClientType() != null 
                    ? request.getHeader().getClientType() 
                    : "web";

            AuthenticationToken token = mintPersonaToken(jwtTokenHelper, persona, clientType);
            return ResponseWrapper.success(request.getHeader(), token);
        }

        return pjp.proceed();
    }

    @Around("execution(* com.acc.user.service.TokenService.refreshToken(..)) && args(request)")
    public Object interceptRefreshToken(ProceedingJoinPoint pjp, RequestWrapper<ContextHeader, AuthenticationToken> request) throws Throwable {
        if (request == null || request.getBody() == null) {
            return pjp.proceed();
        }

        JwtTokenHelper jwtTokenHelper = jwtTokenHelperProvider.getIfAvailable();
        if (jwtTokenHelper == null) {
            return pjp.proceed();
        }

        String tokenStr = request.getBody().getRefreshToken();
        if (StringUtils.isBlank(tokenStr)) {
            tokenStr = request.getBody().getAccessToken();
        }

        if (StringUtils.isNotBlank(tokenStr)) {
            Optional<Claims> claimsOpt = jwtTokenHelper.getClaims(tokenStr);
            if (claimsOpt.isPresent()) {
                Claims claims = claimsOpt.get();
                String username = claims.getSubject();

                Optional<SandboxPersona> personaOpt = personaRegistry.resolve(username, null);
                if (personaOpt.isPresent()) {
                    SandboxPersona persona = personaOpt.get();
                    log.info("[SANDBOX-AUTH] Refreshing token for sandbox persona '{}' ({})", persona.id(), persona.username());

                    String clientType = request.getHeader() != null && request.getHeader().getClientType() != null 
                            ? request.getHeader().getClientType() 
                            : "web";

                    AuthenticationToken token = mintPersonaToken(jwtTokenHelper, persona, clientType);
                    return ResponseWrapper.success(request.getHeader(), token);
                }
            }
        }

        return pjp.proceed();
    }

    private AuthenticationToken mintPersonaToken(JwtTokenHelper jwtTokenHelper, SandboxPersona persona, String clientType) {
        Map<String, Object> userDetailsMap = new HashMap<>();
        userDetailsMap.put("uid", persona.uid());
        userDetailsMap.put("userName", persona.username());
        userDetailsMap.put("isNonLocked", true);
        userDetailsMap.put("isNonExpired", true);
        userDetailsMap.put("isCredentialsNonExpired", true);
        userDetailsMap.put("isEnabled", true);
        userDetailsMap.put("userType", persona.roles().contains("ROLE_ADMIN") || persona.roles().contains("ROLE_SYSTEM_CUSTODIAN") 
                ? "ADMINISTRATOR" 
                : "NORMAL");

        Map<String, Object> claims = new HashMap<>();
        claims.put(JwtTokenHelper.CLAIM_KEY_USERNAME, persona.username());
        claims.put(JwtTokenHelper.CLAIM_KEY_TENANT_ID, persona.defaultTenantId());
        if (persona.actorTenantId() != null) {
            claims.put("actor_tid", persona.actorTenantId());
        }
        claims.put(JwtTokenHelper.CLAIM_KEY_AUDIENCE, clientType);
        claims.put(JwtTokenHelper.CLAIM_KEY_CREATED, new Date());
        claims.put(JwtTokenHelper.CLAIM_KEY_USER_DETAILS, userDetailsMap);
        claims.put(JwtTokenHelper.CLAIM_KEY_AUTHORITIES, persona.authorities());

        return jwtTokenHelper.getAuthenticationToken(claims);
    }
}
