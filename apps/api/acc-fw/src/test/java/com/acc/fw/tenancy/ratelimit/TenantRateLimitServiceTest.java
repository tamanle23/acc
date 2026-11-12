package com.acc.fw.tenancy.ratelimit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TenantRateLimitServiceTest {

    private TenantRateLimitService rateLimitService;

    @BeforeEach
    void setUp() {
        // Without RedisTemplate configured, fallback in-memory rate limiter is utilized
        rateLimitService = new TenantRateLimitService(null);
    }

    @Test
    @DisplayName("Default BASIC tier allows up to 120 requests per minute and rejects on exhaustion")
    void testBasicTierRateLimiting() {
        String tenantId = "test-basic-tenant";

        // First 120 requests must be allowed
        for (int i = 0; i < 120; i++) {
            TenantRateLimitService.RateLimitResult result = rateLimitService.consumeToken(tenantId, "BASIC");
            assertTrue(result.allowed(), "Request #" + (i + 1) + " should be allowed");
            assertEquals(120, result.capacity());
            assertEquals(120 - (i + 1), result.tokensRemaining());
        }

        // 121st request must be rejected
        TenantRateLimitService.RateLimitResult rejected = rateLimitService.consumeToken(tenantId, "BASIC");
        assertFalse(rejected.allowed(), "121st request must be rejected under BASIC tier");
        assertEquals(0, rejected.tokensRemaining());
        assertTrue(rejected.retryAfterSeconds() > 0, "retryAfterSeconds should be positive");
    }

    @Test
    @DisplayName("Tier tiers (PRO / ENTERPRISE) grant higher capacities")
    void testTierOverrides() {
        TenantRateLimitService.RateLimitResult proResult = rateLimitService.consumeToken("pro-tenant", "PRO");
        assertTrue(proResult.allowed());
        assertEquals(1000, proResult.capacity());
        assertEquals(999, proResult.tokensRemaining());

        TenantRateLimitService.RateLimitResult entResult = rateLimitService.consumeToken("enterprise-tenant", "ENTERPRISE");
        assertTrue(entResult.allowed());
        assertEquals(5000, entResult.capacity());
        assertEquals(4999, entResult.tokensRemaining());
    }

    @Test
    @DisplayName("Reset clears tenant local bucket state")
    void testResetBucket() {
        String tenant = "reset-tenant";
        for (int i = 0; i < 120; i++) {
            rateLimitService.consumeToken(tenant, "BASIC");
        }
        assertFalse(rateLimitService.consumeToken(tenant, "BASIC").allowed());

        rateLimitService.reset(tenant);
        assertTrue(rateLimitService.consumeToken(tenant, "BASIC").allowed());
    }
}
