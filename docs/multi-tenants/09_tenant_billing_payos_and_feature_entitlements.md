# Part 9: Tenant Subscription Billing via payOS & Dynamic Feature Entitlements

**Series:** Multi-Tenant Architecture Blueprint Series (Document 09 of N)  
**Document Level:** FinOps, Subscription Architecture & Feature Gate Specification  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21 / payOS Vietnam SDK/API), `@acc/console` (React 19 / Vite 8)  
**Scope:** Simple Cadence Subscriptions (Monthly / Yearly), payOS Checkout Integration (VietQR / Napas / Banking), Webhook Signature Verification, Dynamic Feature Entitlements Engine, In-App Capability Gating  
**Status:** Canonical Living Architecture Document  

---

## 1. Executive Summary & Revenue Architecture

In Acc's dynamic metadata ecosystem, pricing and monetization are built around **Feature & Capability Entitlements**, rather than penalizing customers for individual record creation rates.

Tenants select a subscription cadence (**Monthly** or **Yearly** with an annual discount) across distinct subscription tiers or modular functional add-ons. Payments are processed seamlessly using **payOS** (supporting automated VietQR, banking transfers, and domestic debit cards). System capabilities—such as the Schema Architect Studio, Pattern C Graph Edges, AI MCP Agent bridges, and Webhook dispatchers—are unlocked dynamically based on the tenant's subscribed feature set.

### Core Billing Principles
1. **Predictable Cadence (Monthly / Yearly)**:
   Customers pay flat, predictable recurring fees for access tiers and enabled feature modules, eliminating billing anxiety associated with fluctuating per-record or per-query rates.
2. **VietQR / Seamless Domestic Checkout via payOS**:
   Subscriptions generate payOS payment links featuring dynamic QR codes compatible with all Vietnamese banking apps (VietQR / Napas247).
3. **Decoupled Dynamic Entitlements**:
   The engine does not hardcode static plan checks (`if (plan == 'STARTER')`). Instead, it queries a dynamic **Feature Entitlement Registry** (`UNIPOST_TENANT_FEATURES`). Features can be enabled, disabled, or granted as trial add-ons on the fly.
4. **Graceful Functional Gating**:
   When a tenant attempts to access an unentitled feature (e.g., configuring a Pattern C graph or enabling an AI agent tool), the UI and API present clear upgrade pathways with immediate payOS QR checkout links.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FEATURE-BASED SUBSCRIPTION WITH payOS                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Subscription Selection -> Monthly or Yearly plan selected in @acc/console       │
│ 2. payOS Payment Link     -> Backend calls payOS API (orderCode, amount, returnUrl)    │
│ 3. Instant VietQR Scan    -> User scans dynamic VietQR code on banking app             │
│ 4. Webhook Verification   -> payOS webhook hits backend; validates HMAC_SHA256 sig    │
│ 5. Entitlement Activation -> Active feature keys populated in UNIPOST_TENANT_FEATURES  │
│ 6. Fast Cache Reflection  -> Entitlements cached in Redis/Hazelcast: `entitlements:{tid}`│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Subscription Plans & Dynamic Feature Tiers

Subscriptions are structured across 3 transparent tiers (Monthly / Yearly with 2 months free on annual plans). Specific functionalities and capabilities are decoupled from hardcoded plan tiers and provided dynamically via the Feature Entitlements Engine:

| Plan Dimension | 🆓 Basic (Cơ bản) | ⚡ Pro (Pro) | 👑 Pro Max (Pro Max) |
| :--- | :--- | :--- | :--- |
| **Giá thuê bao (Price)** | **Miễn phí (Free)** | **199,000 VND / tháng**<br>*(1,990,000 VND / năm)* | **499,000 VND / tháng**<br>*(4,990,000 VND / năm)* |
| **Đối tượng phù hợp** | Cá nhân, Freelancer dùng thử | Chuyên gia, Doanh nghiệp vừa & nhỏ | Doanh nghiệp vận hành quy mô lớn |
| **Phương thức thanh toán** | Không cần thanh toán | payOS VietQR / Napas247 / Banking | payOS VietQR / Napas247 / Banking |
| **Số lượng User** | 1 User duy nhất | Lên đến 5 Users | Không giới hạn Users |
| **Dữ liệu (Records)** | Không giới hạn bản ghi (Records) | Không giới hạn bản ghi (Records) | Không giới hạn bản ghi (Records) |
| **Tính năng & Chức năng** | Cung cấp động theo quyền hạn | Cung cấp động theo quyền hạn | Cung cấp động theo quyền hạn |

> **Lưu ý kiến trúc (Dynamic Features Note):**  
> Hệ thống **hoàn toàn không cố định cứng** (hardcode) các tính năng nghiệp vụ cụ thể vào bảng giá trên. Thay vào đó, danh mục tính năng (Features & Functionalities) được quản lý và cấp phát động hoàn toàn thông qua bảng `UNIPOST_TENANT_FEATURES` (xem Mục 3). Khi phát triển thêm các tính năng mới trong tương lai, ban quản trị có thể gán hoặc mở khóa tính năng cho từng gói hoặc từng tenant linh hoạt mà không cần thay đổi cấu trúc bảng giá.

