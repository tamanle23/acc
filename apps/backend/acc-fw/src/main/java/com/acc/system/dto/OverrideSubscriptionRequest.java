package com.acc.system.dto;

import jakarta.validation.constraints.NotBlank;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OverrideSubscriptionRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotBlank(message = "planTier must not be blank")
    private String planTier;

    private List<String> features;

    private LocalDateTime expiresAt;

    @NotBlank(message = "reason is required for subscription override")
    private String reason;
}
