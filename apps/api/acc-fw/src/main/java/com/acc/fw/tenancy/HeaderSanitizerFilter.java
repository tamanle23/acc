package com.acc.fw.tenancy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Filter that strips incoming client-supplied tenant headers (e.g. X-Tenant-Id)
 * to enforce Zero Client Trust and eliminate Insecure Direct Object Reference (IDOR) attacks.
 * The active tenant context must be derived strictly and cryptographically from verified JWT claims.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class HeaderSanitizerFilter extends OncePerRequestFilter {

    private static final Set<String> STRIPPED_HEADERS = Set.of(
            "x-tenant-id",
            "x-tenant",
            "x-acc-tenant"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        HttpServletRequest sanitizedRequest = new SanitizedHeaderRequestWrapper(request);
        filterChain.doFilter(sanitizedRequest, response);
    }

    private static class SanitizedHeaderRequestWrapper extends HttpServletRequestWrapper {

        public SanitizedHeaderRequestWrapper(HttpServletRequest request) {
            super(request);
        }

        @Override
        public String getHeader(String name) {
            if (name != null && STRIPPED_HEADERS.contains(name.toLowerCase())) {
                return null;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if (name != null && STRIPPED_HEADERS.contains(name.toLowerCase())) {
                return Collections.emptyEnumeration();
            }
            return super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            List<String> names = Collections.list(super.getHeaderNames())
                    .stream()
                    .filter(name -> name != null && !STRIPPED_HEADERS.contains(name.toLowerCase()))
                    .collect(Collectors.toList());
            return Collections.enumeration(names);
        }
    }
}
