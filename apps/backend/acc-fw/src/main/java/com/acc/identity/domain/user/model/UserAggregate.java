package com.acc.identity.domain.user.model;

import com.acc.core.domain.AggregateRoot;
import com.acc.core.domain.exception.DomainValidationException;
import com.acc.identity.domain.user.event.UserRegisteredEvent;
import com.acc.identity.domain.user.valobj.UserId;
import com.acc.identity.domain.user.valobj.UserStatus;

import java.util.*;

/**
 * Pure Domain Aggregate Root for Users.
 * ZERO framework, JPA, Hibernate, or Jackson imports.
 */
public final class UserAggregate extends AggregateRoot<UserId> {

    private final String tenantId;
    private final String username;
    private final String email;
    private String passwordHash;
    private UserStatus status;
    private final Set<String> roles = new HashSet<>();
    private final long createdAtEpochMs;
    private long updatedAtEpochMs;

    public UserAggregate(
        UserId id, String tenantId, String username, String email,
        String passwordHash, UserStatus status, Set<String> roles,
        long createdAtEpochMs, long updatedAtEpochMs
    ) {
        if (username == null || username.isBlank()) {
            throw new DomainValidationException("Username cannot be empty");
        }
        if (email == null || !email.contains("@")) {
            throw new DomainValidationException("Valid email is required");
        }
        this.setId(Objects.requireNonNull(id, "UserId cannot be null"));
        this.tenantId = Objects.requireNonNull(tenantId, "TenantId cannot be null");
        this.username = username.trim();
        this.email = email.trim().toLowerCase();
        this.passwordHash = Objects.requireNonNull(passwordHash, "PasswordHash cannot be null");
        this.status = Objects.requireNonNull(status, "UserStatus cannot be null");
        if (roles != null) {
            this.roles.addAll(roles);
        }
        this.createdAtEpochMs = createdAtEpochMs;
        this.updatedAtEpochMs = updatedAtEpochMs;
    }

    public static UserAggregate registerNewUser(
        String tenantId, String username, String email, String passwordHash, long nowEpochMs
    ) {
        UserId id = UserId.random();
        UserAggregate user = new UserAggregate(
            id, tenantId, username, email, passwordHash,
            UserStatus.PENDING_ACTIVATION, Set.of("USER"), nowEpochMs, nowEpochMs
        );
        user.registerEvent(new UserRegisteredEvent(id, tenantId, email, nowEpochMs));
        return user;
    }

    public void activate(long nowEpochMs) {
        if (this.status == UserStatus.DISABLED) {
            throw new DomainValidationException("Cannot activate a permanently disabled user");
        }
        this.status = UserStatus.ACTIVE;
        this.updatedAtEpochMs = nowEpochMs;
    }

    public void disable(long nowEpochMs) {
        this.status = UserStatus.DISABLED;
        this.updatedAtEpochMs = nowEpochMs;
    }

    public void lock(long nowEpochMs) {
        this.status = UserStatus.LOCKED;
        this.updatedAtEpochMs = nowEpochMs;
    }

    public void addRole(String role, long nowEpochMs) {
        if (role != null && !role.isBlank()) {
            this.roles.add(role.trim().toUpperCase());
            this.updatedAtEpochMs = nowEpochMs;
        }
    }

    public void removeRole(String role, long nowEpochMs) {
        if (role != null) {
            this.roles.remove(role.trim().toUpperCase());
            this.updatedAtEpochMs = nowEpochMs;
        }
    }

    public String tenantId() { return tenantId; }
    public String username() { return username; }
    public String email() { return email; }
    public String passwordHash() { return passwordHash; }
    public UserStatus status() { return status; }
    public Set<String> roles() { return Collections.unmodifiableSet(roles); }
    public long createdAtEpochMs() { return createdAtEpochMs; }
    public long updatedAtEpochMs() { return updatedAtEpochMs; }
}
