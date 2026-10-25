# Design Specification: Mobile UI (`mobile-ui`)
> **Target Tool / Feed:** Google Stitch AI Design Canvas & Antigravity Agents  
> **Aesthetic System:** Liquid Glass Mobile Design Language  
> **Platform:** iOS & Android Native (Expo SDK 57 / React Native 0.86 / React 19)  
> **Status:** Living Document & Foundation Specification

---

## 1. System Identity & Vision

### 1.1 Product Purpose & Persona
`mobile-ui` is the mobile companion client for the acc ecosystem. Designed for on-the-go professionals, community creators, and remote operators who expect high-fidelity visual appeal, fluid gestural navigation, and instantaneous responsiveness.

### 1.2 Aesthetic Core: Liquid Glass Native
Mobile Liquid Glass leverages hardware-accelerated blur surfaces and optical depth:
- **Optical Depth:** `expo-blur` `BlurView` (`tint="light" | "dark"`, intensity `50` to `90`) producing tactile frosted scrims.
- **Specular Diagonal Highlights:** `expo-linear-gradient` multi-stop specular overlays simulating angled ambient light reflection.
- **Glass / Solid Adaptability:** Toggleable Liquid Glass engine (`useSettingsStore`) that falls back gracefully to solid opaque surfaces (`#F2F2F7` / `#121212`) for low-power or accessibility preferences.
- **Floating Ergonomics:** Floating tab bars and headers suspended above scrolling timeline content.

---

## 2. Google Stitch Portable Design Tokens

Google Stitch ingests these design tokens when generating mobile screens, wireframes, and prototypes.

### 2.1 Color Tokens & Native Surfaces

```typescript
export const mobileTokens = {
  light: {
    background: '#FFFFFF',
    text: '#1C1C1E',
    textSecondary: '#8E8E93',
    glassBackground: 'rgba(255, 255, 255, 0.75)',
    glassBorder: 'rgba(0, 0, 0, 0.08)',
    glassHighlight: 'rgba(255, 255, 255, 0.90)',
    glassShine: ['rgba(255, 255, 255, 0.50)', 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.00)'],
    tint: '#007AFF',
    tabBarBackground: 'rgba(255, 255, 255, 0.82)',
    solidFallback: '#F2F2F7',
    solidCardFallback: '#FFFFFF',
    solidBorder: 'rgba(0, 0, 0, 0.12)',
  },
  dark: {
    background: '#000000',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    glassBackground: 'rgba(30, 30, 35, 0.65)',
    glassBorder: 'rgba(255, 255, 255, 0.18)',
    glassHighlight: 'rgba(255, 255, 255, 0.30)',
    glassShine: ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.00)'],
    tint: '#0A84FF',
    tabBarBackground: 'rgba(28, 28, 30, 0.75)',
    solidFallback: '#121212',
    solidCardFallback: '#1C1C1E',
    solidBorder: 'rgba(255, 255, 255, 0.12)',
  },
};
```

### 2.2 Glass Depth & Blur Metrics
- **Floating Tab Bar Blur:** Intensity `90` (Light) / `60` (Dark), `tint="light"` / `tint="dark"`.
- **Header Scrim Blur:** Intensity `85` (Light) / `50` (Dark).
- **Post Feed Glass Card Blur:** Intensity `70` (Light) / `50` (Dark).
- **Modal Sheet Blur:** Intensity `95` (Light) / `80` (Dark).
- **Specular Border Rim:** `borderWidth: StyleSheet.hairlineWidth` with `glassHighlight` (Light: `#FFFFFF`, Dark: `rgba(255,255,255,0.3)`).

### 2.3 Typography & Metrics
- **Font Stack:** System Sans (San Francisco on iOS, Roboto on Android)
- **Hierarchy:**
  - Screen Header: `22px` / `fontWeight: '700'`
  - Card Author Name: `16px` / `fontWeight: '600'`
  - Body Post Text: `15px` / `lineHeight: 21px` / `fontWeight: '400'`
  - Meta & Timestamps: `13px` / `fontWeight: '400'` / `color: textSecondary`
  - Button Text: `16px` / `fontWeight: '600'`

