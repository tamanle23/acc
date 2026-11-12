package com.acc.tenant.billing.dto;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VatInvoiceDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String companyName;
    private String taxCode;
    private String address;
    private String email;
    private Boolean isAutoInvoice;
}
