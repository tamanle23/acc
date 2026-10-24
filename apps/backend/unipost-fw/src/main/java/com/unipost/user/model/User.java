package com.unipost.user.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Inheritance;
import jakarta.persistence.InheritanceType;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.unipost.domain.BaseModel;
import com.unipost.user.Constants;
import org.hibernate.annotations.DynamicInsert;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.unipost.user.model.enums.UserStatus;
import com.unipost.user.model.enums.UserType;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = Constants.TABLE_PREFIX + "user")
@Inheritance(strategy=InheritanceType.JOINED)
@DynamicInsert
@DynamicUpdate
@JsonIgnoreProperties(value= {"createdBy","lastUpdatedBy"})
public class User extends BaseModel {

  private static final long serialVersionUID = 6748926471774632595L;

  private String userName;

  private String email;

  private String phoneNumber;

  // 0: username 1: email 2: phone
  private int idType;

  @JsonIgnore
  private String password;

  @JsonIgnore
  private String defaultPassword;

  private String firstName;

  private String lastName;

  private boolean nonExpired;

  private boolean nonLocked;

  private boolean credentialsNonExpired;

  @Enumerated(EnumType.ORDINAL)
  private UserStatus status;

  @Enumerated(EnumType.STRING)
  private UserType type;

  @Fetch(FetchMode.JOIN)
  @JsonIgnore
  @ManyToOne(fetch=FetchType.LAZY)
  private User approver;
}
