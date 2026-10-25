package com.acc.sandbox.auth;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry of well-known sandbox personas mapping credentials to authoritative claims.
 */
@Component
public class SandboxPersonaRegistry {

    private final Map<String, SandboxPersona> personasById = new LinkedHashMap<>();
    private final Map<String, SandboxPersona> personasByAlias = new ConcurrentHashMap<>();

    public SandboxPersonaRegistry() {
        // 1. Workspace Owner (Admin) Persona
        SandboxPersona admin = new SandboxPersona(
                "admin",
                "Workspace Owner",
                "admin@acc.io",
                "tenant-acme",
                null,
                List.of("ROLE_WORKSPACE_OWNER", "ROLE_STANDARD_MEMBER", "ROLE_ADMIN"),
                List.of("ROLE_WORKSPACE_OWNER", "ROLE_STANDARD_MEMBER", "ROLE_ADMIN", "metadata:schema:read", "metadata:schema:write", 
                        "metadata:record:read", "metadata:record:write", "metadata:record:delete", "workspace:settings:manage", "workspace:members:manage"),
                "usr_sandbox_admin_001"
        );
        registerPersona(admin, List.of("admin@acc.io", "admin_bypass", "admin", "tenant-admin"));

        // 2. Sovereign Root Custodian Persona
        SandboxPersona custodian = new SandboxPersona(
                "system",
                "Sovereign Root Custodian (Me)",
                "custodian@system",
                "SYSTEM",
                "SYSTEM",
                List.of("ROLE_SYSTEM_ROOT", "ROLE_SYSTEM_SUPPORT", "ROLE_WORKSPACE_OWNER", "ROLE_STANDARD_MEMBER"),
                List.of("ROLE_SYSTEM_ROOT", "ROLE_SYSTEM_SUPPORT", "platform:fleet:read", "platform:fleet:mutate", "platform:tenant:assume", 
                        "platform:quotas:override", "platform:roles:manage", "platform:users:lock", "platform:dlq:manage", "platform:audit:export", 
                        "metadata:schema:read", "metadata:schema:write", "metadata:record:read", "metadata:record:write"),
                "usr_sandbox_custodian_001"
        );
        registerPersona(custodian, List.of("custodian@system", "custodian_root", "system", "sovereign-custodian@acc.io", "system-custodian"));

        // 3. Operations Manager (Creator) Persona
        SandboxPersona creator = new SandboxPersona(
                "creator",
                "Operations Manager",
                "creator@acc.io",
                "tenant-acme",
                null,
                List.of("ROLE_OPERATIONS_MANAGER", "ROLE_STANDARD_MEMBER"),
                List.of("ROLE_OPERATIONS_MANAGER", "ROLE_STANDARD_MEMBER", "metadata:schema:read", "metadata:schema:write", 
                        "metadata:record:read", "metadata:record:write", "metadata:record:delete", "workspace:integrations:manage", "workspace:export:data"),
                "usr_sandbox_creator_001"
        );
        registerPersona(creator, List.of("creator@acc.io", "creator_bypass", "creator", "tenant-creator"));

        // 4. Standard Member (User) Persona
        SandboxPersona user = new SandboxPersona(
                "user",
                "Standard Member",
                "user@acc.io",
                "tenant-acme",
                null,
                List.of("ROLE_STANDARD_MEMBER"),
                List.of("ROLE_STANDARD_MEMBER", "metadata:schema:read", "metadata:record:read", "metadata:record:write"),
                "usr_sandbox_user_001"
        );
        registerPersona(user, List.of("user@acc.io", "user_bypass", "user", "tenant-user"));
    }

    public void registerPersona(SandboxPersona persona, List<String> aliases) {
        personasById.put(persona.id(), persona);
        personasByAlias.put(persona.username().toLowerCase(), persona);
        if (aliases != null) {
            for (String alias : aliases) {
                personasByAlias.put(alias.toLowerCase().trim(), persona);
            }
        }
    }

    public Optional<SandboxPersona> findByUsername(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(personasByAlias.get(username.trim().toLowerCase()));
    }

    public Optional<SandboxPersona> resolve(String username, String password) {
        if (username != null && !username.isBlank()) {
            Optional<SandboxPersona> found = findByUsername(username);
            if (found.isPresent()) {
                return found;
            }
        }
        // Universal bypass fallback if password is "bypass"
        if ("bypass".equalsIgnoreCase(password)) {
            return Optional.ofNullable(personasById.get("admin"));
        }
        return Optional.empty();
    }

    public boolean isSandboxPersona(String username) {
        return findByUsername(username).isPresent();
    }

    public Collection<SandboxPersona> getAllPersonas() {
        return Collections.unmodifiableCollection(personasById.values());
    }
}
