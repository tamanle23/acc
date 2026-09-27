# [002] Tích hợp hệ thống Local Text-to-Speech (VieNeu-TTS)

## 1. Context & Problem Statement
Hệ thống trước đây chỉ cho phép sử dụng audio có sẵn thông qua thuộc tính `audio` trong `slides`. Người dùng yêu cầu tích hợp khả năng sinh âm thanh trực tiếp từ văn bản bằng thư viện Local AI (VieNeu-TTS v3 Turbo), giúp rút ngắn quá trình tạo nội dung mà không phụ thuộc vào API bên ngoài. Yêu cầu thuộc tính `text` trong slide, nhưng nếu có `audio` thì sẽ được ưu tiên.

## 2. Implementation Plan
- **Kiến trúc**: Sử dụng `InferenceBackend.ts` làm hệ thống điều phối, và viết một Python daemon worker (`vieneu_worker.py`) lắng nghe JSON qua stdin/stdout để sinh TTS theo yêu cầu, tạo file `.wav` và trả về đường dẫn file.
- **Tuân thủ 7-Point Synchronization Rule**:
  1. Thêm type `TTSSettings` và thuộc tính `text` vào `SlideConfig` trong `src/types.ts`.
  2. Cập nhật `schema/story-config.schema.json` hỗ trợ validation `text` và `tts`.
  3. Cập nhật đặc tả JSON Schema trong `docs/STORY_CONFIG_SPEC.md`.
  4. Cập nhật `auto-config.ts` để hiển thị menu hỏi người dùng cấu hình TTS và tự động sinh TTS, trích xuất Whisper, lưu vào thuộc tính `audio` của `slides`.
  5. Sửa đổi `sample-story/story-config.json` để bao gồm 1 slide làm ví dụ dùng text.
  6. Cập nhật `README.md` với thông tin hướng dẫn và cài đặt thư viện python.

## 3. Changes Made
- `src/types.ts`: Sửa `audio` thành optional (`audio?`), thêm `text?`. Thêm interface `TTSSettings`.
- `schema/story-config.schema.json`: Sử dụng `anyOf` cho phép một slide phải có hoặc `audio`, hoặc `text`.
- `src/core/backend/workers/vieneu_worker.py` (NEW): Daemon Worker cho VieNeu.
- `src/tts.ts` (NEW): Logic tương tác với InferenceBackend.
- `auto-config.ts`: Chuyển logic sinh âm thanh bằng TTS lên Auto Configurator. Khi có text script mà chưa có file audio, auto-config sẽ gọi TTS, nhận file `.wav`, rồi đưa qua Whisper để align và lưu vào JSON ngay.
- `cli.ts`: Đã revert chức năng sinh âm thanh để giữ CLI render sạch và nhanh.
- `sample-story/story-config.json`: Thêm slide 3 với `text`.
- Các file tài liệu: `STORY_CONFIG_SPEC.md`, `README.md`.

## 4. Verification & Walkthrough
- Đã kiểm tra trình bày CLI của `auto-config.ts` có tích hợp menu chọn giọng đọc TTS.
- Đã xác thực daemon worker có cơ chế try-except báo lỗi nếu thư viện `vieneu` hoặc `torchaudio` chưa được cài đặt.
- Backward compatibility: Slide cũ chứa `audio` vẫn chạy bình thường. Fallback đã được duy trì.
