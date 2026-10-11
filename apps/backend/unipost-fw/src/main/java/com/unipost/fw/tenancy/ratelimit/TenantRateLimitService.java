package com.unipost.fw.tenancy.ratelimit;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Distributed Token-Bucket rate limiting service per tenant.
 * Uses Redis with an atomic sliding window / token bucket when available,
 * with an automatic thread-safe in-memory fallback for standalone/local dev.
 */
@Slf4j
@Service
public class TenantRateLimitService {

    private final StringRedisTemplate redisTemplate;

    // In-memory token bucket fallback cache: key -> BucketState
    private final Map<String, InMemoryBucket> localBuckets = new ConcurrentHashMap<>();

    public TenantRateLimitService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public record RateLimitResult(
            boolean allowed,
            long tokensRemaining,
            long retryAfterSeconds,
            long capacity
    ) {}

    public static int getCapacityForTier(String planTier) {
        if (planTier == null) return 120;
        return switch (planTier.toUpperCase()) {
            case "ENTERPRISE" -> 5000;
            case "PRO" -> 1000;
            default -> 120; // Basic / Solo: 120 requests per minute
        };
    }

    /**
     * Consumes 1 token for the specified tenant under their plan tier quota.
     * Window: 1 minute (60,000 ms).
     */
    public RateLimitResult consumeToken(String tenantId, String planTier) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant ID is required for rate limit accounting.");
        }
        String tid = tenantId.trim().toLowerCase();
        int capacity = getCapacityForTier(planTier);

        try {
            if (redisTemplate != null && redisTemplate.getConnectionFactory() != null) {
                return consumeRedis(tid, capacity);
            }
        } catch (Exception e) {
            log.warn("Redis rate-limiting failed for tenant '{}', failing over to in-memory: {}", tid, e.getMessage());
        }

        return consumeLocal(tid, capacity);
    }

    private RateLimitResult consumeRedis(String tenantId, int capacity) {
        String key = "rate_limit:" + tenantId;
        long now = System.currentTimeMillis();
        long windowStart = now - 60000L;

        // Slide window in Redis sorted set or string counter with TTL
        try {
            Long current = redisTemplate.opsForValue().increment(key);
            if (current != null && current == 1L) {
                redisTemplate.expire(key, java.time.Duration.ofMinutes(1));
            }

            if (current != null && current <= capacity) {
                return new RateLimitResult(true, capacity - current, 0, capacity);
            } else {
                Long expireSec = redisTemplate.getExpire(key);
                long retryAfter = (expireSec != null && expireSec > 0) ? expireSec : 60L;
                return new RateLimitResult(false, 0, retryAfter, capacity);
            }
        } catch (Exception e) {
            log.debug("Redis operation failed, falling back to local bucket for {}", tenantId);
            return consumeLocal(tenantId, capacity);
        }
    }

    private RateLimitResult consumeLocal(String tenantId, int capacity) {
        InMemoryBucket bucket = localBuckets.computeIfAbsent(tenantId, k -> new InMemoryBucket(capacity));
        return bucket.tryConsume(capacity);
    }

    public void reset(String tenantId) {
        if (tenantId != null) {
            localBuckets.remove(tenantId.trim().toLowerCase());
            if (redisTemplate != null) {
                try {
                    redisTemplate.delete("rate_limit:" + tenantId.trim().toLowerCase());
                } catch (Exception ignored) {}
            }
        }
    }

    private static class InMemoryBucket {
        private final AtomicInteger tokens;
        private final AtomicLong windowStart;

        InMemoryBucket(int capacity) {
            this.tokens = new AtomicInteger(capacity);
            this.windowStart = new AtomicLong(System.currentTimeMillis());
        }

        synchronized RateLimitResult tryConsume(int capacity) {
            long now = System.currentTimeMillis();
            long start = windowStart.get();
            long elapsed = now - start;

            // Reset bucket window if 60 seconds elapsed
            if (elapsed >= 60000L) {
                tokens.set(capacity);
                windowStart.set(now);
                elapsed = 0;
            }

            int current = tokens.get();
            if (current > 0) {
                int remaining = tokens.decrementAndGet();
                return new RateLimitResult(true, remaining, 0, capacity);
            } else {
                long retryAfterSeconds = Math.max(1, (60000L - elapsed) / 1000L);
                return new RateLimitResult(false, 0, retryAfterSeconds, capacity);
            }
        }
    }
}
