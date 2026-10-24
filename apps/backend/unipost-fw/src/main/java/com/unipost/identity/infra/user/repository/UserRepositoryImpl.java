package com.unipost.identity.infra.user.repository;

import com.unipost.identity.domain.user.repository.UserRepository;
import com.unipost.user.model.User;
import com.unipost.user.model.enums.UserStatus;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository("domainUserRepositoryImpl")
public class UserRepositoryImpl implements UserRepository {

    private final com.unipost.identity.infra.user.repository.jpa.UserRepository jpaRepository;

    public UserRepositoryImpl(com.unipost.identity.infra.user.repository.jpa.UserRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public User save(User user) {
        return jpaRepository.save(user);
    }

    @Override
    public Optional<User> findById(Long id) {
        return jpaRepository.findById(id);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return Optional.empty(); // Still omitted from underlying JPA impl for now
    }

    @Override
    public Optional<User> findByUserName(String userName) {
        return Optional.ofNullable(jpaRepository.findByUserName(userName));
    }

    @Override
    public boolean existsByEmail(String email) {
        return jpaRepository.countByEmail(email) > 0;
    }

    @Override
    public boolean existsByUserName(String userName) {
        return jpaRepository.countByUserNameIgnoreCase(userName) > 0;
    }

    @Override
    public void updateStatus(String userName, UserStatus status) {
        if (status == UserStatus.ENABLED) {
            jpaRepository.enableUser(userName);
        } else if (status == UserStatus.DISABLED) {
            jpaRepository.disableUser(userName);
        }
    }
}
