package com.acc.system.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTenantStatusRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotBlank(message = "status must not be blank")
    @Pattern(regexp = "^(ACTIVE|SUSPENDED|ARCHIVED)$", message = "status must be ACTIVE, SUSPENDED, or ARCHIVED")
    private String status;

    @NotBlank(message = "reason is required for status changes")
    private String reason;
}
