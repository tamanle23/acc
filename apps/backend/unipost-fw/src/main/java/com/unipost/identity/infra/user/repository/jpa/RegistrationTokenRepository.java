package com.unipost.identity.infra.user.repository.jpa;

import java.util.Date;
import java.util.stream.Stream;

import com.unipost.user.model.RegistrationToken;
import com.unipost.user.model.User;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RegistrationTokenRepository extends JpaRepository<RegistrationToken, Long> {

    RegistrationToken findByToken(String token);

    RegistrationToken findByUser(User user);

    Stream<RegistrationToken> findAllByExpiryDateLessThan(Date now);

    void deleteByExpiryDateLessThan(Date now);

    @Modifying
    @Query("delete from #{#entityName} t where t.expiryDate <= ?1")
    void deleteAllExpiredSince(Date now);
}
