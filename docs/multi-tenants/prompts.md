# Unipost Landing Page & Onboarding Mockup Generation Prompts

**Series:** Multi-Tenant Architecture Blueprint Series (Design & Generative UI Prompts)  
**Target Engine:** Gemini (Imagen 3 / Multimodal Image Generation / Generative UI)  
**Design Standard:** Liquid Glass Mandatory Aesthetic (`backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border-white/30`, specular highlights, diffuse elevation)  
**Associated Architecture Docs:** [`docs/multi-tenants/10_landing_page_and_onboarding_funnel.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/10_landing_page_and_onboarding_funnel.md) & [`docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md)  
**Status:** Living Design Prompt Catalog  

---

## 1. Master Prompt: Full Desktop Web Landing Page (Hero & Product Showcase)

> **Goal:** Generate a complete high-fidelity desktop homepage mockup with frosted sticky header, hero value proposition, primary CTAs, and interactive studio canvas preview.  
> **Recommended Aspect Ratio:** `16:9`

```text
High-fidelity modern SaaS landing page UI design for "Unipost" - a next-generation Dynamic Metadata & Multi-Tenant Data Platform.

Layout & Structure:
- Frosted Liquid Glass top navigation bar: Unipost logo on the left, navigation links (Features, Solutions, Pricing, Docs), and on the right a glowing CTA button "[Đăng nhập / Bắt đầu ngay]".
- Hero Section: Centered typography with clean modern sans-serif. Bold headline: "Nền Tảng Quản Trị Dữ Liệu Động & Metadata Đa Khách Hàng". Subheadline: "Tự do xây dựng mô hình dữ liệu, biểu mẫu động và đồ thị liên kết mà không cần code hay migration database."
- Two CTA buttons: Primary glowing emerald-to-cyan gradient button "[🚀 Bắt đầu miễn phí]" and secondary frosted translucent button "[🎥 Xem demo trực tiếp]".
- Hero Visual / Interactive Stage: A floating, multi-layered Liquid Glass application dashboard preview showing dynamic schema builder on the left (entity cards, JSON schema tags) and a responsive data explorer grid on the right with specular borders and translucent rows.

Visual Style & Aesthetic (Liquid Glass Mandatory):
- Ultra-modern Apple/Vercel inspired Liquid Glass aesthetic with multi-layer backdrop blur (backdrop-filter: blur(20px)).
- Translucent frosted glass scrims (bg-white/65 with subtle dark mode accents, cyan/emerald ambient gradient glow in the deep background).
- Specular highlights: razor-thin 1px crisp white borders (border-white/30) with inset reflections and diffuse floating drop-shadows.
- Clean, premium, high contrast typography, WCAG AA compliant.

Format: Desktop browser interface mockup, 16:9 aspect ratio, clean front-facing perspective, no external laptop/monitor device bezels, purely the screen UI itself.
```

---

## 2. Component Prompt: 3-Tier Subscription & Pricing Section

> **Goal:** Generate a standalone pricing section mockup with monthly/yearly cadence toggle and 3 transparent tier cards: **Basic (Miễn phí)**, **Pro (199,000 VND)**, and **Pro Max (499,000 VND)**.  
> **Recommended Aspect Ratio:** `16:9` or `4:3`

