package com.acc.service.authentication;

import com.acc.service.exception.ValidationTimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class UserDetailsImplTest {

    @Test
    void testUserDetailsImpl_DefaultAndParameterizedConstructor() {
        UserDetailsImpl empty = new UserDetailsImpl();
        assertNull(empty.getUsername());
        assertNull(empty.getPassword());
        assertNull(empty.getAuthorities());

        empty.setAdditionalProperty("customKey", "customValue");
        assertEquals("customValue", empty.getUserDetails("k", "v").get("customKey"));

        SimpleGrantedAuthority auth = new SimpleGrantedAuthority("ROLE_USER");
        empty.setAuthorities(List.of(auth));
        assertEquals(1, empty.getAuthorities().size());

        Date now = new Date();
        empty.setLastPasswordResetDate(now);
        assertEquals(now, empty.getLastPasswordResetDate());
    }

    @Test
    void testUserDetailsImpl_AllGettersAndBooleans() {
        SimpleGrantedAuthority auth = new SimpleGrantedAuthority("ROLE_ADMIN");
        Map<String, Object> details = Map.of(
                "userName", "adminUser",
                "password", "secret123",
                "uid", "uid-admin-1",
                "userType", "INTERNAL",
                "isNonExpired", true,
                "isNonLocked", true,
                "isCredentialsNonExpired", true,
                "isEnabled", true
        );

        UserDetailsImpl user = new UserDetailsImpl(details, List.of(auth));

        assertEquals("adminUser", user.getUsername());
        assertEquals("adminUser", user.getUserName());
        assertEquals("secret123", user.getPassword());
        assertEquals("uid-admin-1", user.getUid());
        assertEquals("INTERNAL", user.getUserType());
        assertTrue(user.isAccountNonExpired());
        assertTrue(user.isAccountNonLocked());
        assertTrue(user.isCredentialsNonExpired());
        assertTrue(user.isEnabled());
        assertEquals(1, user.getAuthorities().size());
    }

    @Test
    void testValidationTimeoutException() {
        ValidationTimeoutException ex1 = new ValidationTimeoutException("timeout occurred");
        assertEquals("timeout occurred", ex1.getMessage());

        RuntimeException cause = new RuntimeException("root cause");
        ValidationTimeoutException ex2 = new ValidationTimeoutException("timed out with cause", cause);
        assertEquals("timed out with cause", ex2.getMessage());
        assertEquals(cause, ex2.getCause());
    }
}
