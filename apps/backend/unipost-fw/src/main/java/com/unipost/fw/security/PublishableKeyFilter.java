package com.unipost.fw.security;

import com.unipost.fw.tenancy.TenantContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Filter that authenticates incoming requests using a Publishable Key (pk_live_* or pk_test_*).
 * <p>
 * Supported format: {@code pk_(live|test)_{tenantId}_{token}}
 * <p>
 * When a valid key is provided:
 * <ul>
 *   <li>Resolves the tenant ID embedded in the key</li>
 *   <li>Sets the ThreadLocal tenant context via {@link TenantContextHolder}</li>
 *   <li>Establishes an authenticated {@link PublishableKeyAuthenticationToken} with ROLE_PUBLIC_READER and METADATA_RECORD_READ</li>
 * </ul>
 * For {@code /api/v1/public/**} requests without a key, tenant context is derived from the URI path:
 * {@code /api/v1/public/tenants/{tenantId}/...}
 */
public class PublishableKeyFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(PublishableKeyFilter.class);

    private static final String HEADER_PUBLISHABLE_KEY = "X-Publishable-Key";
    private static final String AUTH_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private static final Pattern PUBLISHABLE_KEY_PATTERN = Pattern.compile("^pk_(live|test)_([a-zA-Z0-9_-]+)_[a-zA-Z0-9_-]+$");
    private static final Pattern PUBLIC_PATH_PATTERN = Pattern.compile("^/api/v1/public/tenants/([a-zA-Z0-9_-]+)(/.*)?$");

    private static final List<SimpleGrantedAuthority> PUBLIC_READER_AUTHORITIES = List.of(
            new SimpleGrantedAuthority("ROLE_PUBLIC_READER"),
            new SimpleGrantedAuthority("METADATA_RECORD_READ")
    );

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String rawKey = extractPublishableKey(request);
        String path = request.getRequestURI();
        boolean isPublicPath = path != null && path.startsWith("/api/v1/public");

        String tenantIdFromKey = null;

        if (rawKey != null && !rawKey.isBlank()) {
            Matcher keyMatcher = PUBLISHABLE_KEY_PATTERN.matcher(rawKey.trim());
            if (keyMatcher.matches()) {
                tenantIdFromKey = keyMatcher.group(2);
                PublishableKeyAuthenticationToken authToken = new PublishableKeyAuthenticationToken(
                        rawKey,
                        tenantIdFromKey,
                        PUBLIC_READER_AUTHORITIES
                );
                SecurityContextHolder.getContext().setAuthentication(authToken);
            } else if (isPublicPath) {
                log.warn("Invalid publishable key format received: {}", rawKey);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid publishable key format");
                return;
            }
        }

        // If no key was provided but accessing /api/v1/public/tenants/{tenantId}/..., derive tenant from path
        String effectiveTenantId = tenantIdFromKey;
        if (effectiveTenantId == null && isPublicPath) {
            Matcher pathMatcher = PUBLIC_PATH_PATTERN.matcher(path);
            if (pathMatcher.matches()) {
                effectiveTenantId = pathMatcher.group(1);
            }
        }

        try {
            if (effectiveTenantId != null && !effectiveTenantId.isBlank()) {
                TenantContextHolder.setTenantId(effectiveTenantId);
                MDC.put("tenantId", effectiveTenantId);
            }
            filterChain.doFilter(request, response);
        } finally {
            if (effectiveTenantId != null) {
                TenantContextHolder.clear();
                MDC.remove("tenantId");
            }
        }
    }

    private String extractPublishableKey(HttpServletRequest request) {
        String key = request.getHeader(HEADER_PUBLISHABLE_KEY);
        if (key != null && !key.isBlank()) {
            return key.trim();
        }

        String authHeader = request.getHeader(AUTH_HEADER);
        if (authHeader != null && authHeader.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            String token = authHeader.substring(BEARER_PREFIX.length()).trim();
            if (token.startsWith("pk_live_") || token.startsWith("pk_test_")) {
                return token;
            }
        }
        return null;
    }
}
