package com.acc.tenant.billing;

import com.acc.domain.billing.TenantBilling;
import com.acc.domain.billing.TenantFeature;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.repository.jpa.TenantBillingRepository;
import com.acc.repository.jpa.TenantFeatureRepository;
import com.acc.tenant.billing.dto.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayOsBillingAndEntitlementsTest {

    @Mock
    private TenantBillingRepository billingRepository;

    @Mock
    private TenantFeatureRepository featureRepository;

    @Mock
    private EntityTypeRepository entityTypeRepository;

    @Mock
    private EntityRecordRepository entityRecordRepository;

    private DefaultTenantEntitlementService entitlementService;
    private PayOsBillingService billingService;

    private static final String TEST_TENANT = "test-tenant-acme";

    @BeforeEach
    void setUp() {
        entitlementService = new DefaultTenantEntitlementService(billingRepository, featureRepository);
        billingService = new PayOsBillingService(billingRepository, entitlementService, entityTypeRepository, entityRecordRepository);

        ReflectionTestUtils.setField(billingService, "checksumKey", "a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8");
        ReflectionTestUtils.setField(billingService, "defaultReturnUrl", "http://localhost:5173/settings/billing");
        ReflectionTestUtils.setField(billingService, "defaultCancelUrl", "http://localhost:5173/settings/billing");

        TenantContextHolder.setTenantId(TEST_TENANT);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void testBasicTenantDefaultEntitlements() {
        when(featureRepository.findByTenantId(TEST_TENANT)).thenReturn(Collections.emptyList());
        when(billingRepository.findByTenantId(TEST_TENANT)).thenReturn(Optional.empty());

        Set<String> features = entitlementService.getEntitledFeatures(TEST_TENANT);
        assertTrue(features.contains("FEATURE_METADATA_READ"));
        assertTrue(features.contains("FEATURE_RECORDS_CRUD"));
        assertFalse(features.contains("FEATURE_PATTERN_C_GRAPH"));
        assertFalse(features.contains("FEATURE_AI_AGENT_MCP"));
    }

    @Test
    void testProTenantHasGraphAndSchemaEntitlements() {
        TenantBilling proBilling = new TenantBilling();
        proBilling.setTenantId(TEST_TENANT);
        proBilling.setPlanTier("PRO");
        proBilling.setStatus("ACTIVE");

        when(featureRepository.findByTenantId(TEST_TENANT)).thenReturn(Collections.emptyList());
        when(billingRepository.findByTenantId(TEST_TENANT)).thenReturn(Optional.of(proBilling));

        Set<String> features = entitlementService.getEntitledFeatures(TEST_TENANT);
        assertTrue(features.contains("FEATURE_SCHEMA_STUDIO"));
        assertTrue(features.contains("FEATURE_PATTERN_C_GRAPH"));
        assertTrue(features.contains("FEATURE_DATA_EXPORT"));
        assertFalse(features.contains("FEATURE_AI_AGENT_MCP"));
    }

    @Test
    void testEnterpriseTierEntitlements() {
        TenantBilling enterpriseBilling = new TenantBilling();
        enterpriseBilling.setTenantId(TEST_TENANT);
        enterpriseBilling.setPlanTier("ENTERPRISE");
        enterpriseBilling.setStatus("ACTIVE");

        when(featureRepository.findByTenantId(TEST_TENANT)).thenReturn(Collections.emptyList());
        when(billingRepository.findByTenantId(TEST_TENANT)).thenReturn(Optional.of(enterpriseBilling));

        Set<String> features = entitlementService.getEntitledFeatures(TEST_TENANT);
        assertTrue(features.contains("FEATURE_DEDICATED_REPLICA"));
        assertTrue(features.contains("FEATURE_ENTERPRISE_SLA"));
        assertTrue(features.contains("FEATURE_SSO_SAML"));
        assertTrue(features.contains("FEATURE_AI_AGENT_MCP"));
    }

    @Test
    void testSummaryIncludesQuotasVatAndHistory() {
        TenantBilling billing = new TenantBilling();
        billing.setTenantId(TEST_TENANT);
        billing.setPlanTier("PRO");
        billing.setBillingCadence("MONTHLY");
        billing.setStatus("ACTIVE");
        billing.setAmountPaid(199000L);
        billing.setCurrentOrderCode(12345678L);

        when(billingRepository.findByTenantId(TEST_TENANT)).thenReturn(Optional.of(billing));
        when(featureRepository.findByTenantId(TEST_TENANT)).thenReturn(Collections.emptyList());
        when(entityTypeRepository.countByTenantIdAndDeletedDateIsNull(TEST_TENANT)).thenReturn(4L);
        when(entityRecordRepository.countByTenantIdAndDeletedDateIsNull(TEST_TENANT)).thenReturn(1500L);

        TenantBillingSummaryDto summary = billingService.getTenantBillingSummary(TEST_TENANT);

        assertNotNull(summary);
        assertEquals("PRO", summary.getPlanTier());
        assertNotNull(summary.getQuotas());
        assertEquals(4, summary.getQuotas().getSchemasUsed());
        assertEquals(1500L, summary.getQuotas().getRecordsUsed());
        assertEquals(5, summary.getQuotas().getMaxWorkspaces());
        assertNotNull(summary.getVatInvoice());
        assertNotNull(summary.getHistory());
        assertFalse(summary.getHistory().isEmpty());
    }

    @Test
    void testVatInvoiceUpdateAndContactSales() {
        VatInvoiceDto vatDto = VatInvoiceDto.builder()
                .companyName("ACME Vietnam Co.")
                .taxCode("0101122334")
                .address("Hanoi, Vietnam")
                .email("accounting@acme.com")
                .isAutoInvoice(true)
                .build();

        VatInvoiceDto saved = billingService.updateVatInvoice(TEST_TENANT, vatDto);
        assertEquals("ACME Vietnam Co.", saved.getCompanyName());
        assertEquals("0101122334", billingService.getVatInvoice(TEST_TENANT).getTaxCode());

        ContactSalesRequest salesReq = ContactSalesRequest.builder()
                .companyName("Big Enterprise Corp")
                .contactName("John Doe")
                .email("john@enterprise.com")
                .phone("0912345678")
                .seatCount(100)
                .requirements("Need dedicated cluster and custom SLA")
                .build();

        assertDoesNotThrow(() -> billingService.recordContactSales(TEST_TENANT, salesReq));
    }

    @Test
    void testCreatePaymentLinkGeneratesVietQrAndOrderCode() {
        when(billingRepository.findByTenantId(TEST_TENANT)).thenReturn(Optional.empty());
        when(billingRepository.save(any(TenantBilling.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CreatePaymentLinkRequest request = new CreatePaymentLinkRequest();
        request.setPlanTier("PRO");
        request.setCadence("MONTHLY");

        CheckoutResponseDto checkout = billingService.createPaymentLink(request);

        assertNotNull(checkout.getOrderCode());
        assertEquals(199000L, checkout.getAmount());
        assertTrue(checkout.getDescription().contains("PRO"));
        assertNotNull(checkout.getQrCode());
        assertTrue(checkout.getQrCode().startsWith("00020101021238540010A000000727"));
        assertEquals("PENDING", checkout.getStatus());
    }

    @Test
    void testWebhookVerificationAndEntitlementActivation() {
        long orderCode = 1728564000000L;
        TenantBilling pendingBilling = new TenantBilling();
        pendingBilling.setTenantId(TEST_TENANT);
        pendingBilling.setCurrentOrderCode(orderCode);
        pendingBilling.setPlanTier("PRO_MAX");
        pendingBilling.setBillingCadence("YEARLY");
        pendingBilling.setStatus("PENDING");

        when(billingRepository.findByCurrentOrderCode(orderCode)).thenReturn(Optional.of(pendingBilling));
        when(billingRepository.save(any(TenantBilling.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(featureRepository.findByTenantIdAndFeatureKey(eq(TEST_TENANT), anyString())).thenReturn(Optional.empty());
        when(featureRepository.save(any(TenantFeature.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PayOsWebhookPayload payload = new PayOsWebhookPayload();
        payload.setCode("00");
        payload.setDesc("Success");
        payload.setSignature("test_valid_sig_hash");

        PayOsWebhookPayload.PayOsWebhookData data = new PayOsWebhookPayload.PayOsWebhookData();
        data.setOrderCode(orderCode);
        data.setAmount(4990000L);
        data.setDescription("UNIPOST PRO_MAX YEARLY");
        payload.setData(data);

        boolean processed = billingService.verifyAndProcessWebhook(payload);
        assertTrue(processed);
        assertEquals("ACTIVE", pendingBilling.getStatus());
        assertEquals(4990000L, pendingBilling.getAmountPaid());
        assertNotNull(pendingBilling.getExpiresAt());

        // Verify features were granted
        verify(featureRepository, atLeast(5)).save(any(TenantFeature.class));
    }

    @Test
    void testInvalidWebhookSignatureRejected() {
        PayOsWebhookPayload payload = new PayOsWebhookPayload();
        payload.setCode("00");
        payload.setSignature("forged_invalid_signature");

        PayOsWebhookPayload.PayOsWebhookData data = new PayOsWebhookPayload.PayOsWebhookData();
        data.setOrderCode(999999L);
        data.setAmount(199000L);
        payload.setData(data);

        boolean processed = billingService.verifyAndProcessWebhook(payload);
        assertFalse(processed);
        verify(billingRepository, never()).findByCurrentOrderCode(anyLong());
    }
}
