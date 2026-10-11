package com.unipost.fw.tenancy.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.fw.tenancy.TenantContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Filter that enforces tenant-level rate limiting using distributed token buckets.
 * Executes after HeaderSanitizerFilter (Order 1) so TenantContextHolder is populated.
 */
@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class TenantRateLimitFilter extends OncePerRequestFilter {

    private final TenantRateLimitService rateLimitService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Skip non-API or public health endpoints
        if (!path.startsWith("/api/v1/") || path.contains("/actuator") || path.contains("/swagger") || path.contains("/api-docs")) {
            filterChain.doFilter(request, response);
            return;
        }

        String tenantId = TenantContextHolder.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        // Determine plan tier: can be injected via header or defaults to BASIC
        String planTier = request.getHeader("X-Tenant-Tier");
        if (planTier == null || planTier.isBlank()) {
            planTier = "BASIC";
        }

        TenantRateLimitService.RateLimitResult result = rateLimitService.consumeToken(tenantId, planTier);

        // Always add rate-limiting headers for API transparency
        response.addHeader("X-RateLimit-Limit", String.valueOf(result.capacity()));
        response.addHeader("X-RateLimit-Remaining", String.valueOf(result.tokensRemaining()));

        if (!result.allowed()) {
            log.warn("Rate limit exceeded for tenant '{}' on path '{}' (tier: {})", tenantId, path, planTier);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.addHeader("Retry-After", String.valueOf(result.retryAfterSeconds()));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

            Map<String, Object> errorBody = Map.of(
                    "code", "429",
                    "error", "RATE_LIMIT_EXCEEDED",
                    "message", "Rate limit quota exceeded for tenant: " + tenantId + ". Please slow down your requests.",
                    "retryAfterSeconds", result.retryAfterSeconds()
            );

            response.getWriter().write(objectMapper.writeValueAsString(errorBody));
            return;
        }

        filterChain.doFilter(request, response);
    }
}
