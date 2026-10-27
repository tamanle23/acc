# [001] Khởi Tạo Khung Dự Án Visual Storytelling Generator

## 1. Bối cảnh & Yêu cầu
- Xây dựng hệ thống tự động tạo video storytelling từ danh sách ảnh tĩnh và âm thanh voiceover (TTS / VieNeu).
- Hỗ trợ hiển thị phụ đề karaoke/word-level linh hoạt.
- Sử dụng runtime Bun và native FFmpeg.

## 2. Kế hoạch triển khai
- Thiết lập `package.json`, cài đặt `@huggingface/transformers`, `fluent-ffmpeg`, `wavefile`.
- Định nghĩa cấu trúc `story-config.json` và types tương ứng (`src/types.ts`).
- Xây dựng generator sinh file `.ass` phụ đề từ mốc timestamps (`src/subtitles.ts`).
- Xây dựng renderer xử lý từng slide và ghép nối thành video (`src/renderer.ts`).
- Tạo CLI (`cli.ts`) và thư mục mẫu (`sample-story`).

## 3. Các thay đổi đã thực hiện
- Tạo `src/types.ts`, `src/subtitles.ts`, `src/renderer.ts`, `cli.ts`, `sample-story/`.

## 4. Kiểm thử & Xác nhận
- Chạy `bun run cli.ts ./sample-story` xuất thành công `output.mp4` với đầy đủ phụ đề.