```text
High-fidelity UI component mockup of a SaaS Pricing Section for "Unipost", designed with the Liquid Glass design system.

Header & Controls:
- Centered section header: "Bảng giá minh bạch - Linh hoạt theo quy mô của bạn".
- Sub-text: "Không giới hạn bản ghi. Tính năng cấp phát động theo nhu cầu."
- Liquid Glass toggle switch pill: "[ Hàng tháng ] ⚪ [ Hàng năm (Tặng 2 tháng) ]".

3 Pricing Cards Layout (Side-by-Side Floating Glass Cards):
1. Card 1 - Basic (Cơ bản):
   - Badge: "[ 🆓 Miễn phí ]"
   - Price: "0 đ / tháng"
   - Description: "Dành cho cá nhân & freelancer làm quen nền tảng"
   - Feature list: "1 User duy nhất", "Không giới hạn bản ghi (Records)", "Data Explorer động", "Xuất file CSV tiêu chuẩn"
   - Button: Frosted white glass button "[ Bắt đầu miễn phí ]"

2. Card 2 - Pro (Pro) [Featured / Highlighted Card]:
   - Glowing emerald border & subtle badge "[ ⭐ Phổ biến nhất ]"
   - Price: "199,000 VND / tháng" (or 1,990,000 VND/năm)
   - Description: "Dành cho chuyên gia & doanh nghiệp vừa và nhỏ"
   - Feature list: "Lên đến 5 Users", "Không giới hạn bản ghi", "Mở khóa tính năng nâng cao", "Hỗ trợ thanh toán nhanh VietQR"
   - Button: Prominent emerald gradient button "[ ⚡ Nâng cấp qua VietQR ]"

3. Card 3 - Pro Max (Pro Max) [Premium Card]:
   - Deep obsidian glass with cyan specular accent "[ 👑 Doanh nghiệp ]"
   - Price: "499,000 VND / tháng" (or 4,990,000 VND/năm)
   - Description: "Dành cho doanh nghiệp vận hành quy mô lớn"
   - Feature list: "Không giới hạn Users", "Toàn quyền tính năng nền tảng", "AI Agent MCP Server Bridge", "Streaming S3 Export"
   - Button: Frosted specular glass button "[ Trải nghiệm Pro Max ]"

Aesthetic Details:
- Translucent frosted glass texture, backdrop blur, diffused elevation shadows, sleek typography. Front-facing UI only, no 3D distortion.
```

---

## 3. Modal Prompt: Instant payOS VietQR Checkout Dialog

> **Goal:** Generate a dynamic checkout modal mockup featuring a live VietQR code for instant mobile banking transfers with payOS webhook confirmation.  
> **Recommended Aspect Ratio:** `1:1` or `4:3`

```text
High-fidelity UI modal dialog mockup for an instant "payOS VietQR Checkout" on Unipost platform.

Modal Window Elements:
- Floating Liquid Glass modal dialog box with frosted scrim backdrop blur (modal overlay dimming the background).
- Modal Title: "Thanh toán gói Pro (199,000 VND) qua payOS VietQR".
- Top right: Close icon (X).
- Body Content:
  - High-resolution dynamic VietQR code displayed in a clean white rounded card in the center.
  - Under the QR: Bank details with copy buttons:
    * "Ngân hàng: MB Bank (Ngân hàng Quân Đội)"
    * "Số tài khoản: 0388******"
    * "Số tiền: 199,000 VND"
    * "Nội dung chuyển khoản: UNIPOST PRO 89201"
  - Instructions banner: "Mở ứng dụng ngân hàng bất kỳ để quét mã VietQR (Napas247). Hệ thống tự động kích hoạt tài khoản ngay lập tức."
- Modal Footer:
  - Primary button: Glowing green check button "[ Đã chuyển khoản qua App ]"
  - Secondary text link: "[ Chọn hình thức khác / Đổi gói ]"

Design Tokens:
- Specular edge reflections (1px border-white/30), subtle ambient cyan/emerald glow behind the modal, clean Vietnamese typography, modern mobile-banking aesthetics. Pure UI render.
```

---

## 4. Modal Prompt: User Registration & Workspace Creation Dialog

> **Goal:** Generate a clean modal mockup for instant self-service sign-up connecting directly into workspace creation.  
> **Recommended Aspect Ratio:** `4:3` or `1:1`

