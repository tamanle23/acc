package com.unipost.user.model;

import java.util.Calendar;
import java.util.Date;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;

import lombok.Builder;
import lombok.Data;

@Entity
@Data
public class PasswordResetToken {

  private static final int EXPIRATION = 60 * 24;

  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  private Long id;

  private String token;

  @OneToOne(targetEntity = User.class, fetch = FetchType.EAGER)
  @JoinColumn(nullable = false, name = "user_id")
  private User user;

  private Date expiryDate;

  @Builder
  public PasswordResetToken(final String token, final User user) {
    this.token = token;
    this.user = user;
    this.expiryDate = calculateExpiryDate(EXPIRATION);
  }

  private Date calculateExpiryDate(final int expiryTimeInMinutes) {
      final Calendar cal = Calendar.getInstance();
      cal.setTimeInMillis(new Date().getTime());
      cal.add(Calendar.MINUTE, expiryTimeInMinutes);
      return new Date(cal.getTime().getTime());
  }

  public void updateToken(final String token) {
      this.token = token;
      this.expiryDate = calculateExpiryDate(EXPIRATION);
  }
}
