package com.unipost.identity.domain.user.repository;

import com.unipost.user.model.User;
import com.unipost.user.model.enums.UserStatus;
import java.util.Optional;

public interface UserRepository {
    User save(User user);
    Optional<User> findById(Long id);
    Optional<User> findByEmail(String email);
    Optional<User> findByUserName(String userName);
    boolean existsByEmail(String email);
    boolean existsByUserName(String userName);
    void updateStatus(String userName, UserStatus status);
}