```text
High-fidelity UI modal dialog mockup for "User Sign-up & Workspace Creation" on Unipost platform.

Modal Window Elements:
- Modern Liquid Glass floating card with multi-layer backdrop blur and subtle glowing border.
- Header: Unipost logo icon + Title "Tạo Workspace của bạn" + Subtitle "Bắt đầu trải nghiệm nền tảng quản trị metadata động".
- Form Fields (Styled in Liquid Glass inputs with frosted translucency and crisp focus states):
  * "Họ và tên" (e.g. Alex Nguyen)
  * "Email công việc" (e.g. alex@acme.vn)
  * "Tên tổ chức / Workspace" (e.g. Acme Global Logistics)
  * "Mật khẩu" (••••••••)
- Selected Plan indicator: Small translucent badge in the corner "[ Gói đã chọn: Pro (199k/tháng) ]".
- CTA Button: Glowing emerald button "[ Tạo Workspace & Tiếp tục ]".
- Footer Text: "Bằng cách đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư."
```

---

# 5. Google Stitch Living Design Specification: Unipost Landing Page (`DESIGN.md`)

> **Target Tool / Ingestion:** Google Stitch AI Design Canvas & Autonomous UI Agents  
> **Primary Language:** **Tiếng Việt (Vietnamese First)**  
> **Aesthetic System:** Liquid Glass Enterprise Design Language (Specularity, Translucency, Diffuse Elevation)  
> **Platform Scope:** Public Marketing Landing Page, Onboarding Funnel, and payOS VietQR Checkout  
> **Standard Compliance:** WCAG 2.2 AA Contrast & WAI-ARIA Accessible Dialogs  

---

## 5.1 System Identity & Tone of Voice

### Core Identity
Unipost là **Nền tảng Quản trị Dữ liệu Động & Metadata Đa Khách Hàng (Dynamic Metadata & Multi-Tenant Data Platform)**. Trang chủ (Landing Page) cần truyền tải được 3 thông điệp mấu chốt:
1. **Linh hoạt tuyệt đối (Zero-DDL Schema Agility):** Người dùng có thể tự định nghĩa thực thể, thêm trường tùy biến, thiết lập quan hệ đồ thị mà không cần can thiệp code hay chạy migration cơ sở dữ liệu.
2. **Trải nghiệm thị giác đỉnh cao (Liquid Glass Aesthetic):** Giao diện kính mờ hiện đại, khúc xạ ánh sáng đa lớp, độ tương phản sắc nét chuẩn doanh nghiệp.
3. **Thanh toán nội địa tức thì (payOS VietQR):** Không rào cản thẻ tín dụng quốc tế; người dùng quét mã VietQR là kích hoạt ngay tài khoản trong 5 giây.

### Tone & Ngôn ngữ
* **Phong cách:** Chuyên nghiệp, hiện đại, uy tín, tập trung vào giá trị năng suất (Enterprise Product-Led Growth).
* **Ngôn ngữ chính:** **Tiếng Việt tự nhiên**, thuật ngữ kỹ thuật được giải thích gãy gọn (ví dụ: *Metadata động, Đồ thị quan hệ, Biểu mẫu tự sinh*).

---

## 5.2 Google Stitch Portable Design Tokens

Google Stitch sử dụng bảng token dưới đây làm ràng buộc hệ thống khi sinh mã và giao diện:

### A. Color Palette (OKLCH Tokens)
```css
/* Nền tảng màu sắc Canvas & Liquid Glass */
--bg-canvas-light: oklch(0.985 0.005 250);          /* Canvas sáng thanh lịch */
--bg-canvas-dark: oklch(0.12 0.035 264.695);         /* Obsidian sâu thẳm */

/* Thẻ kính mờ (Liquid Glass Scrims) */
--glass-card-light: oklch(1 0 0 / 65%);              /* Kính trắng mờ 65% */
--glass-card-dark: oklch(0.16 0.035 259.21 / 65%);   /* Kính tối mờ 65% */

/* Điểm nhấn thương hiệu (Brand Accent & Glow) */
--accent-emerald: oklch(0.696 0.17 162.48);          /* Xanh ngọc lục bảo (Primary Actions & VietQR) */
--accent-cyan: oklch(0.789 0.154 211.53);            /* Xanh ngọc biển (Ambient Glow & Specular highlights) */
--accent-amber: oklch(0.769 0.188 70.08);            /* Vàng hổ phách (Pro Highlight Badge) */

/* Đường viền phản xạ ánh sáng (Specular Borders) */
--border-specular-light: rgba(255, 255, 255, 0.45);
--border-specular-dark: rgba(255, 255, 255, 0.12);
--shadow-diffuse: 0 20px 50px -12px rgba(0, 0, 0, 0.08);
```

