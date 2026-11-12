package com.acc.identity.domain.user;

import com.acc.core.domain.DomainEvent;
import com.acc.core.domain.exception.DomainValidationException;
import com.acc.identity.domain.user.event.UserRegisteredEvent;
import com.acc.identity.domain.user.model.UserAggregate;
import com.acc.identity.domain.user.valobj.UserId;
import com.acc.identity.domain.user.valobj.UserStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class UserAggregateTest {

    @Test
    @DisplayName("registerNewUser initializes user in PENDING_ACTIVATION and registers UserRegisteredEvent")
    void testRegisterNewUser() {
        long now = System.currentTimeMillis();
        UserAggregate user = UserAggregate.registerNewUser(
            "tenant-1", "john_doe", "john@example.com", "hash123", now
        );

        assertNotNull(user.getId());
        assertEquals("tenant-1", user.tenantId());
        assertEquals("john_doe", user.username());
        assertEquals("john@example.com", user.email());
        assertEquals(UserStatus.PENDING_ACTIVATION, user.status());
        assertTrue(user.roles().contains("USER"));

        List<DomainEvent> events = user.pollUncommittedEvents();
        assertEquals(1, events.size());
        assertInstanceOf(UserRegisteredEvent.class, events.get(0));
        UserRegisteredEvent registeredEvent = (UserRegisteredEvent) events.get(0);
        assertEquals(user.getId(), registeredEvent.userId());
        assertEquals("tenant-1", registeredEvent.tenantId());
        assertEquals("john@example.com", registeredEvent.email());

        // Polling clears uncommitted events
        assertTrue(user.pollUncommittedEvents().isEmpty());
    }

    @Test
    @DisplayName("activate updates status to ACTIVE and records updatedAt")
    void testActivate() {
        long now = System.currentTimeMillis();
        UserAggregate user = UserAggregate.registerNewUser(
            "tenant-1", "alice", "alice@example.com", "hash456", now
        );

        user.activate(now + 1000);
        assertEquals(UserStatus.ACTIVE, user.status());
        assertEquals(now + 1000, user.updatedAtEpochMs());
    }

    @Test
    @DisplayName("activate on DISABLED user throws DomainValidationException")
    void testCannotActivateDisabledUser() {
        long now = System.currentTimeMillis();
        UserAggregate user = new UserAggregate(
            UserId.random(), "tenant-1", "bob", "bob@example.com", "hash",
            UserStatus.DISABLED, Set.of("USER"), now, now
        );

        assertThrows(DomainValidationException.class, () -> user.activate(now + 500));
    }

    @Test
    @DisplayName("invalid email or blank username throws DomainValidationException")
    void testInvalidUserCreation() {
        long now = System.currentTimeMillis();
        assertThrows(DomainValidationException.class, () ->
            UserAggregate.registerNewUser("tenant-1", "", "valid@example.com", "hash", now)
        );
        assertThrows(DomainValidationException.class, () ->
            UserAggregate.registerNewUser("tenant-1", "valid_user", "invalid-email", "hash", now)
        );
    }
}
