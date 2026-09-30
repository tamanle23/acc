# 🏛️ History Log: [083] Backlog Epic: GPU Acceleration Enhancement Suite

## 1. Mục tiêu (Objective)
Đưa các hạng mục nghiên cứu, tối ưu hóa tăng tốc phần cứng (GPU Acceleration) toàn diện và khắc phục các nút thắt cổ chai CPU vào Backlog theo đúng quy chuẩn quản lý Backlog SOP (`docs/backlogs/009_gpu_acceleration_enhancement_suite.md`).

---

## 2. Chi tiết các hạng mục Backlog [009]

1. **Dynamic Multi-Codec Hardware Acceleration (`hevc_nvenc`, `av1_nvenc`)**:
   - Tự động phát hiện và chuyển đổi sang `hevc_nvenc` (H.265) cho video 4K (`youtube-4k`) nhằm giảm đáng kể bitrate và tối ưu băng thông.
   - Bổ sung `av1_nvenc` cho các dòng GPU NVIDIA RTX 40-series trở lên.

2. **GPU Color Conversion & Zero-Copy VRAM Upload (CUDA / D3D11VA)**:
   - Thay thế `sws_scale` trên CPU bằng cơ chế `AVHWFramesContext` (CUDA / Direct3D 11).
   - Đẩy trực tiếp mảng pixel RGBA từ RAM lên VRAM (`av_hwframe_transfer_data`), thực hiện đổi màu sang NV12 / YUV420P trực tiếp bằng nhân GPU.

3. **GPU-Accelerated Canvas & Subtitle Rasterization**:
   - Khảo sát tích hợp Skia GPU backend (Vulkan, Direct3D 12 hoặc WebGPU) thay thế cho Skia Software CPU rasterizer hiện tại trong `@napi-rs/canvas`.
   - Offload toàn bộ quá trình render chữ phụ đề, karaoke highlights và 3D depth pop-out shader sang GPU.

4. **Cross-Vendor Hardware Acceleration (AMD AMF & Intel QuickSync)**:
   - Mở rộng hỗ trợ phần cứng cho GPU AMD (`h264_amf`, `hevc_amf`) và Intel (`h264_qsv`, `hevc_qsv`).
   - Thiết lập chuỗi fallback tự động: `NVENC` $\rightarrow$ `QSV` $\rightarrow$ `AMF` $\rightarrow$ `Software (libx264/libx265)`.

5. **Hardware Capabilities Probe & Dynamic Worker Throttling**:
   - Thăm dò động số phiên NVENC tối đa được cấp phép bởi driver và dung lượng VRAM thực tế để điều phối số parallel workers tối ưu.

---

## 3. Các thay đổi tài liệu (Documentation Changes)
- **Tạo mới Backlog Item**: [`docs/backlogs/009_gpu_acceleration_enhancement_suite.md`](../../docs/backlogs/009_gpu_acceleration_enhancement_suite.md)
- **Cập nhật Master Backlog Index**: [`docs/backlogs/README.md`](../../docs/backlogs/README.md)
- **Cập nhật Master History Index**: [`docs/history/README.md`](../../docs/history/README.md)
