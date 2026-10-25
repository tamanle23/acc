# [042] Configurable Pause Between Slides (Khoảng lặng giữa các cảnh)

## 1. Context & Problem Statement
Người dùng muốn thêm tính năng "tạo khoảng lặng giữa các slide" để video có nhịp độ chậm rãi hơn hoặc tạo cảm xúc trước khi chuyển qua cảnh tiếp theo. Thời gian khoảng lặng phải có khả năng cấu hình được cả ở phạm vi toàn cục (áp dụng cho mọi slide) và phạm vi từng slide (ghi đè tuỳ chỉnh).

## 2. Implementation Plan
- **Kiến trúc**: Dựa vào `paddingTime` trong hàm `renderSingleSlide` (thuộc file `src/renderer.ts`). Khi thêm thời gian vào `paddingTime`, video sẽ tự động kéo dài hiển thị khung hình cuối cùng kèm với âm thanh yên lặng (`apad`).
- **Cấu hình**:
  - Bổ sung `pauseBetweenSlides` vào `StorySettings` để cấu hình tổng thể.
  - Bổ sung `pauseAfter` vào `SlideConfig` để ghi đè cho slide riêng lẻ.
- **Tuân thủ 7-Point Synchronization Rule**:
  1. Thêm các interface vào `src/types.ts`.
  2. Cập nhật `schema/story-config.schema.json`.
  3. Cập nhật đặc tả JSON Schema trong `docs/STORY_CONFIG_SPEC.md`.
  4. Cập nhật FFmpeg Renderer (`src/renderer.ts`) để tính tổng padding từ Transition `tDur` + `pauseTime`.
  5. Cập nhật `docs/history/README.md`.

## 3. Changes Made
- `src/types.ts`: Thêm `pauseBetweenSlides?: number` vào `StorySettings` và `ResolvedStorySettings`. Thêm `pauseAfter?: number` vào `SlideConfig`.
- `schema/story-config.schema.json`: Thêm definitions và descriptions cho hai trường vừa được khai báo.
- `src/renderer.ts`: Cập nhật block tính toán `paddingTime` trong `renderStoryVideo`. Bổ sung biến `pauseTime` và cộng vào `paddingTime` để FFmpeg padding ảnh tĩnh và im lặng tự động.
- Tài liệu: Đã thêm các docs vào bảng trong file `STORY_CONFIG_SPEC.md`.

## 4. Verification & Walkthrough
- Lệnh `-af apad` của FFmpeg kết hợp lệnh loop ảnh đầu vào sẽ giúp tự động lấp đầy phần khoảng lặng đã thiết lập.
- Khi transition xfade chạy, `currentOffset` sẽ vẫn overlap đúng thời gian `duration + pauseTime`, tạo ra chính xác số giây nghỉ trước khi clip kết tiếp phai dần vào.