---

## 3. Dynamic Feature Entitlement Engine Architecture

To ensure the billing system can dynamically accommodate new features without database migrations, entitlements are modeled as dynamic keys attached to a tenant.

```
┌───────────────────────────┐
│  UNIPOST_TENANT_BILLING   │
├───────────────────────────┤
│ tenant_id (PK)            │
│ payos_customer_id         │
│ current_order_code (BIGINT)│
│ plan_tier (STARTER/PRO)   │
│ billing_cadence (M/Y)     │
│ expires_at (TIMESTAMP)    │
│ status (ACTIVE/EXPIRED)   │
└─────────────┬─────────────┘
              │ 1:N
              ▼
┌───────────────────────────┐
│ UNIPOST_TENANT_FEATURES   │
├───────────────────────────┤
│ id (PK)                   │
│ tenant_id (FK)            │
│ feature_key (VARCHAR)     │ ──> 'FEATURE_PATTERN_C_GRAPH', 'FEATURE_AI_AGENT_MCP', etc.
│ is_enabled (BOOLEAN)      │
│ expires_at (TIMESTAMP)    │ ──> Supports temporary trials / promotional unlocks
└───────────────────────────┘
```

### 3.1 The Dynamic Feature Keys (To be Dynamically Implemented & Extended)
Features and functionalities are fully decoupled into extensible string tokens that can be dynamically defined, registered, and granted over time:
* *Ví dụ tính năng (Examples of dynamic feature tokens):*
  * `FEATURE_SCHEMA_STUDIO`: Quyền truy cập vào tab Schema Builder trong `@acc/console`.
  * `FEATURE_PATTERN_C_GRAPH`: Quyền tạo và khai thác mô hình liên kết đồ thị đa chiều (Pattern C Edges).
  * `FEATURE_STATE_MACHINE`: Quyền thiết lập vòng đời thực thể và điều kiện chuyển trạng thái.
  * `FEATURE_AI_AGENT_MCP`: Quyền tổng hợp công cụ động cho AI Agents qua chuẩn MCP Server.
  * `FEATURE_STREAMING_EXPORT`: Quyền xuất dữ liệu lớn dạng streaming (S3/NDJSON).
* *Khả năng mở rộng (Extensibility):* Bất kỳ tính năng mới nào được phát triển trong tương lai chỉ cần định nghĩa một mã `feature_key` mới và gán vào hệ thống quyền của tenant, không cần thay đổi cấu trúc bảng hay logic cốt lõi.

---

## 4. payOS Payment Link Creation & Lifecycle

### 4.1 Payment Link Service (`PayOsBillingService.java`)
When a tenant admin chooses a plan or renews, the backend requests a payment link from payOS:

```java
package com.acc.tenant.billing.payos;

import vn.payos.PayOS;
import vn.payos.type.ItemData;
import vn.payos.type.PaymentData;
import vn.payos.type.CheckoutResponseData;
import com.acc.fw.tenancy.TenantContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PayOsBillingService {

    private final PayOS payOS;

    @Value("${application.payos.return-url}")
    private String returnUrl;

    @Value("${application.payos.cancel-url}")
    private String cancelUrl;

    public PayOsBillingService(
            @Value("${application.payos.client-id}") String clientId,
            @Value("${application.payos.api-key}") String apiKey,
            @Value("${application.payos.checksum-key}") String checksumKey) {
        this.payOS = new PayOS(clientId, apiKey, checksumKey);
    }

    public CheckoutResponseData createSubscriptionPaymentLink(String planTier, String cadence) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        long orderCode = System.currentTimeMillis(); // Unique long order code required by payOS

        int amount = calculateAmount(planTier, cadence);
        String description = "Acc " + planTier + " (" + cadence + ")";

        ItemData planItem = ItemData.builder()
                .name(description)
                .quantity(1)
                .price(amount)
                .build();

        PaymentData paymentData = PaymentData.builder()
                .orderCode(orderCode)
                .amount(amount)
                .description(description)
                .returnUrl(returnUrl + "?orderCode=" + orderCode)
                .cancelUrl(cancelUrl + "?orderCode=" + orderCode)
                .items(List.of(planItem))
                .build();

        try {
            return payOS.createPaymentLink(paymentData);
        } catch (Exception e) {
            throw new PayOsPaymentException("Failed to generate payOS payment link: " + e.getMessage(), e);
        }
    }

    private int calculateAmount(String planTier, String cadence) {
        if ("PRO_MAX".equalsIgnoreCase(planTier)) {
            // Pro Max: 499,000 VND / month or 4,990,000 VND / year (2 months free)
            return "YEARLY".equalsIgnoreCase(cadence) ? 4990000 : 499000;
        }
        if ("PRO".equalsIgnoreCase(planTier)) {
            // Pro: 199,000 VND / month or 1,990,000 VND / year (2 months free)
            return "YEARLY".equalsIgnoreCase(cadence) ? 1990000 : 199000;
        }
        // Basic: Free tier
        return 0;
    }
}
```

