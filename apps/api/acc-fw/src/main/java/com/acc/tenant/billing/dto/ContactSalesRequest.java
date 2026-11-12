package com.acc.tenant.billing.dto;

import jakarta.validation.constraints.Email;
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
public class ContactSalesRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotBlank(message = "Company name is required")
    private String companyName;

    @NotBlank(message = "Contact person name is required")
    private String contactName;

    @Email(message = "Valid email is required")
    @NotBlank(message = "Email is required")
    private String email;

    private String phone;
    private Integer seatCount;
    private String requirements;
}
