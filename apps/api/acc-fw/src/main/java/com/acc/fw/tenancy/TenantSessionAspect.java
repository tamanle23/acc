package com.acc.fw.tenancy;

import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Aspect that intercepts @Transactional boundaries to execute
 * {@code SET LOCAL app.current_tenant_id = '<tenant_id>'} in PostgreSQL.
 *
 * This binds the tenant session variable for Row-Level Security (RLS) enforcement
 * and automatically resets at the end of the transaction.
 */
@Aspect
@Component
public class TenantSessionAspect {

    private static final Logger log = LoggerFactory.getLogger(TenantSessionAspect.class);
    private static final Pattern SAFE_TENANT_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]{1,64}$");

    private final JdbcTemplate jdbcTemplate;

    public TenantSessionAspect(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Before("@annotation(org.springframework.transaction.annotation.Transactional) || " +
            "@within(org.springframework.transaction.annotation.Transactional)")
    public void setPostgresTenantSession() {
        String tenantId = TenantContextHolder.getTenantId();
        if (tenantId != null && !tenantId.isBlank()) {
            String trimmedTenantId = tenantId.trim();
            // Validate alphanumeric/slug pattern to protect SQL execution
            if (!SAFE_TENANT_ID_PATTERN.matcher(trimmedTenantId).matches()) {
                throw new IllegalArgumentException("Invalid tenant identifier format: " + trimmedTenantId);
            }
            try {
                jdbcTemplate.execute("SET LOCAL app.current_tenant_id = '" + trimmedTenantId + "'");
                
                // Flag PostgreSQL session if operating under Sovereign Custodian authority
                if (TenantContextHolder.isSovereignActor() || "SYSTEM".equalsIgnoreCase(trimmedTenantId)) {
                    jdbcTemplate.execute("SET LOCAL app.is_system_custodian = 'true'");
                } else {
                    jdbcTemplate.execute("SET LOCAL app.is_system_custodian = 'false'");
                }

                // Tier 3 Database Circuit Breaker: Strict 3000ms query timeout to prevent runaway queries from locking connection pools
                jdbcTemplate.execute("SET LOCAL statement_timeout = '3000ms'");
            } catch (Exception e) {
                log.warn("Could not set PostgreSQL tenant session settings: {}", e.getMessage());
            }
        }
    }
}
