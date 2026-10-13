package com.unipost.tenant.purge;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Rejects mutating requests with HTTP 423 Locked for tenants currently being purged.
 * Reads are allowed so operators can still poll status.
 */
@Component
@RequiredArgsConstructor
public class TenantPurgeLockdownFilter extends OncePerRequestFilter {

    private static final Set<String> MUTATING = Set.of("POST", "PUT", "PATCH", "DELETE");
    static final String TENANT_HEADER = "X-Tenant-Id";

    private final TenantPurgeLockRegistry lockRegistry;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String tenantId = request.getHeader(TENANT_HEADER);
        if (tenantId != null
                && MUTATING.contains(request.getMethod())
                && lockRegistry.isPurging(tenantId)) {
            response.setStatus(423);
            response.setContentType("application/problem+json");
            response.getWriter().write(
                    "{\"type\":\"urn:problem-type:tenant-purging\",\"title\":\"Tenant Locked\","
                            + "\"status\":423,\"detail\":\"Tenant is being purged under GDPR Article 17\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
