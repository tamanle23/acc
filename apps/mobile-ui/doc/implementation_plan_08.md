# Implementation Plan 08 - Mock Posts for Liquid Glass Demonstration

Create a rich set of realistic mock posts in the Dashboard to test and showcase the Liquid Glass effect, including vibrant imagery, user avatars, varied post lengths, tags, and interactive elements.

## User Review Required

> [!NOTE]
> To truly highlight the frosted glass / liquid glass effect, background contrast and vibrancy are key (blurs are hard to notice on pure flat backgrounds). We can add colorful background accents/orbs and cards with rich media so the blur and glass specular reflections stand out.

## Proposed Changes

### Data & State

#### [NEW] `src/constants/mockData.ts`
- Create a collection of diverse mock posts with avatars, timestamps, varied text content, tags, like/comment metrics, and optional image attachments (via Unsplash / Unsplash Source or royalty-free placeholders).
- Provide authors with names, handles, and avatars.

#### [MODIFY] [usePostStore.ts](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/store/usePostStore.ts)
- Initialize the store with mock posts if no posts are present.
- Provide a `resetFeed()` or `seedPosts()` method to easily restore/reload demo data if needed.

---

### Dashboard & Glass Enhancement

#### [MODIFY] [GlassCard.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/components/GlassCard.tsx)
- Check styling to ensure adequate padding, margin, and border radius.

#### [MODIFY] [DashboardScreen.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/screens/DashboardScreen.tsx)
- Enhance the post card UI inside `DashboardScreen`:
  - Author Avatar with initials or placeholder image.
  - Formatted relative timestamp or date.
  - Post body text and optional media/image preview.
  - Interactive/display social metrics (likes, comments, share buttons).
  - Background decorative vibrant gradient/blobs so that scrolling provides the classic iOS frosted glass distortion/blur effect over colors.

## Verification Plan

### Automated Verification
- Run `pnpm tsc --noEmit` to verify type safety across all modified files.
- Run lint/build checks if available.

### Manual Verification
- Test in Expo / web / simulator.
- Verify that posts render smoothly with rich content.
- Verify that scrolling underneath the header and navigation bar showcases the blur and translucency effects of the liquid glass styling.