### B. Liquid Glass Surface & Blur Tokens
* **Top Navigation Bar:** `backdrop-blur-2xl bg-white/60 dark:bg-slate-900/60 border-b border-white/20 sticky top-0 z-50`
* **Pricing Cards:** `backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border border-white/30 dark:border-white/10 shadow-xl rounded-2xl`
* **Specular Highlight Inset:** `shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]`
* **VietQR Modal Scrim:** `backdrop-blur-md bg-black/40`

### C. Typography Scale (Tiếng Việt)
* **Font gia đình:** `Inter`, `Plus Jakarta Sans` hoặc `Manrope` (hỗ trợ đầy đủ dấu thanh tiếng Việt không lỗi font).
* **H1 Hero Headline:** `text-4xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white`
* **Hero Subhead:** `text-lg md:text-xl text-slate-600 dark:text-slate-300 font-normal leading-relaxed`
* **Section Heading:** `text-3xl font-semibold tracking-tight`
* **Body Base:** `text-base text-slate-600 dark:text-slate-400 font-normal`
* **Micro / Tag Badges:** `text-xs font-semibold tracking-wide uppercase`

---

## 5.3 Cấu Trúc Khối Giao Diện & Stitch Screen Blueprints

### Blueprint 1: Khối Thanh Điều Hướng (Sticky Header)
```html
<!-- Stitch Blueprint: Header -->
<header class="sticky top-0 z-50 backdrop-blur-2xl bg-white/60 dark:bg-slate-900/60 border-b border-white/20 px-6 py-4">
  <div class="max-w-7xl mx-auto flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">U</div>
      <span class="font-bold text-xl tracking-tight text-slate-900 dark:text-white">Unipost</span>
    </div>
    
    <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
      <a href="#tinh-nang" class="hover:text-emerald-500 transition-colors">Tính năng cốt lõi</a>
      <a href="#giai-phap" class="hover:text-emerald-500 transition-colors">Giải pháp</a>
      <a href="#bang-gia" class="hover:text-emerald-500 transition-colors">Bảng giá dịch vụ</a>
      <a href="/docs" class="hover:text-emerald-500 transition-colors">Tài liệu API</a>
    </nav>

    <div class="flex items-center gap-3">
      <a href="/sign-in" class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900">Đăng nhập</a>
      <a href="#bang-gia" class="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all">Bắt đầu ngay</a>
    </div>
  </div>
</header>
```

### Blueprint 2: Khối Hero & Value Proposition (Hero Section)
```html
<!-- Stitch Blueprint: Hero Section -->
<section class="relative pt-24 pb-20 px-6 overflow-hidden">
  <div class="max-w-5xl mx-auto text-center space-y-6">
    <!-- Tag Pill -->
    <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold backdrop-blur-md">
      <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      Nền tảng Dynamic Metadata & Đa Khách Hàng Thế Hệ Mới
    </div>

    <!-- Tiêu đề chính -->
    <h1 class="text-4xl sm:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
      Quản Trị Dữ Liệu Doanh Nghiệp <br class="hidden sm:block"/>
      <span class="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">Linh Hoạt Như Bảng Tính, Mạnh Mẽ Như SQL</span>
    </h1>

    <!-- Mô tả phụ -->
    <p class="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
      Tự do thiết kế thực thể dữ liệu, biểu mẫu nhập liệu tự sinh và bản đồ liên kết đa chiều. Không cần lập trình viên can thiệp DDL, không cần dừng hệ thống để cập nhật cấu trúc.
    </p>

    <!-- Nhóm nút CTA -->
    <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="#bang-gia" class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-xl shadow-emerald-500/30 hover:scale-[1.02] transition-transform">
        🚀 Bắt đầu miễn phí
      </a>
      <a href="#demo" class="w-full sm:w-auto px-8 py-3.5 rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-white/10 text-slate-800 dark:text-white font-medium hover:bg-white/90 transition-colors shadow-sm">
        🎥 Xem Demo Trực Tiếp
      </a>
    </div>
  </div>
</section>
```

