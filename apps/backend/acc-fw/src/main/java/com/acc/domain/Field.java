package com.acc.domain;

import com.acc.domain.NamedModel;
import lombok.Data;
import lombok.EqualsAndHashCode;

import jakarta.persistence.Table;

@Data
@EqualsAndHashCode(callSuper=true)
@jakarta.persistence.Entity
@Table(name = "acc_field")
public class Field extends NamedModel {
  private String name;
  private String type;
  private Integer length;
  private Integer decimal;
  private Integer origin;
}
