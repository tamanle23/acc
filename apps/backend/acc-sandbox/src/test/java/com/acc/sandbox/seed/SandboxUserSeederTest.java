package com.acc.sandbox.seed;

import com.acc.identity.infra.user.repository.jpa.PermissionRepository;
import com.acc.identity.infra.user.repository.jpa.RoleRepository;
import com.acc.identity.infra.user.repository.jpa.UserPermissionRepository;
import com.acc.identity.infra.user.repository.jpa.UserRepository;
import com.acc.identity.infra.user.repository.jpa.UserRoleRepository;
import com.acc.sandbox.auth.SandboxPersonaRegistry;
import com.acc.user.model.Permission;
import com.acc.user.model.Role;
import com.acc.user.model.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SandboxUserSeederTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private PermissionRepository permissionRepository;

    @Mock
    private UserRoleRepository userRoleRepository;

    @Mock
    private UserPermissionRepository userPermissionRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    @DisplayName("Should seed all sandbox personas into JPA repositories when missing")
    void testSeedUsersIfMissing() {
        SandboxPersonaRegistry registry = new SandboxPersonaRegistry();

        when(userRepository.findByUserName(anyString())).thenReturn(null);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(roleRepository.findOneByCodeIgnoreCase(anyString())).thenReturn(null);
        when(roleRepository.save(any(Role.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(permissionRepository.findOneByCodeIgnoreCase(anyString())).thenReturn(null);
        when(permissionRepository.save(any(Permission.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(passwordEncoder.encode("password")).thenReturn("encoded_pass");

        @SuppressWarnings("unchecked")
        ObjectProvider<UserRepository> userProvider = mock(ObjectProvider.class);
        when(userProvider.getIfAvailable()).thenReturn(userRepository);

        @SuppressWarnings("unchecked")
        ObjectProvider<RoleRepository> roleProvider = mock(ObjectProvider.class);
        when(roleProvider.getIfAvailable()).thenReturn(roleRepository);

        @SuppressWarnings("unchecked")
        ObjectProvider<PermissionRepository> permProvider = mock(ObjectProvider.class);
        when(permProvider.getIfAvailable()).thenReturn(permissionRepository);

        @SuppressWarnings("unchecked")
        ObjectProvider<UserRoleRepository> userRoleProvider = mock(ObjectProvider.class);
        when(userRoleProvider.getIfAvailable()).thenReturn(userRoleRepository);

        @SuppressWarnings("unchecked")
        ObjectProvider<UserPermissionRepository> userPermProvider = mock(ObjectProvider.class);
        when(userPermProvider.getIfAvailable()).thenReturn(userPermissionRepository);

        @SuppressWarnings("unchecked")
        ObjectProvider<PasswordEncoder> encoderProvider = mock(ObjectProvider.class);
        when(encoderProvider.getIfAvailable()).thenReturn(passwordEncoder);

        SandboxUserSeeder seeder = new SandboxUserSeeder(
                registry,
                userProvider,
                roleProvider,
                permProvider,
                userRoleProvider,
                userPermProvider,
                encoderProvider
        );

        seeder.seedUsersIfMissing();

        // 4 distinct sandbox personas registered in SandboxPersonaRegistry
        verify(userRepository, times(4)).save(any(User.class));
        verify(userRoleRepository, atLeastOnce()).save(any());
        verify(userPermissionRepository, atLeastOnce()).save(any());
    }
}