### Blueprint 3: Bảng Giá 3 Gói Thuê Bao (Pricing Section)
```html
<!-- Stitch Blueprint: Pricing Table -->
<section id="bang-gia" class="py-20 px-6 max-w-7xl mx-auto">
  <div class="text-center space-y-3 mb-12">
    <h2 class="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Bảng giá minh bạch - Mở khóa theo nhu cầu</h2>
    <p class="text-slate-600 dark:text-slate-400">Không tính phí theo số lượng dòng dữ liệu. Tính năng được cấp phát động theo gói.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
    
    <!-- 1. GÓI BASIC (MIỄN PHÍ) -->
    <div class="rounded-2xl p-8 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-white/30 dark:border-white/10 shadow-lg flex flex-col justify-between">
      <div class="space-y-4">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Gói Cơ Bản</span>
        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">Basic</h3>
        <div class="flex items-baseline gap-1 text-slate-900 dark:text-white">
          <span class="text-4xl font-extrabold">Miễn phí</span>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-400">Phù hợp cho cá nhân, lập trình viên trải nghiệm mô hình dữ liệu động.</p>
        
        <ul class="pt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <li class="flex items-center gap-2.5">✓ <strong>1 User</strong> duy nhất</li>
          <li class="flex items-center gap-2.5">✓ <strong>Không giới hạn bản ghi</strong> dữ liệu</li>
          <li class="flex items-center gap-2.5">✓ Data Explorer & Biểu mẫu tự sinh</li>
          <li class="flex items-center gap-2.5 text-slate-400">✗ Tính năng mở rộng nâng cao</li>
        </ul>
      </div>
      <button class="mt-8 w-full py-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 font-medium text-slate-900 dark:text-white transition-colors">
        Bắt đầu ngay
      </button>
    </div>

    <!-- 2. GÓI PRO (199K/THÁNG) [FEATURED] -->
    <div class="relative rounded-2xl p-8 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/10 flex flex-col justify-between">
      <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold tracking-wide uppercase shadow-md">
        ⭐ Phổ biến nhất
      </div>
      <div class="space-y-4">
        <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Gói Chuyên Nghiệp</span>
        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">Pro</h3>
        <div class="flex items-baseline gap-1 text-slate-900 dark:text-white">
          <span class="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">199,000 đ</span>
          <span class="text-sm text-slate-500">/ tháng</span>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-400">Giải pháp hoàn hảo cho doanh nghiệp vừa và nhỏ vận hành chuyên sâu.</p>
        
        <ul class="pt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <li class="flex items-center gap-2.5">✓ Lên đến <strong>5 Users</strong> cộng tác</li>
          <li class="flex items-center gap-2.5">✓ <strong>Không giới hạn bản ghi</strong> dữ liệu</li>
          <li class="flex items-center gap-2.5">✓ Mở khóa các tính năng nghiệp vụ nâng cao</li>
          <li class="flex items-center gap-2.5">✓ Thanh toán nhanh tức thì qua <strong>payOS VietQR</strong></li>
        </ul>
      </div>
      <button class="mt-8 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:scale-[1.02] transition-transform">
        ⚡ Nâng cấp gói Pro (VietQR)
      </button>
    </div>

    <!-- 3. GÓI PRO MAX (499K/THÁNG) -->
    <div class="rounded-2xl p-8 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-white/30 dark:border-white/10 shadow-lg flex flex-col justify-between">
      <div class="space-y-4">
        <span class="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Gói Doanh Nghiệp</span>
        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">Pro Max</h3>
        <div class="flex items-baseline gap-1 text-slate-900 dark:text-white">
          <span class="text-4xl font-extrabold text-cyan-600 dark:text-cyan-400">499,000 đ</span>
          <span class="text-sm text-slate-500">/ tháng</span>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-400">Sức mạnh tối đa cho tổ chức quy mô lớn với toàn quyền kiểm soát.</p>
        
        <ul class="pt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <li class="flex items-center gap-2.5">✓ <strong>Không giới hạn Users</strong></li>
          <li class="flex items-center gap-2.5">✓ <strong>Không giới hạn bản ghi</strong> dữ liệu</li>
          <li class="flex items-center gap-2.5">✓ Toàn quyền mọi tính năng nền tảng</li>
          <li class="flex items-center gap-2.5">✓ Tích hợp <strong>AI Agent MCP Server</strong> & Streaming S3</li>
        </ul>
      </div>
      <button class="mt-8 w-full py-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-semibold transition-colors">
        Trải nghiệm Pro Max
      </button>
    </div>

  </div>
</section>
```

