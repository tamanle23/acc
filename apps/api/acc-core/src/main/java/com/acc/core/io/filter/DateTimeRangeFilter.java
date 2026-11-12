package com.acc.core.io.filter;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
public class DateTimeRangeFilter extends RangeFilter<LocalDateTime> {
}
