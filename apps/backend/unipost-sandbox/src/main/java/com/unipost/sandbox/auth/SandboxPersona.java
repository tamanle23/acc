package com.unipost.sandbox.auth;

import java.io.Serializable;
import java.util.List;

/**
 * Definition of a pre-configured sandbox persona representing typical Unipost roles.
 */
public record SandboxPersona(
        String id,
        String name,
        String username,
        String defaultTenantId,
        String actorTenantId,
        List<String> roles,
        List<String> authorities,
        String uid
) implements Serializable {}