### Blueprint 4: Hộp Thoại Thanh Toán VietQR payOS (Modal Dialog)
```html
<!-- Stitch Blueprint: payOS VietQR Modal -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
  <div class="w-full max-w-md rounded-3xl backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/40 shadow-2xl p-6 sm:p-8 space-y-6">
    <div class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-4">
      <div>
        <h3 class="font-bold text-lg text-slate-900 dark:text-white">Nâng cấp gói Pro</h3>
        <p class="text-xs text-slate-500">Thanh toán tự động qua cổng payOS VietQR</p>
      </div>
      <button class="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
    </div>

    <!-- Khung QR Code -->
    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-inner flex flex-col items-center justify-center space-y-3">
      <div class="w-52 h-52 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300">
        <!-- SVG hoặc Dynamic QR Image từ payOS -->
        <span class="text-xs text-slate-400 font-medium">[ Dynamic VietQR Code ]</span>
      </div>
      <div class="text-center space-y-1">
        <p class="text-xs font-semibold text-slate-500">Số tiền thanh toán</p>
        <p class="text-2xl font-black text-emerald-600">199,000 đ</p>
      </div>
    </div>

    <!-- Thông tin chuyển khoản -->
    <div class="text-xs space-y-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/50">
      <div class="flex justify-between"><span class="text-slate-500">Ngân hàng:</span><span class="font-semibold text-slate-800 dark:text-slate-200">MB Bank (Quân Đội)</span></div>
      <div class="flex justify-between"><span class="text-slate-500">Nội dung chuyển:</span><span class="font-mono font-bold text-emerald-600">UNIPOST PRO 89201</span></div>
    </div>

    <!-- Nút xác nhận -->
    <button class="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2">
      <span>Đang chờ chuyển khoản...</span>
    </button>
  </div>
</div>
```

---

## 5.4 Google Stitch Feed Template (Dành cho việc Import trực tiếp)

Khi nạp tài liệu này vào Google Stitch hoặc các AI coding assistant để sinh toàn bộ màn hình, bạn có thể sử dụng mẫu câu lệnh (Stitch Prompt) sau:

```text
Build a responsive modern SaaS Landing Page in Vietnamese for "Unipost", adhering strictly to the DESIGN.md specifications:
- Language: Vietnamese (Tiếng Việt) as primary language.
- Visual Language: Liquid Glass design tokens (frosted glass blur, specular 1px white borders, subtle ambient emerald/cyan mesh glows).
- Key Sections:
  1. Sticky navigation header with logo and sign-in button.
  2. Hero section with headline "Quản Trị Dữ Liệu Doanh Nghiệp - Linh Hoạt Như Bảng Tính, Mạnh Mẽ Như SQL", subhead, and dual CTA buttons.
  3. Interactive feature preview canvas with dynamic forms and graph tabs.
  4. Pricing table with 3 tiers: Basic (Miễn phí), Pro (199,000 đ/tháng), Pro Max (499,000 đ/tháng).
  5. payOS VietQR modal popup dialog for instant domestic checkout.
Ensure high contrast WCAG AA readability and clean Tailwind CSS v4 class structure.
```
