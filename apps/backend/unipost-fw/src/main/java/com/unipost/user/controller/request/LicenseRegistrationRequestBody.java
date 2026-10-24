package com.unipost.user.controller.request;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LicenseRegistrationRequestBody {
  private String licenseKey;
  private boolean nonLocked;
  private LocalDateTime fromDate;
  private LocalDateTime toDate;
}
