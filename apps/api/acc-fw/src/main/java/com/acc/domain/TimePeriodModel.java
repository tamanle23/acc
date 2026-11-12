package com.acc.domain;

import java.time.LocalDateTime;

import jakarta.persistence.MappedSuperclass;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@MappedSuperclass
public abstract class TimePeriodModel extends NamedModel {

  private LocalDateTime fromDate;

  private LocalDateTime toDate;

}
