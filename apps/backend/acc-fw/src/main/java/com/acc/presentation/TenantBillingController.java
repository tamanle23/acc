package com.acc.presentation;

import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;
import com.acc.fw.ResponseEntityBuilder;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.tenant.billing.PayOsBillingService;
import com.acc.tenant.billing.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/billing")
@RequiredArgsConstructor
public class TenantBillingController {

    private final PayOsBillingService billingService;
    private final ResponseEntityBuilder responseBuilder;

    /**
     * Get active tenant's current plan, subscription status, quota usage, VAT invoice, and transaction history.
     */
    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, TenantBillingSummaryDto>> getBillingSummary() {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        TenantBillingSummaryDto summary = billingService.getTenantBillingSummary(tenantId);
        return responseBuilder.success(summary);
    }

    /**
     * Create a payOS payment link and dynamic VietQR code for upgrading/renewing subscription.
     */
    @PostMapping("/checkout")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, CheckoutResponseDto>> createCheckout(
            @Valid @RequestBody CreatePaymentLinkRequest request) {
        CheckoutResponseDto checkout = billingService.createPaymentLink(request);
        return responseBuilder.success(checkout);
    }

    /**
     * Update corporate VAT E-Invoice information for active tenant.
     */
    @PutMapping("/vat-invoice")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, VatInvoiceDto>> updateVatInvoice(
            @Valid @RequestBody VatInvoiceDto vatDto) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        VatInvoiceDto updated = billingService.updateVatInvoice(tenantId, vatDto);
        return responseBuilder.success(updated);
    }

    /**
     * Submit an Enterprise contact request for custom pricing and dedicated infrastructure.
     */
    @PostMapping("/contact-sales")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, String>> contactSales(
            @Valid @RequestBody ContactSalesRequest request) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        billingService.recordContactSales(tenantId, request);
        return responseBuilder.success("Inquiry submitted successfully");
    }

    /**
     * Public Webhook endpoint called by payOS gateway upon QR transfer confirmation.
     * Validates cryptographic HMAC signature and unlocks dynamic feature entitlements.
     */
    @PostMapping("/payos/webhook")
    public ResponseEntity<?> handlePayOsWebhook(@RequestBody PayOsWebhookPayload webhookBody) {
        log.info("Received incoming payOS payment webhook for order: {}",
                webhookBody.getData() != null ? webhookBody.getData().getOrderCode() : "N/A");

        boolean success = billingService.verifyAndProcessWebhook(webhookBody);
        if (!success) {
            return ResponseEntity.badRequest().body("{\"status\":\"error\",\"message\":\"Invalid signature or rejected webhook\"}");
        }

        return ResponseEntity.ok("{\"status\":\"success\"}");
    }
}
