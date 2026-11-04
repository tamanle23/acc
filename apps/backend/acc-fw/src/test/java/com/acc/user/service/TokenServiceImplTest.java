package com.acc.user.service;

import com.acc.core.constant.CanonicalRoles;
import com.acc.fw.core.jwt.JwtAuthenticationToken;
import com.acc.fw.core.jwt.JwtTokenHelper;
import com.acc.system.dto.AuthenticationProfileDto;
import io.jsonwebtoken.impl.DefaultClaims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TokenServiceImplTest {

    @Mock
    private UserDetailsService userDetailsService;

    private TokenServiceImpl tokenService;

    @BeforeEach
    void setUp() {
        tokenService = new TokenServiceImpl();
        ReflectionTestUtils.setField(tokenService, "userDetailsService", userDetailsService);
    }

    @Test
    void testGetAuthenticationProfileFallsBackToTokenClaimsWhenUserNotInDatabase() {
        String username = "admin@acc.io";
        when(userDetailsService.loadUserByUsername(username))
                .thenThrow(new UsernameNotFoundException("User not found in DB"));

        Map<String, Object> userDetailsMap = new HashMap<>();
        userDetailsMap.put("uid", "usr_sandbox_admin_001");
        userDetailsMap.put("userName", username);

        DefaultClaims claims = new DefaultClaims();
        claims.setSubject(username);
        claims.put(JwtTokenHelper.CLAIM_KEY_USER_DETAILS, userDetailsMap);
        claims.put(JwtTokenHelper.CLAIM_KEY_TENANT_ID, "tenant-acme");

        List<GrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_WORKSPACE_OWNER"),
                new SimpleGrantedAuthority("ROLE_ADMIN"),
                new SimpleGrantedAuthority("metadata:schema:read"),
                new SimpleGrantedAuthority("metadata:record:read")
        );

        JwtAuthenticationToken token = new JwtAuthenticationToken(username, claims, authorities, "tenant-acme");

        AuthenticationProfileDto profile = tokenService.getAuthenticationProfile(token);

        assertThat(profile).isNotNull();
        assertThat(profile.getUsername()).isEqualTo(username);
        assertThat(profile.getUserId()).isEqualTo("usr_sandbox_admin_001");
        assertThat(profile.getTenantId()).isEqualTo("tenant-acme");
        assertThat(profile.getRoles()).containsExactlyInAnyOrder("ROLE_WORKSPACE_OWNER", "ROLE_ADMIN");
        assertThat(profile.getPermissions()).containsExactlyInAnyOrder("metadata:schema:read", "metadata:record:read");
    }

    @Test
    void testGetAuthenticationProfileSovereignDetection() {
        String username = "custodian_root";
        when(userDetailsService.loadUserByUsername(username))
                .thenThrow(new UsernameNotFoundException("User not found in DB"));

        DefaultClaims claims = new DefaultClaims();
        claims.setSubject(username);
        claims.put(JwtTokenHelper.CLAIM_KEY_TENANT_ID, "SYSTEM");

        List<GrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority(CanonicalRoles.ROLE_SYSTEM_ROOT)
        );

        JwtAuthenticationToken token = new JwtAuthenticationToken(username, claims, authorities, "SYSTEM");

        AuthenticationProfileDto profile = tokenService.getAuthenticationProfile(token);

        assertThat(profile).isNotNull();
        assertThat(profile.isSovereign()).isTrue();
        assertThat(profile.getTenantId()).isEqualTo("SYSTEM");
    }
}
