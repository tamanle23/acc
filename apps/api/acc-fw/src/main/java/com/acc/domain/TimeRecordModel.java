package com.acc.domain;

import java.time.LocalDateTime;

import jakarta.persistence.MappedSuperclass;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper=false)
@MappedSuperclass
public abstract class TimeRecordModel extends NamedModel {

  private static final long serialVersionUID = -8858973003913251007L;
  private LocalDateTime recordedDate;
}
