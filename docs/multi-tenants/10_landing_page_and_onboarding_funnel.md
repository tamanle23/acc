# Part 10: Unipost Landing Page, Onboarding Funnel & payOS Checkout Architecture

**Series:** Multi-Tenant Architecture Blueprint Series (Document 10 of N)  
**Document Level:** Front-End Architecture, Product Design & Onboarding Funnel Specification  
**Target Systems:** `@acc/console` (React 19 / Vite 8 / TanStack Router / Liquid Glass Design System), `@acc/backend` (Spring Modulith / payOS)  
**Scope:** Public Marketing Landing Page, Dynamic Product Showcase, Tiered Subscription Cards (Basic/Pro/Pro Max), Integrated Register/Login Modal & Flow, Instant payOS VietQR Checkout  
**Status:** Canonical Living Architecture Document  

---

## 1. Executive Summary & Design Rationale

To make the Unipost Multi-Tenant Dynamic Metadata Platform commercially accessible, the platform requires an **integrated, high-converting public landing page and onboarding funnel**. 

Currently, navigating to the root URL (`/`) immediately assumes an authenticated dashboard context or forces raw sign-in screens. By establishing a dedicated **Landing Page (`/`)**, unauthenticated visitors can:
1. **Understand Unipost's Value Proposition**: Visualizing the runtime-extensible dynamic metadata engine, zero-downtime schema evolution, Pattern C graph edges, and AI agent integration.
2. **Review Subscription Plans**: Transparently comparing **Basic (Miễn phí)**, **Pro (199,000 VND/tháng)**, and **Pro Max (499,000 VND/tháng)** with monthly/yearly cadence toggles.
3. **Seamlessly Register & Onboard**: Direct signup with instant workspace provisioning.
4. **Trigger Instant payOS VietQR Checkout**: When selecting Pro or Pro Max, generating a dynamic VietQR code for 1-click banking transfer and instant entitlement unlock.

---

## 2. Landing Page Layout & Component Blueprint

