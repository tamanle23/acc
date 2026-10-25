# [002] 10 Caption Presets & Ma Trận Cấu Hình Platform Defaults

## 1. Bối cảnh & Yêu cầu
- Mở rộng hệ thống để hỗ trợ 10 phong cách phụ đề đa dạng (`tiktok`, `classic`, `cinematic`, `vlog`, `neon-glow`, `bold-retro`, `minimal-clean`, `karaoke`, `news-banner`, `retro-typewriter`).
- Tích hợp ma trận cấu hình mặc định tối ưu theo từng nền tảng (`tiktok`, `youtube`, `youtube-4k`, `facebook`, `instagram`, `web`, `mobile`).
- Hỗ trợ Hardsub (`burn`) và Softsub (`soft` track trong MKV/MP4).
- Hỗ trợ tăng tốc GPU phần cứng NVIDIA NVENC (`h264_nvenc`, `hevc_nvenc`).
- Thiết lập quy tắc bắt buộc 6-Point Synchronization Protocol.

## 2. Kế hoạch triển khai
- Đồng bộ 6 điểm: Types (`src/types.ts`), Spec Doc (`docs/STORY_CONFIG_SPEC.md`), Styles (`src/styles.ts`), Platforms (`src/platforms.ts`), Auto-Config (`auto-config.ts`), CLI (`cli.ts`), Sample Story, và README.

## 3. Các thay đổi đã thực hiện
- `src/styles.ts`: 10 bộ style ASS hoàn chỉnh với màu sắc, font, viền, bóng, hộp mờ và lề an toàn.
- `src/platforms.ts`: Định nghĩa ma trận tham số resolution, fps, codec, crf, fastStart cho 10 nền tảng.
- `auto-config.ts`: Interactive CLI menu chọn platform preset, caption preset, subtitle mode.
- `docs/STORY_CONFIG_SPEC.md`: Bảng đặc tả chi tiết 10 preset và toàn bộ tùy chọn.

## 4. Kiểm thử & Xác nhận
- Chạy render `sample-story` thành công chỉ trong 0.9s với GPU acceleration NVENC.