---

## 5. payOS Webhook & Cryptographic Verification

payOS notifies the backend via webhook when a QR transfer is confirmed. To prevent spoofing, the webhook payload signature must be verified using the payOS Checksum Key (HMAC-SHA256):

```
┌─────────────────┐                                      ┌───────────────────────┐
│ payOS Gateway   │                                      │   @acc/backend    │
└────────┬────────┘                                      └───────────┬───────────┘
         │                                                           │
         │ POST /api/v1/billing/payos/webhook                        │
         │ Body: { code, desc, data: { orderCode, amount... }, signature }
         │──────────────────────────────────────────────────────────>│
         │                                                           │
         │                                    1. payOS.verifyPaymentWebhookData(body)
         │                                       Validates HMAC_SHA256 signature
         │                                                           │
         │                                    2. Look up Tenant by orderCode
         │                                                           │
         │                                    3. Extend Subscription Expiry
         │                                       (NOW + 30 days or NOW + 365 days)
         │                                                           │
         │                                    4. Unlock Dynamic Feature Entitlements
         │                                       (Insert / Update UNIPOST_TENANT_FEATURES)
         │                                                           │
         │                                    5. Invalidate Tenant Entitlements Cache
         │                                                           │
         │ 200 OK: {"status": "success"}                             │
         │<──────────────────────────────────────────────────────────│
```

### 5.1 Webhook Controller Implementation
```java
package com.acc.tenant.billing.payos;

import vn.payos.PayOS;
import vn.payos.type.Webhook;
import vn.payos.type.WebhookData;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/billing/payos")
public class PayOsWebhookController {

    private final PayOS payOS;
    private final TenantEntitlementService entitlementService;

    public PayOsWebhookController(PayOS payOS, TenantEntitlementService entitlementService) {
        this.payOS = payOS;
        this.entitlementService = entitlementService;
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handlePayOsWebhook(@RequestBody Webhook webhookBody) {
        try {
            // Verify HMAC-SHA256 signature using payOS SDK
            WebhookData data = payOS.verifyPaymentWebhookData(webhookBody);

            if (data != null && "00".equals(webhookBody.getCode())) {
                long orderCode = data.getOrderCode();
                entitlementService.activateSubscriptionFromOrder(orderCode, data.getAmount());
            }

            return ResponseEntity.ok("{\"status\":\"success\"}");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid payOS webhook signature");
        }
    }
}
```

---

## 6. Console UI In-App Feature Gating & VietQR Dialog (`@acc/console`)

When an unentitled feature is clicked or accessed in `@acc/console`:
1. The `<FeatureGate />` component renders a Liquid Glass card.
2. Clicking **"Nâng cấp gói (Upgrade)"** triggers the payOS checkout dialog displaying the dynamic **VietQR Code**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ᛦ Pattern C Connected Relationship Graphs                                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Tính năng này yêu cầu gói Pro hoặc Pro Max. Quét mã VietQR để kích hoạt ngay:         │
│                                                                                        │
│                      ┌────────────────────────────┐                                    │
│                      │  [   MÃ VIETQR DYNAMIC  ]  │                                    │
│                      │  Ngân hàng: MB Bank / Vietin│                                   │
│                      │  Số tiền: 199,000 VND/tháng│                                    │
│                      │  Nội dung: UNIPOST PRO     │                                    │
│                      └────────────────────────────┘                                    │
│                                                                                        │
│      [ Đã chuyển khoản qua App ]            [ Nâng cấp Pro Max (499k) ]                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

The frontend polls `/api/v1/billing/status` or listens to a Server-Sent Event (SSE) for instant confirmation. As soon as the payOS webhook is verified, the UI automatically unlocks the feature without refreshing the page.

---

## 7. Summary of Architectural Advantages

| Metric | Stripe (Global) | payOS (Vietnam Domestic) |
| :--- | :--- | :--- |
| **Payment Experience** | Credit Card / Foreign Transaction fees | Instant VietQR scan on any banking app (Napas247) |
| **Pricing Predictability** | Variable overage invoices | Flat monthly / annual subscription cadence |
| **Feature Modularity** | Static Stripe price IDs | Dynamic feature keys (`FEATURE_*`) in database & cache |
| **Integration Simplicity** | Complex multi-tier usage meters | Direct checkout link + HMAC-SHA256 verified webhook |
| **Customer Friction** | High (many domestic users lack corporate credit cards) | Zero (universal bank app QR compatibility) |
