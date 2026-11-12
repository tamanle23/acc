package com.acc.sandbox.seed;

import com.acc.identity.infra.user.repository.jpa.PermissionRepository;
import com.acc.identity.infra.user.repository.jpa.RoleRepository;
import com.acc.identity.infra.user.repository.jpa.UserPermissionRepository;
import com.acc.identity.infra.user.repository.jpa.UserRepository;
import com.acc.identity.infra.user.repository.jpa.UserRoleRepository;
import com.acc.sandbox.auth.SandboxPersona;
import com.acc.sandbox.auth.SandboxPersonaRegistry;
import com.acc.user.model.Permission;
import com.acc.user.model.Role;
import com.acc.user.model.User;
import com.acc.user.model.UserPermission;
import com.acc.user.model.UserRole;
import com.acc.user.model.enums.PermissionLevel;
import com.acc.user.model.enums.PermissionType;
import com.acc.user.model.enums.UserStatus;
import com.acc.user.model.enums.UserType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Seeds sandbox personas into the sandbox PostgreSQL database upon startup.
 * Ensures User, Role, UserRole, Permission, and UserPermission records exist
 * so that standard JPA repositories, UserDetailsService, and audit trails function identically
 * in sandbox mode as in live production.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class SandboxUserSeeder {

    private final SandboxPersonaRegistry personaRegistry;
    private final ObjectProvider<UserRepository> userRepositoryProvider;
    private final ObjectProvider<RoleRepository> roleRepositoryProvider;
    private final ObjectProvider<PermissionRepository> permissionRepositoryProvider;
    private final ObjectProvider<UserRoleRepository> userRoleRepositoryProvider;
    private final ObjectProvider<UserPermissionRepository> userPermissionRepositoryProvider;
    private final ObjectProvider<PasswordEncoder> passwordEncoderProvider;

    @Transactional
    public void seedUsersIfMissing() {
        UserRepository userRepo = userRepositoryProvider.getIfAvailable();
        RoleRepository roleRepo = roleRepositoryProvider.getIfAvailable();
        PermissionRepository permRepo = permissionRepositoryProvider.getIfAvailable();
        UserRoleRepository userRoleRepo = userRoleRepositoryProvider.getIfAvailable();
        UserPermissionRepository userPermRepo = userPermissionRepositoryProvider.getIfAvailable();
        PasswordEncoder encoder = passwordEncoderProvider.getIfAvailable();

        if (userRepo == null || roleRepo == null || permRepo == null || userRoleRepo == null || userPermRepo == null) {
            log.warn("[SANDBOX-SEED] JPA User repositories not available; skipping database user seeding.");
            return;
        }

        String encodedPassword = encoder != null ? encoder.encode("password") : "{noop}password";

        for (SandboxPersona persona : personaRegistry.getAllPersonas()) {
            seedPersona(persona, userRepo, roleRepo, permRepo, userRoleRepo, userPermRepo, encodedPassword);
        }
    }

    private void seedPersona(
            SandboxPersona persona,
            UserRepository userRepo,
            RoleRepository roleRepo,
            PermissionRepository permRepo,
            UserRoleRepository userRoleRepo,
            UserPermissionRepository userPermRepo,
            String encodedPassword
    ) {
        String username = persona.username();
        User user = userRepo.findByUserName(username);
        if (user == null) {
            user = new User();
            user.setUid(persona.uid());
            user.setUserName(username);
            String email = username.contains("@") ? username : username + "@acc.io";
            user.setEmail(email);
            user.setPassword(encodedPassword);
            user.setDefaultPassword(encodedPassword);

            String[] nameParts = persona.name().split("\\s+", 2);
            user.setFirstName(nameParts[0]);
            user.setLastName(nameParts.length > 1 ? nameParts[1] : "");

            user.setNonExpired(true);
            user.setNonLocked(true);
            user.setCredentialsNonExpired(true);
            user.setStatus(UserStatus.ENABLED);
            user.setType(persona.roles().contains("ROLE_ADMIN") || persona.roles().contains("ROLE_SYSTEM_ROOT")
                    ? UserType.ADMIN
                    : UserType.REGISTERED);
            user.setPhoneNumber("1234567890");

            user = userRepo.save(user);
            log.info("[SANDBOX-SEED] Seeded sandbox User in Postgres: '{}' ({})", username, persona.uid());
        }

        // Seed Roles & UserRole links
        for (String roleName : persona.roles()) {
            String code = roleName.startsWith("ROLE_") ? roleName.substring(5) : roleName;
            Role role = roleRepo.findOneByCodeIgnoreCase(code);
            if (role == null) {
                role = new Role();
                role.setCode(code);
                role.setDescription(code.replace("_", " ") + " Role");
                role.setTenantId(persona.defaultTenantId());
                role.setRoleScope(code.startsWith("SYSTEM") ? "SOVEREIGN" : "TENANT");
                role.setMinPlanTier("COMMUNITY");
                role.setUid(UUID.randomUUID().toString());
                role = roleRepo.save(role);
                log.info("[SANDBOX-SEED] Seeded sandbox Role in Postgres: '{}'", code);
            }

            final Role targetRole = role;
            List<UserRole> existingRoles = userRoleRepo.findAllByUser(user);
            boolean alreadyHasRole = existingRoles != null && existingRoles.stream()
                    .anyMatch(ur -> ur.getRole() != null && targetRole.getCode().equalsIgnoreCase(ur.getRole().getCode()));
            if (!alreadyHasRole) {
                UserRole userRole = new UserRole();
                userRole.setUser(user);
                userRole.setRole(role);
                userRole.setTenantId(persona.defaultTenantId());
                userRole.setUid(UUID.randomUUID().toString());
                userRoleRepo.save(userRole);
            }
        }

        // Seed Permissions & UserPermission links
        for (String auth : persona.authorities()) {
            if (auth.startsWith("ROLE_")) {
                continue;
            }
            Permission perm = permRepo.findOneByCodeIgnoreCase(auth);
            if (perm == null) {
                perm = new Permission();
                perm.setCode(auth);
                perm.setDescription(auth);
                perm.setType(PermissionType.MODULE);
                perm.setLevel(PermissionLevel.SYSTEM);

                String[] parts = auth.split(":", 2);
                perm.setTarget(parts[0]);
                perm.setAction(parts.length > 1 ? parts[1] : "*");
                perm.setUid(UUID.randomUUID().toString());
                perm = permRepo.save(perm);
            }

            final Permission targetPerm = perm;
            List<UserPermission> existingPerms = userPermRepo.findAllByUser(user);
            boolean alreadyHasPerm = existingPerms != null && existingPerms.stream()
                    .anyMatch(up -> up.getPermission() != null && targetPerm.getCode().equalsIgnoreCase(up.getPermission().getCode()));
            if (!alreadyHasPerm) {
                UserPermission userPerm = new UserPermission();
                userPerm.setUser(user);
                userPerm.setPermission(perm);
                userPerm.setTenantId(persona.defaultTenantId());
                userPerm.setIsGranted(true);
                userPerm.setUid(UUID.randomUUID().toString());
                userPermRepo.save(userPerm);
            }
        }
    }
}
