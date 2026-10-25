package com.unipost.sandbox.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class SandboxPersonaRegistryTest {

    private SandboxPersonaRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new SandboxPersonaRegistry();
    }

    @Test
    @DisplayName("Should resolve admin persona by standard email and aliases")
    void testResolveAdminPersona() {
        Optional<SandboxPersona> byEmail = registry.resolve("admin@unipost.io", "any");
        assertTrue(byEmail.isPresent());
        assertEquals("admin", byEmail.get().id());
        assertEquals("tenant-acme", byEmail.get().defaultTenantId());
        assertTrue(byEmail.get().roles().contains("ROLE_WORKSPACE_OWNER"));

        Optional<SandboxPersona> byAlias = registry.resolve("admin_bypass", null);
        assertTrue(byAlias.isPresent());
        assertEquals("admin", byAlias.get().id());

        Optional<SandboxPersona> byShortName = registry.resolve("admin", null);
        assertTrue(byShortName.isPresent());
        assertEquals("admin", byShortName.get().id());
    }

    @Test
    @DisplayName("Should resolve sovereign custodian persona with SYSTEM tenant and actor_tid")
    void testResolveSovereignCustodianPersona() {
        Optional<SandboxPersona> custodian = registry.resolve("custodian@system", "any");
        assertTrue(custodian.isPresent());
        assertEquals("system", custodian.get().id());
        assertEquals("SYSTEM", custodian.get().defaultTenantId());
        assertEquals("SYSTEM", custodian.get().actorTenantId());
        assertTrue(custodian.get().roles().contains("ROLE_SYSTEM_ROOT"));

        Optional<SandboxPersona> byAlias = registry.resolve("custodian_root", null);
        assertTrue(byAlias.isPresent());
        assertEquals("system", byAlias.get().id());
    }

    @Test
    @DisplayName("Should resolve creator and user personas")
    void testResolveCreatorAndUserPersonas() {
        Optional<SandboxPersona> creator = registry.resolve("creator@unipost.io", null);
        assertTrue(creator.isPresent());
        assertEquals("creator", creator.get().id());
        assertTrue(creator.get().roles().contains("ROLE_OPERATIONS_MANAGER"));

        Optional<SandboxPersona> user = registry.resolve("user@unipost.io", null);
        assertTrue(user.isPresent());
        assertEquals("user", user.get().id());
        assertTrue(user.get().roles().contains("ROLE_STANDARD_MEMBER"));
    }

    @Test
    @DisplayName("Should fallback to admin when password is 'bypass' and username unknown")
    void testBypassPasswordFallback() {
        Optional<SandboxPersona> fallback = registry.resolve("unknown@company.org", "bypass");
        assertTrue(fallback.isPresent());
        assertEquals("admin", fallback.get().id());
    }

    @Test
    @DisplayName("Should return empty for unknown user with standard password")
    void testUnknownUser() {
        Optional<SandboxPersona> unknown = registry.resolve("unknown@company.org", "regularpassword");
        assertTrue(unknown.isEmpty());
        assertFalse(registry.isSandboxPersona("unknown@company.org"));
    }
}
