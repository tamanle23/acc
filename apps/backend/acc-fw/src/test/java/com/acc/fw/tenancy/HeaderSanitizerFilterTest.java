package com.acc.fw.tenancy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class HeaderSanitizerFilterTest {

    @Test
    void testStripsXTenantIdHeader() throws Exception {
        HeaderSanitizerFilter filter = new HeaderSanitizerFilter();

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Tenant-Id", "attacker-injected-tenant");
        request.addHeader("x-tenant", "evil-tenant");
        request.addHeader("x-acc-tenant", "malicious-tenant");
        request.addHeader("Authorization", "Bearer valid.jwt.token");
        request.addHeader("Accept", "application/json");

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();

        filter.doFilter(request, response, (req, res) -> {
            jakarta.servlet.http.HttpServletRequest httpReq = (jakarta.servlet.http.HttpServletRequest) req;
            assertNull(httpReq.getHeader("X-Tenant-Id"));
            assertNull(httpReq.getHeader("x-tenant-id"));
            assertNull(httpReq.getHeader("x-tenant"));
            assertNull(httpReq.getHeader("x-acc-tenant"));

            // Other headers must be preserved untouched
            assertEquals("Bearer valid.jwt.token", httpReq.getHeader("Authorization"));
            assertEquals("application/json", httpReq.getHeader("Accept"));
        });
    }
}