Styled strictly adhering to the **Liquid Glass UI standard** (`backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border-white/30`, specular borders, and diffuse shadows).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Unipost        Tính năng    Giải pháp    Bảng giá    Tài liệu    [ Đăng nhập ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                                    HERO SECTION                                        │
│               Nền Tảng Quản Trị Dữ Liệu Động & Metadata Đa Khách Hàng                  │
│        Xây dựng hệ thống quản lý dữ liệu, biểu mẫu động và đồ thị quan hệ             │
│                 không cần viết code và không cần migration database.                   │
│                                                                                        │
│             [ 🚀 Bắt đầu miễn phí ]           [ 🎥 Xem demo trực tiếp ]                │
│                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                             INTERACTIVE PRODUCT PREVIEW                                │
│          ┌──────────────────────────────────────────────────────────────┐              │
│          │ Liquid Glass Studio Mockup:                                  │              │
│          │ [ 🏢 Entity Model ] -> [ 📋 Dynamic Form ] -> [ ᛦ Graph ]     │              │
│          └──────────────────────────────────────────────────────────────┘              │
│                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                            SUBSCRIPTION & PRICING SECTION                              │
│                    [ Hàng tháng (Monthly) ]  🔘  [ Hàng năm (-20%) ]                   │
│                                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │   🆓 Basic (Cơ bản)   │  │      ⚡ Pro (Pro)      │  │    👑 Pro Max (Pro Max)    │  │
│  │      Miễn phí         │  │    199,000 VND/tháng   │  │     499,000 VND/tháng      │  │
│  │  1 User duy nhất      │  │    Lên đến 5 Users     │  │     Không giới hạn Users   │  │
│  │  Data Explorer động   │  │    Data Explorer động  │  │     Data Explorer động     │  │
│  │  Tự do lưu trữ data   │  │    Tính năng nâng cao  │  │     Toàn quyền tính năng   │  │
│  │                       │  │                        │  │     AI Agent MCP Server    │  │
│  │  [ Dùng ngay ]        │  │  [ Nâng cấp VietQR ]   │  │  [ Trải nghiệm Pro Max ]   │  │
│  └───────────────────────┘  └───────────────────────┘  └────────────────────────────┘  │
│                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ FOOTER: Bản quyền © 2026 Unipost. Tích hợp thanh toán an toàn qua cổng payOS VietQR.  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 3-Step Seamless Onboarding & Checkout Funnel

```
Step 1: Public Discovery
User lands on `/` -> Interacts with dynamic preview -> Clicks Plan CTA (e.g. Pro: 199k)
       │
       ▼
Step 2: Micro-Registration Modal
┌────────────────────────────────────────────────────────┐
│ Đăng ký tài khoản Unipost                              │
│ • Họ và tên: [ Alex Nguyen ]                           │
│ • Email: [ alex@acme.vn ]                              │
│ • Tên tổ chức / Workspace: [ Acme Global Logistics ]   │
│ • Mật khẩu: [ •••••••• ]                               │
│ [ Tạo Workspace & Tiếp tục ]                           │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
Step 3: payOS Dynamic VietQR Modal (For Pro / Pro Max)
┌────────────────────────────────────────────────────────┐
│ Thanh toán gói Pro (199,000 VND) qua payOS VietQR      │
│                                                        │
│             ┌────────────────────────────┐             │
│             │   [ MÃ VIETQR DYNAMIC ]    │             │
│             │   Ngân hàng: MB Bank       │             │
│             │   Số tiền: 199,000 VND     │             │
│             │   Nội dung: UNIPOST PRO    │             │
│             └────────────────────────────┘             │
│                                                        │
│ Quét mã bằng bất kỳ ứng dụng ngân hàng nào (Napas247). │
│ Hệ thống tự động kích hoạt ngay khi nhận tiền.         │
│                                                        │
│ [ Đã chuyển khoản xong ]        [ Bỏ qua / Dùng Basic] │
└───────────────────────┬────────────────────────────────┘
                        │ Real-time Webhook Confirmation
                        ▼
Step 4: Immediate Redirect to Workspace
User lands on `/_authenticated/` with instant Pro feature entitlements active!
```

---

## 4. Front-End Routing Architecture (`apps/console`)

In `@acc/console`, route definitions use **TanStack Router**:

```
apps/console/src/routes/
├── __root.tsx                      # Root provider tree (Theme, Font, QueryClient)
├── index.tsx                       # NEW: Public Landing Page (`/`) with Hero & Pricing
├── (auth)/                         # Auth routes
│   ├── sign-in.tsx                 # Dedicated Sign-In page
│   ├── sign-up.tsx                 # Dedicated Sign-Up page
│   └── forgot-password.tsx
└── _authenticated/                 # Authenticated App Routes (Guarded by JWT/Session)
    ├── route.tsx                   # Auth Guard: Redirects to `/` or `/sign-in` if unauthenticated
    ├── index.tsx                   # Dashboard (`/_authenticated/`)
    └── metadata/                   # Dynamic Metadata Studio & Data Explorer
```

### 4.1 Route Guard Specification (`routes/index.tsx`)
```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { LandingPage } from '@/features/landing';

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    // If user is already authenticated with valid JWT, redirect straight to dashboard
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: '/_authenticated' });
    }
  },
  component: LandingPage,
});
```

---

## 5. Technical Implementation Details

### 5.1 Landing Page Feature Structure
```
apps/console/src/features/landing/
├── index.tsx                       # Main LandingPage wrapper
├── components/
│   ├── landing-header.tsx          # Liquid Glass Frosted Navigation Bar
│   ├── hero-section.tsx            # Main value proposition & CTA buttons
│   ├── interactive-demo.tsx        # Mini interactive schema/grid preview
│   ├── pricing-section.tsx         # 3-tier pricing cards with monthly/yearly toggle
│   ├── payos-qr-modal.tsx          # Dynamic payOS VietQR checkout modal
│   └── landing-footer.tsx          # Compliance, terms, and footer links
└── hooks/
    ├── use-landing-pricing.ts      # Monthly / Yearly price calculation state
    └── use-payos-checkout.ts       # Calls backend /api/v1/billing/payos/create-link
```

### 5.2 Pricing Card Component with payOS Trigger
```tsx
// apps/console/src/features/landing/components/pricing-section.tsx
export const PricingSection: React.FC = () => {
  const [cadence, setCadence] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [activeQrOrder, setActiveQrOrder] = useState<PayOsCheckoutData | null>(null);

  const handleSelectPlan = async (planTier: 'BASIC' | 'PRO' | 'PRO_MAX') => {
    if (planTier === 'BASIC') {
      // Direct redirect to registration with Basic plan
      navigate({ to: '/(auth)/sign-up', search: { plan: 'BASIC' } });
      return;
    }

    // Pro or Pro Max: Open payOS VietQR modal
    const checkout = await createPayOsPaymentLink({ planTier, cadence });
    setActiveQrOrder(checkout);
  };

  return (
    <section id="pricing" className="py-20 px-6 max-w-7xl mx-auto">
      {/* Cadence Toggle & Pricing Cards */}
      ...
      {activeQrOrder && (
        <PayOsQrModal 
          checkoutData={activeQrOrder} 
          onClose={() => setActiveQrOrder(null)} 
        />
      )}
    </section>
  );
};
```

---

## 6. Summary of Architectural Advantages

| Metric | Previous State | With Landing Page Funnel (Part 10) |
| :--- | :--- | :--- |
| **First Impression** | Blank auth sign-in box with zero context. | High-converting Liquid Glass showcase explaining dynamic metadata. |
| **Subscription Adoption** | Hidden behind internal settings. | Transparently presented upfront with Monthly/Yearly options. |
| **Checkout Speed** | Manual billing consultation. | Instant VietQR scan via payOS completed in $< 10\text{ seconds}$. |
| **User Experience** | Fragmented screens. | Cohesive, self-service onboarding from discovery to active dashboard. |
