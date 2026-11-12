package com.acc.fw.security;

import com.acc.fw.tenancy.TenantContextHolder;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class PublishableKeyFilterTest {

    private PublishableKeyFilter filter;

    @BeforeEach
    void setUp() {
        filter = new PublishableKeyFilter();
        SecurityContextHolder.clearContext();
        TenantContextHolder.clear();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContextHolder.clear();
    }

    @Test
    void testValidPublishableKeyHeaderSetsTenantContextAndAuth() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/tenants/tenant-alpha/cms/records");
        request.addHeader("X-Publishable-Key", "pk_live_tenant-alpha_abc123secret");

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();

        filter.doFilter(request, response, (req, res) -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            assertNotNull(auth);
            assertTrue(auth instanceof PublishableKeyAuthenticationToken);
            PublishableKeyAuthenticationToken token = (PublishableKeyAuthenticationToken) auth;
            assertEquals("tenant-alpha", token.getTenantId());
            assertEquals("tenant-alpha", TenantContextHolder.getTenantId());
            assertTrue(auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_PUBLIC_READER")));
            assertTrue(auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("METADATA_RECORD_READ")));
        });

        assertEquals(200, response.getStatus());
        // Tenant context must be cleared after filter completion
        assertNull(TenantContextHolder.getTenantId());
    }

    @Test
    void testValidPublishableKeyInBearerAuthorizationHeader() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/tenants/tenant-beta/cms/records");
        request.addHeader("Authorization", "Bearer pk_test_tenant-beta_xyz987token");

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();

        filter.doFilter(request, response, (req, res) -> {
            assertEquals("tenant-beta", TenantContextHolder.getTenantId());
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            assertNotNull(auth);
            assertEquals("public_reader_tenant-beta", auth.getPrincipal());
        });

        assertEquals(200, response.getStatus());
        assertNull(TenantContextHolder.getTenantId());
    }

    @Test
    void testPublicUriDerivesTenantWhenNoKeyProvided() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/tenants/tenant-gamma/cms/records");

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();

        filter.doFilter(request, response, (req, res) -> {
            assertEquals("tenant-gamma", TenantContextHolder.getTenantId());
        });

        assertEquals(200, response.getStatus());
        assertNull(TenantContextHolder.getTenantId());
    }

    @Test
    void testInvalidPublishableKeyFormatRejectsWith401OnPublicPath() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/tenants/tenant-alpha/cms/records");
        request.addHeader("X-Publishable-Key", "invalid_key_format");

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();

        filter.doFilter(request, response, filterChain);

        assertEquals(401, response.getStatus());
        assertNull(TenantContextHolder.getTenantId());
    }
}
