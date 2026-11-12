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
public class CreateTenantRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotBlank(message = "tenantId must not be blank")
    @Pattern(regexp = "^[a-z0-9-]+$", message = "tenantId must be alphanumeric with hyphens")
    private String tenantId;

    @NotBlank(message = "tenantName must not be blank")
    private String tenantName;

    private String slug;

    private String ownerEmail;

    @Builder.Default
    private String tier = "BASIC";

    @Builder.Default
    private String blueprintId = "ecommerce-standard";
}
