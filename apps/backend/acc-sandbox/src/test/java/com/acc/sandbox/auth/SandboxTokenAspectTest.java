package com.acc.sandbox.auth;

import com.acc.core.io.ContextHeader;
import com.acc.core.io.RequestWrapper;
import com.acc.core.io.ResponseWrapper;
import com.acc.domain.AuthenticationToken;
import com.acc.fw.core.jwt.JwtTokenHelper;
import com.acc.user.controller.request.AuthenticationRequestBody;
import io.jsonwebtoken.Claims;
import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SandboxTokenAspectTest {

    private SandboxPersonaRegistry personaRegistry;
    private JwtTokenHelper jwtTokenHelper;
    private SandboxTokenAspect aspect;

    @BeforeEach
    void setUp() {
        personaRegistry = new SandboxPersonaRegistry();
        jwtTokenHelper = new JwtTokenHelper();
        ReflectionTestUtils.setField(jwtTokenHelper, "secret", "OTMxMURGMEJFMjA0MTBFOEUyMUIzQTU1MjFGMzkxRTFBODM5Mzc1MkZDNUNGQkM4ODUyNTU2RENERUI3RkVGREVGODVFMjZENDQ2MkE3MjcyMTk2MDlDNzE5NDg3MzgyNEE2RDZDQ0QwMTA3Qjg4REFDRUI5OUZEMUYwQ0MwMDI=");
        ReflectionTestUtils.setField(jwtTokenHelper, "expiration", 3600000L);
        ReflectionTestUtils.setField(jwtTokenHelper, "refreshExpiration", 7200000L);
        ReflectionTestUtils.setField(jwtTokenHelper, "jwtCookieName", "token");
        ReflectionTestUtils.setField(jwtTokenHelper, "jwtCookieSecure", false);

        @SuppressWarnings("unchecked")
        org.springframework.beans.factory.ObjectProvider<JwtTokenHelper> provider = mock(org.springframework.beans.factory.ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(jwtTokenHelper);

        aspect = new SandboxTokenAspect(personaRegistry, provider);
    }

    @Test
    @DisplayName("Should intercept getToken for sandbox persona and return genuine JWT with tenantId")
    void testInterceptGetTokenForSandboxPersona() throws Throwable {
        ProceedingJoinPoint pjp = mock(ProceedingJoinPoint.class);

        AuthenticationRequestBody body = new AuthenticationRequestBody();
        body.setUserName("admin@acc.io");
        body.setPassword("any-password");

        ContextHeader header = new ContextHeader();
        header.setClientType("web");
        RequestWrapper<ContextHeader, AuthenticationRequestBody> request = RequestWrapper.create(header, body);

        Object result = aspect.interceptGetToken(pjp, request);

        // Verify pjp.proceed() was NOT called
        verify(pjp, never()).proceed();

        assertTrue(result instanceof ResponseWrapper);
        @SuppressWarnings("unchecked")
        ResponseWrapper<ContextHeader, AuthenticationToken> response = (ResponseWrapper<ContextHeader, AuthenticationToken>) result;
        assertNotNull(response.getBody());

        AuthenticationToken token = response.getBody();
        assertNotNull(token.getAccessToken());
        assertNotNull(token.getRefreshToken());

        // Validate token claims using real JwtTokenHelper
        Optional<Claims> claimsOpt = jwtTokenHelper.getClaims(token.getAccessToken());
        assertTrue(claimsOpt.isPresent());
        Claims claims = claimsOpt.get();

        assertEquals("admin@acc.io", claims.getSubject());
        assertEquals("tenant-acme", jwtTokenHelper.getTenantId(claims).orElse(null));
        assertTrue(claims.get(JwtTokenHelper.CLAIM_KEY_AUTHORITIES).toString().contains("ROLE_ADMIN"));
    }

    @Test
    @DisplayName("Should pass-through getToken for non-sandbox users to real implementation")
    void testInterceptGetTokenPassThrough() throws Throwable {
        ProceedingJoinPoint pjp = mock(ProceedingJoinPoint.class);
        when(pjp.proceed()).thenReturn("real-response");

        AuthenticationRequestBody body = new AuthenticationRequestBody();
        body.setUserName("real_db_user@corp.com");
        body.setPassword("secret123");

        RequestWrapper<ContextHeader, AuthenticationRequestBody> request = RequestWrapper.create(new ContextHeader(), body);

        Object result = aspect.interceptGetToken(pjp, request);

        verify(pjp, times(1)).proceed();
        assertEquals("real-response", result);
    }

    @Test
    @DisplayName("Should intercept refreshToken for sandbox persona")
    void testInterceptRefreshTokenForSandboxPersona() throws Throwable {
        // Mint a valid initial sandbox token
        SandboxPersona persona = personaRegistry.findByUsername("custodian@system").orElseThrow();
        AuthenticationRequestBody body = new AuthenticationRequestBody();
        body.setUserName(persona.username());
        RequestWrapper<ContextHeader, AuthenticationRequestBody> initialReq = RequestWrapper.create(new ContextHeader(), body);
        @SuppressWarnings("unchecked")
        ResponseWrapper<ContextHeader, AuthenticationToken> initialRes = 
                (ResponseWrapper<ContextHeader, AuthenticationToken>) aspect.interceptGetToken(mock(ProceedingJoinPoint.class), initialReq);

        AuthenticationToken initialToken = initialRes.getBody();

        // Refresh it
        ProceedingJoinPoint pjp = mock(ProceedingJoinPoint.class);
        RequestWrapper<ContextHeader, AuthenticationToken> refreshReq = RequestWrapper.create(new ContextHeader(), initialToken);

        Object result = aspect.interceptRefreshToken(pjp, refreshReq);
        verify(pjp, never()).proceed();

        assertTrue(result instanceof ResponseWrapper);
        @SuppressWarnings("unchecked")
        ResponseWrapper<ContextHeader, AuthenticationToken> refreshRes = (ResponseWrapper<ContextHeader, AuthenticationToken>) result;
        assertNotNull(refreshRes.getBody());

        Claims refreshedClaims = jwtTokenHelper.getClaims(refreshRes.getBody().getAccessToken()).orElseThrow();
        assertEquals("custodian@system", refreshedClaims.getSubject());
        assertEquals("SYSTEM", jwtTokenHelper.getTenantId(refreshedClaims).orElse(null));
        assertEquals("SYSTEM", refreshedClaims.get("actor_tid"));
    }
}
