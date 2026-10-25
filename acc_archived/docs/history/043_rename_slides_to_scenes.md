# [043] Rename 'slides' to 'scenes' for expanded media support

## 1. Context & Problem Statement
Người dùng muốn thay đổi thuật ngữ `slides` bằng `scenes` trong toàn bộ dự án và `story-config.json`. Thuật ngữ "slide" có xu hướng ngụ ý là một hình ảnh tĩnh, trong khi dự án hỗ trợ cả video cho mỗi phân đoạn, vì vậy "scene" phản ánh đúng hơn tầm nhìn của sản phẩm.

## 2. Implementation Plan
- **Kiến trúc**:
  - Đổi tên key gốc trong `story-config.json` từ `slides` thành `scenes`.
  - Thay thế toàn bộ các interface liên quan (`SlideConfig` -> `SceneConfig`, `ResolvedSlideConfig` -> `ResolvedSceneConfig`).
  - Hỗ trợ Backward Compatibility: Đảm bảo các cấu hình `story-config.json` cũ vẫn parse được bằng cách tạo fallback `scenes = config.scenes || config.slides`.
- **Tuân thủ 7-Point Synchronization Rule**:
  1. `src/types.ts`: Cập nhật interface `SceneConfig`, deprecate property `slides`.
  2. `schema/story-config.schema.json`: Đổi tên key thành `scenes`, để `slides` thành deprecated fallback.
  3. `docs/STORY_CONFIG_SPEC.md`: Đổi toàn bộ text trong document (slides -> scenes).
  4. `src/renderer.ts`, `src/subtitles.ts`, `cli.ts`: Đổi tên biến (slide -> scene, totalSlides -> totalScenes) và tham chiếu mảng `config.scenes`. Hỗ trợ fallback cho config cũ trong `cli.ts`.
  5. `auto-config.ts`: Thay đổi output sinh ra file json mang key `scenes`.
  6. `sample-story/story-config.json`: Cập nhật file mẫu thay block `"slides"` bằng `"scenes"`, verify bằng cách render.
  7. `docs/history/README.md`: Cập nhật lịch sử thay đổi.

## 3. Changes Made
- `src/types.ts`: Thay đổi interface. Cập nhật `ResolvedStoryConfig.scenes`.
- `cli.ts`: Đổi tên biến, bổ sung logic `const rawScenes = config.scenes || config.slides || [];`.
- `src/renderer.ts`: Đổi tên `renderSingleSlide` -> `renderSingleScene`. Cập nhật các log messages.
- `auto-config.ts`: Push output vào key `scenes` thay vì `slides`. Cập nhật thuật ngữ log.
- `schema/story-config.schema.json`: Đổi gốc object sang scenes.
- `docs/STORY_CONFIG_SPEC.md`: Find and replace (Slides -> Scenes).
- `sample-story/story-config.json`: Đổi sang `scenes`.

## 4. Verification & Walkthrough
- Chạy thử `bun run cli.ts ./sample-story` thành công mỹ mãn.
- Log console giờ hiển thị: `Scenes: 3` thay vì `Slides: 3`.
- Các file ffmpeg ghép nối được sinh ra bình thường, output hoạt động tốt.