### 2.4 Corner Radii & Elevation
- **Cards (`GlassCard`):** `borderRadius: 20`
- **Buttons (`GlassButton`):** `borderRadius: 14`
- **Avatars:** `borderRadius: 24` (Circular, `width: 48, height: 48`)
- **Pill Badges:** `borderRadius: 9999`
- **Shadows (iOS):**
  - Card: `shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12`
  - Floating Tab Bar: `shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 10`
- **Elevation (Android):** `elevation: 6` to `elevation: 10`

---

## 3. Core Component Library Specifications

### 3.1 `LiquidGlassView`
- **Role:** Foundational container for all translucent native surfaces.
- **Composition:** Combines `BlurView` from `expo-blur` with an absolute positioned `LinearGradient` diagonal specular highlight rim.
- **Props:** `intensity`, `tint`, `fallbackColor`, `borderRadius`, `showSpecular`.

### 3.2 `GlassCard`
- **Role:** Elevated content container for feed items and profile summaries.
- **Structure:**
  - Header: Author avatar + Display name + Username handle + Timestamp + More actions menu button.
  - Body: Post content text with auto-link detection.
  - Media: Optional full-width rounded image container (`height: 220`, `borderRadius: 14`).
  - Action Footer: Like button (with heart animation), comment count, share button.

### 3.3 `GlassTabBar` (Floating Navigation)
- **Role:** Floating bottom tab bar positioned over content.
- **Positioning:** `position: 'absolute', bottom: 0, left: 0, right: 0`.
- **Height Calculation:** `56 + Math.max(insets.bottom, 16)`.
- **Items:** Rendered with `StreamlineColorIcon` (32px size, active tint highlight).

### 3.4 `GlassButton`
- **Role:** Primary and secondary mobile tactile action triggers.
- **Touch Feedback:** `activeOpacity={0.7}`, subtle scale down, haptic tick on press.

---

## 4. Google Stitch Prompting Blueprint (Zoom-Out-Zoom-In)

Use this prompt format when generating mobile screens with **Google Stitch**:

```markdown
### STITCH GENERATION TEMPLATE: `mobile-ui`

[1. CONTEXT]
Design an iOS/Android native mobile application screen for "mobile-ui".
Audience: Mobile-first power users, social collaborators.
Vibe: Clean, ultra-slick Apple-inspired "Liquid Glass" mobile aesthetic.

[2. PLATFORM CONSTRAINTS]
Mobile portrait canvas (390x844 iPhone 15 Pro resolution).
Framework: React Native / Expo.
Strict Rule: Use floating translucent layers with visible specular glass highlights. Content scrolls beneath the frosted header and bottom tab bar.

[3. LAYOUT & GLASS TOKENS]
- Canvas Background: Pure white (#FFFFFF) in light mode or pure black (#000000) in dark mode.
- Floating Glass Header: Translucent blurred bar (85% intensity) with hairline bottom highlight.
- Floating Tab Bar: Suspended frosted pill navigation bar at bottom (82% opacity, 90% blur intensity).
- Cards: Rounded-2xl (20px radius) glass cards with subtle border highlight and soft elevation.
- Accent Tint: iOS system blue (#007AFF) for active icons and primary buttons.

[4. SCREEN SPECIFICS: <INSERT SCREEN NAME>]
- Top: Transparent navigation header with screen title.
- Content: FlatList feed of frosted GlassCards with user avatars, post content, and engagement metrics.
- Floating Action / CTA: Tactile glass button with subtle diagonal gradient shine.
- Tab Navigation: 3 bottom icons (Home, Create Post, Profile).
```

---

## 5. Touch Ergonomics & Safe Area Guidelines

- **Thumb Zone Compliance:** Primary interactive elements (tab switches, like actions, FAB) placed within bottom 45% of screen height.
- **Minimum Tap Targets:** Minimum `44x44 pt` touch target size for all interactive icons and buttons (`hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}`).
- **Safe Area Insets:** All screens MUST consume `useSafeAreaInsets()` from `react-native-safe-area-context` to prevent content occlusion under device notches and home indicators.
