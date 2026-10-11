package com.unipost.core.io;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.ZonedDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ContextHeader {

  String application;
  String transactionId;
  String requestId;
  String timeZone;
  String authorization;
  String userId;
  String clientType;
  String traceparent;
  String traceId;
  ZonedDateTime requestAtClient;
  ZonedDateTime requestAtServer;
  ZonedDateTime responseAtServer;
}
