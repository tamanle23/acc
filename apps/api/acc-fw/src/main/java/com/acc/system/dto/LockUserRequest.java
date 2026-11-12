package com.acc.system.dto;

import jakarta.validation.constraints.NotBlank;
import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LockUserRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    private boolean locked;

    @NotBlank(message = "reason is required for locking/unlocking user")
    private String reason;
}
