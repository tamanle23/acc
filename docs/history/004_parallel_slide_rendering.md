# [004] Tối Ưu Hóa Render Song Song Các Slide (Parallel Slide Processing)

## 1. Bối cảnh & Yêu cầu
- Khi render video 4K nhiều phân cảnh (ví dụ 9 slide, thời lượng 2 phút 39 giây), quy trình render tuần tự từng slide trước đây mất ~115s do CPU libass subtitle filter chạy đơn luồng và GPU NVENC chưa được khai thác tối đa công suất.
- Người dùng yêu cầu tối ưu hóa CLI để hỗ trợ Render song song các Slides (Parallel Processing) thông qua cấu hình `story-config.json`.
- Thiết lập quy tắc lưu trữ lịch sử đánh số tuần tự cho mọi thay đổi (Implementation Plan & Walkthrough).

## 2. Kế hoạch triển khai & 6-Point Synchronization
- **Types (`src/types.ts`)**: Bổ sung `concurrency?: number | 'auto'` vào `StorySettings` và `ResolvedStorySettings`.
- **Specification Doc (`docs/STORY_CONFIG_SPEC.md`)**: Thêm `concurrency` vào mục 3C (Container, GPU Acceleration & Parallel Processing).
- **Platforms (`src/platforms.ts`)**: Thêm `concurrency: 'auto'` cho 10 platform presets và xây dựng thuật toán dynamic worker resolution (`isGpu ? min(cpus, 6) : min(cpus/2, 4)`).
- **Renderer (`src/renderer.ts`)**: Cài đặt Promise Worker Pool (`runConcurrentPool`) không cần thư viện ngoài, xử lý đồng thời nhiều slide và log tiến trình song song.
- **Main CLI (`cli.ts`)**: Hiển thị `Parallel Workers: X` trên banner tổng quan.
- **Auto-Config (`auto-config.ts`)**: Tự động sinh `concurrency: "auto"` cho các file config mới.
- **Sample Story (`sample-story/story-config.json`)**: Bổ sung `concurrency: "auto"`.
- **README (`README.md`)**: Cập nhật Cheat Sheet và mẫu JSON.

## 3. Các thay đổi đã thực hiện
- `src/types.ts`: Cập nhật interface `StorySettings`, `ResolvedStorySettings`.
- `src/platforms.ts`: Cập nhật `PLATFORM_PRESETS`, `resolveStorySettings`.
- `src/renderer.ts`: Thêm `runConcurrentPool`, nâng cấp `renderStoryVideo`.
- `cli.ts`: Log `Parallel Workers`.
- `auto-config.ts`: Thêm `concurrency: "auto"`.
- `docs/STORY_CONFIG_SPEC.md`: Tài liệu hóa `concurrency`.
- `README.md`: Cập nhật Cheat Sheet.
- `AGENTS.md` & `.agents/rules/history-archival.md`: Tạo quy tắc lưu lịch sử đánh số tuần tự.

## 4. Kiểm thử & Xác nhận
- Chạy `bun run cli.ts ./sample-story`:
  ```text
  === Storyteller Video Generator ===
  Slides: 2
  Platform: youtube
  Resolution: 1920x1080 @ 30fps
  Video: codec=h264, crf/cq=20, preset=p4, pix_fmt=yuv420p
  Audio: codec=aac, bitrate=192k
  Hardware Acceleration: auto
  Parallel Workers: 6
  Container: mp4 (FastStart=true)
  Output: C:\Users\Admin\workspace\git\visual-story-telling-generator\sample-story\output.mp4

  🚀 Starting slide rendering (2 slides, parallel workers: 2)...

  ▶ [Slide 1/2] Rendering (duration: 2.00s)...
  ▶ [Slide 2/2] Rendering (duration: 2.50s)...
  ✓ [Slide 1/2] Completed in 0.4s
  ✓ [Slide 2/2] Completed in 0.4s

  Concatenating slides into final video...

  Video rendering successfully completed in 0.5s!
  ```
- Tốc độ render được cải thiện rõ rệt:
  - **Sample Story (2 slide 1080p)**: Giảm từ 0.9s xuống **0.5s**.
  - **Thực tế User Benchmark (9 slide 4K 60fps, thời lượng 2 phút 39 giây)**: Rút ngắn thời gian từ **114.9s** xuống còn **38.6s** (tăng tốc gần **3x**).
