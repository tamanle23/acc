package com.acc.fw.tenancy;

import com.acc.fw.context.AsyncContextTaskDecorator;
import com.acc.fw.core.jwt.JwtAuthenticationToken;
import com.acc.fw.core.jwt.JwtTokenHelper;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class TenantSecurityLifecycleTest {

    private JwtTokenHelper jwtTokenHelper;
    private static final String SECRET_512_BIT = "OTMxMURGMEJFMjA0MTBFOEUyMUIzQTU1MjFGMzkxRTFBODM5Mzc1MkZDNUNGQkM4ODUyNTU2RENERUI3RkVGREVGODVFMjZENDQ2MkE3MjcyMTk2MDlDNzE5NDg3MzgyNEE2RDZDQ0QwMTA3Qjg4REFDRUI5OUZEMUYwQ0MwMDI=";

    @BeforeEach
    void setUp() {
        jwtTokenHelper = new JwtTokenHelper();
        ReflectionTestUtils.setField(jwtTokenHelper, "secret", SECRET_512_BIT);
        ReflectionTestUtils.setField(jwtTokenHelper, "expiration", 3600000L);
        ReflectionTestUtils.setField(jwtTokenHelper, "refreshExpiration", 2592000000L);
        ReflectionTestUtils.setField(jwtTokenHelper, "jwtCookieName", "X-AUTH-TOKEN");
        ReflectionTestUtils.setField(jwtTokenHelper, "jwtCookiePath", "/");
        ReflectionTestUtils.setField(jwtTokenHelper, "jwtCookieSecure", false);

        TenantContextHolder.clear();
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    void testTenantContextHolderRequiredTenantId() {
        assertThrows(IllegalStateException.class, TenantContextHolder::getRequiredTenantId);

        TenantContextHolder.setTenantId("tnt_alpha_123");
        assertEquals("tnt_alpha_123", TenantContextHolder.getRequiredTenantId());
        assertEquals("tnt_alpha_123", TenantContextHolder.getTenantId());

        TenantContextHolder.clear();
        assertThrows(IllegalStateException.class, TenantContextHolder::getRequiredTenantId);
    }

    @Test
    void testJwtTokenHelperParsesTenantIdAndPermissions() {
        Map<String, Object> claims = new HashMap<>();
        claims.put(JwtTokenHelper.CLAIM_KEY_USERNAME, "operator@acme.com");
        claims.put(JwtTokenHelper.CLAIM_KEY_AUDIENCE, "web");
        claims.put(JwtTokenHelper.CLAIM_KEY_TENANT_ID, "tnt_acme_99");
        claims.put(JwtTokenHelper.CLAIM_KEY_AUTHORITIES, List.of("ROLE_OPERATOR"));
        claims.put(JwtTokenHelper.CLAIM_KEY_PERMISSIONS, List.of("METADATA_RECORD_READ", "METADATA_RECORD_WRITE"));

        var authToken = jwtTokenHelper.getAuthenticationToken(claims);
        assertNotNull(authToken.getAccessToken());

        Optional<Claims> parsedClaims = jwtTokenHelper.getClaims(authToken.getAccessToken());
        assertTrue(parsedClaims.isPresent());

        // Verify tenant ID
        Optional<String> tenantId = jwtTokenHelper.getTenantId(parsedClaims.get());
        assertTrue(tenantId.isPresent());
        assertEquals("tnt_acme_99", tenantId.get());

        // Verify authorities merged with permissions
        List<GrantedAuthority> authorities = jwtTokenHelper.getAuthorities(parsedClaims.get());
        Set<String> authorityNames = new HashSet<>();
        authorities.forEach(a -> authorityNames.add(a.getAuthority()));

        assertTrue(authorityNames.contains("ROLE_OPERATOR"));
        assertTrue(authorityNames.contains("METADATA_RECORD_READ"));
        assertTrue(authorityNames.contains("METADATA_RECORD_WRITE"));
    }

    @Test
    void testAsyncContextTaskDecoratorPropagatesContextToWorkerThread() throws Exception {
        TenantContextHolder.setTenantId("tnt_tenant_async_42");
        MDC.put("tenantId", "tnt_tenant_async_42");

        JwtAuthenticationToken auth = new JwtAuthenticationToken(
                "user1",
                null,
                List.of(),
                "tnt_tenant_async_42"
        );
        SecurityContextHolder.getContext().setAuthentication(auth);

        AsyncContextTaskDecorator decorator = new AsyncContextTaskDecorator(null);

        AtomicReference<String> workerTenant = new AtomicReference<>();
        AtomicReference<String> workerMdc = new AtomicReference<>();
        AtomicReference<String> workerPrincipal = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);

        Runnable decorated = decorator.decorate(() -> {
            workerTenant.set(TenantContextHolder.getTenantId());
            workerMdc.set(MDC.get("tenantId"));
            if (SecurityContextHolder.getContext().getAuthentication() != null) {
                workerPrincipal.set((String) SecurityContextHolder.getContext().getAuthentication().getPrincipal());
            }
            latch.countDown();
        });

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            executor.submit(decorated);
            assertTrue(latch.await(3, TimeUnit.SECONDS));

            assertEquals("tnt_tenant_async_42", workerTenant.get());
            assertEquals("tnt_tenant_async_42", workerMdc.get());
            assertEquals("user1", workerPrincipal.get());
        } finally {
            executor.shutdownNow();
        }
    }
}
