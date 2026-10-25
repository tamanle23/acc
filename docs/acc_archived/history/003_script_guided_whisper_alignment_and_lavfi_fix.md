# [003] Script-Guided Whisper Alignment & Fix Lỗi Lavfi Demuxer

## 1. Bối cảnh & Yêu cầu
- Khi Whisper AI nhận diện tự động, tiếng Việt có thể bị sai chính tả hoặc lặp từ ảo (hallucination). Người dùng cần căn chỉnh timestamps theo đúng chữ gốc của kịch bản (`.txt`/`.json`).
- Thư mục media có thể chia thành `./voiceover` và `./images` hoặc dùng đường dẫn tuyệt đối.
- Lỗi `error: Input format lavfi is not available` xảy ra khi thiếu file ảnh hoặc audio làm fluent-ffmpeg kích hoạt fallback sai format demuxer.

## 2. Kế hoạch triển khai
- `src/whisper.ts`: Thêm hàm `alignScriptWithTimestamps` kết hợp văn bản gốc với timestamps nhận diện từ âm thanh.
- `auto-config.ts`: Tự động quét và nạp file kịch bản theo thứ tự ưu tiên (file từng slide `01.txt`, file toàn cục `script.txt`/`script.json`).
- `cli.ts`: Bổ sung `resolveMediaPath` tìm kiếm thông minh qua các thư mục con media.
- `src/renderer.ts`: Thay thế `lavfi` bằng `1x1 Black PNG Buffer` và `Silent WAV Buffer` tự sinh trực tiếp trong bộ nhớ.

## 3. Các thay đổi đã thực hiện
- Cập nhật `src/whisper.ts`, `auto-config.ts`, `cli.ts`, `src/renderer.ts`, `docs/STORY_CONFIG_SPEC.md`, `README.md`, `sample-story`.

## 4. Kiểm thử & Xác nhận
- Render test với file giả lập nonexistent slide: Pass hoàn toàn không còn lỗi `lavfi`.
- Render `sample-story` với file script gốc: Đạt tốc độ 0.9s.
