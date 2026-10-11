package com.unipost.fw.security;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

/**
 * Authentication token representing an authorized public reader using a Publishable Key.
 */
public class PublishableKeyAuthenticationToken extends AbstractAuthenticationToken {

    private static final long serialVersionUID = 1L;

    private final String publishableKey;
    private final String tenantId;

    public PublishableKeyAuthenticationToken(
            String publishableKey,
            String tenantId,
            Collection<? extends GrantedAuthority> authorities
    ) {
        super(authorities);
        this.publishableKey = publishableKey;
        this.tenantId = tenantId;
        super.setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return publishableKey;
    }

    @Override
    public Object getPrincipal() {
        return "public_reader_" + tenantId;
    }

    public String getTenantId() {
        return tenantId;
    }
}
