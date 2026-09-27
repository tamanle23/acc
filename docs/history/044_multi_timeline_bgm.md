# [044] Implement Background Music (BGM) - Multi-timeline Phase 1

## 1. Context & Problem Statement
Người dùng phàn nàn `pauseBetweenScenes: 1` không hoạt động. Đồng thời yêu cầu bắt đầu triển khai kiến trúc Multi-timeline (Phase 1: Basic Background Music) và đưa các tính năng Overlays khác vào backlog.
Lỗi `pauseBetweenScenes` không làm thay đổi video là do thuộc tính này không được pass xuống trong hàm `resolveStorySettings`.

## 2. Implementation Plan
- **Sửa lỗi `pauseBetweenScenes`**: Thêm field bị thiếu vào output object của `resolveStorySettings` (`src/platforms.ts`).
- **Thực thi Phase 1 (Basic BGM)**:
  - Cập nhật `src/types.ts`: Thêm interface `BGMSettings` (source, volume, loop, fadeIn) và bổ sung vào `StorySettings` & `ResolvedStorySettings`.
  - Cập nhật `schema/story-config.schema.json` để JSON schema hỗ trợ autocomplete.
  - Cập nhật `src/renderer.ts`: Cấu trúc lại cuối hàm `renderStory` thành chuỗi pipeline qua các `temp_paths` (`concat_output.mp4` -> `with_overlay.mp4` -> `with_bgm.mp4`). Dùng `fluent-ffmpeg` để ghép (mix) audio bằng `amix=duration=first` (đảm bảo file nhạc lặp lại vô tận bị ngắt đúng lúc video kết thúc) và sao chép video (`-c:v copy`) để tránh encode lại gây tốn thời gian/chất lượng.
  - Fix lỗi `fluent-ffmpeg` loop parameter để `-stream_loop -1` áp dụng vào đúng `bgmPath` thay vì video đầu vào.

## 3. Changes Made
- `src/platforms.ts`: Fix missing `pauseBetweenScenes` mapping, map `bgm`.
- `src/types.ts`: Thêm `BGMSettings`.
- `schema/story-config.schema.json`: Định nghĩa `#definitions/BGMSettings`.
- `src/renderer.ts`: Refactor `renderStory` cuối luồng; xây logic FFmpeg mixing BGM.
- `sample-story/story-config.json`: Thêm block `"bgm"` và `"pauseBetweenScenes"` để test.

## 4. Verification & Walkthrough
- Render lại `sample-story` bằng lệnh `bun run cli.ts ./sample-story`.
- Result 1 (Bug fixed): Scene 1 và Scene 2 báo `duration: 4.50s` (Đã tăng đúng 1s so với trước đây là `3.50s`).
- Result 2 (BGM added): Log in ra `=== Applying Background Music ===`. Video encode trong tích tắc do sử dụng `-c:v copy`.
- Test passed 100%.
