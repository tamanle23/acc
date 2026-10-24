package com.unipost.user.model;

import java.util.Set;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

import com.unipost.domain.NamedModel;

import com.fasterxml.jackson.annotation.JsonIgnore;

import com.unipost.user.Constants;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = Constants.TABLE_PREFIX + "role")
@Getter
@Setter
@ToString(callSuper=true)
public class Role extends NamedModel {

  private static final long serialVersionUID = 4513934956962115145L;

  @JsonIgnore
  @ManyToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
  @JoinTable(name = Constants.TABLE_PREFIX + "rolePermission",
      joinColumns = {
              @JoinColumn(name = "role_uid",
                    nullable = false,
                    referencedColumnName = "uid")},
      inverseJoinColumns = {
                  @JoinColumn(name = "permission_uid",
                        referencedColumnName = "uid",
                        nullable = false)
                })
  private Set<Permission> permissions;

  @JsonIgnore
  @ManyToMany(fetch = FetchType.LAZY)
  @JoinTable(name = Constants.TABLE_PREFIX + "userRole",
      joinColumns = {
              @JoinColumn(name = "role_uid",
                    referencedColumnName = "uid",
                    nullable = false)},
      inverseJoinColumns = {
                  @JoinColumn(name = "user_uid",
                        referencedColumnName = "uid",
                        nullable = false)
                })
  private Set<User> users;
}
