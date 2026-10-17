package com.unipost.sandbox.auth;

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
        // 1. Admin Persona
        SandboxPersona admin = new SandboxPersona(
                "admin",
                "Administrator",
                "admin@unipost.io",
                "tenant-acme",
                null,
                List.of("ROLE_ADMIN", "ROLE_USER"),
                List.of("ROLE_ADMIN", "ROLE_USER", "METADATA_SCHEMA_READ", "METADATA_SCHEMA_WRITE", 
                        "METADATA_RECORD_READ", "METADATA_RECORD_WRITE", "USER_MANAGEMENT", "WORKSPACE_MANAGEMENT"),
                "usr_sandbox_admin_001"
        );
        registerPersona(admin, List.of("admin@unipost.io", "admin_bypass", "admin", "tenant-admin"));

        // 2. Sovereign Custodian Persona
        SandboxPersona custodian = new SandboxPersona(
                "system",
                "Sovereign Custodian (Me)",
                "custodian@system",
                "SYSTEM",
                "SYSTEM",
                List.of("ROLE_SYSTEM_CUSTODIAN", "ROLE_ADMIN", "ROLE_USER"),
                List.of("ROLE_SYSTEM_CUSTODIAN", "ROLE_ADMIN", "ROLE_USER", "platform:dlq:manage", 
                        "METADATA_SCHEMA_READ", "METADATA_SCHEMA_WRITE", "METADATA_RECORD_READ", "METADATA_RECORD_WRITE"),
                "usr_sandbox_custodian_001"
        );
        registerPersona(custodian, List.of("custodian@system", "custodian_root", "system", "sovereign-custodian@unipost.io", "system-custodian"));

        // 3. Creator Persona
        SandboxPersona creator = new SandboxPersona(
                "creator",
                "Content Creator",
                "creator@unipost.io",
                "tenant-acme",
                null,
                List.of("ROLE_CREATOR", "ROLE_USER"),
                List.of("ROLE_CREATOR", "ROLE_USER", "METADATA_SCHEMA_READ", "METADATA_RECORD_READ", "METADATA_RECORD_WRITE"),
                "usr_sandbox_creator_001"
        );
        registerPersona(creator, List.of("creator@unipost.io", "creator_bypass", "creator", "tenant-creator"));

        // 4. Standard User Persona
        SandboxPersona user = new SandboxPersona(
                "user",
                "Standard User",
                "user@unipost.io",
                "tenant-acme",
                null,
                List.of("ROLE_USER"),
                List.of("ROLE_USER", "METADATA_RECORD_READ"),
                "usr_sandbox_user_001"
        );
        registerPersona(user, List.of("user@unipost.io", "user_bypass", "user", "tenant-user"));
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
