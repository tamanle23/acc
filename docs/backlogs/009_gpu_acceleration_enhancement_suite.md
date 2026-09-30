# [009] Full GPU Acceleration & Hardware Encoding Enhancement Suite

- **Status:** ⏳ `[ ] Planned`
- **Component:** Core Engine / FFI Video Encoder / Hardware Acceleration
- **Created Date:** 2026-09-30
- **Completed Date:** N/A
- **Linked History:** N/A

---

## 1. Context & Problem Statement
Hiện tại, hệ thống đã ứng dụng GPU Acceleration ở khâu nén video bằng NVIDIA NVENC (`h264_nvenc`) qua Bun FFI, giúp xuất video và livestream RTMP đạt hiệu năng cao.
Tuy nhiên, quy trình xử lý khung hình vẫn mang tính chất lai (Hybrid CPU-GPU):
1. **Khâu vẽ điểm ảnh (Canvas & Subtitles)**: Đang chạy trên CPU thông qua backend Skia Software Rasterizer của `@napi-rs/canvas`.
2. **Khâu đổi hệ màu (Color Space Conversion)**: Đang dùng `sws_scale` (`libswscale`) trên CPU để đổi RGBA sang YUV420P trước khi gửi sang GPU.
3. **Cố định H.264**: Chưa linh hoạt chuyển sang `hevc_nvenc` (H.265) cho video 4K hoặc `av1_nvenc`.
4. **Giới hạn hãng sản xuất**: Chỉ mới hỗ trợ NVIDIA (NVENC), chưa hỗ trợ AMD (AMF) và Intel (QSV).
5. **Quản lý phiên phần cứng**: Cần thăm dò động giới hạn session slot NVENC và VRAM để điều phối số worker tối ưu.

---

## 2. Proposed Design & Implementation Ideas

### 2.1. Dynamic Multi-Codec Hardware Acceleration (`hevc_nvenc`, `av1_nvenc`)
- Cải tiến [`FFIVideoEncoder.ts`](../../packages/core/src/ffmpeg-ffi/FFIVideoEncoder.ts) để tự động chọn codec GPU theo cấu hình `settings.videoCodec`:
  - `h264` $\rightarrow$ `h264_nvenc` (fallback `libx264`)
  - `h265` / `hevc` $\rightarrow$ `hevc_nvenc` (fallback `libx265`) — Tối ưu đặc biệt cho video 4K (`youtube-4k`)
  - `av1` $\rightarrow$ `av1_nvenc` (fallback `libsvtav1`) cho các dòng GPU NVIDIA RTX 40-series / Ada Lovelace trở lên.

### 2.2. GPU Color Conversion & Zero-Copy VRAM Upload (CUDA / D3D11VA)
- Loại bỏ bottleneck `sws_scale` trên CPU:
  - Sử dụng cơ chế hardware frames context (`AVHWFramesContext`) với `AV_PIX_FMT_CUDA` hoặc Direct3D 11 (`AV_PIX_FMT_D3D11`).
  - Đẩy trực tiếp mảng pixel RGBA từ RAM lên VRAM (`av_hwframe_transfer_data`), thực hiện đổi màu sang NV12 / YUV420P trực tiếp bằng nhân CUDA (CUDA color matrix kernel hoặc `scale_cuda` filter).

### 2.3. GPU-Accelerated Canvas & Subtitle Rasterization
- Nghiên cứu giải pháp tăng tốc phần cứng cho khâu vẽ đồ họa:
  - Khảo sát bật GPU context cho Google Skia (Vulkan, Direct3D 12 hoặc OpenGL backend) thay thế cho phần mềm CPU rasterization.
  - Offload toàn bộ quá trình render chữ phụ đề, karaoke word highlights và 3D depth pop-out shader sang GPU.

### 2.4. Cross-Vendor Hardware Acceleration (AMD AMF & Intel QuickSync)
- Mở rộng tầng trừu tượng phần cứng trong `FFIVideoEncoder` và `platforms.ts`:
  - **AMD Radeon**: Hỗ trợ `h264_amf`, `hevc_amf` (Advanced Media Framework).
  - **Intel Arc / Iris Xe / Core iGPU**: Hỗ trợ `h264_qsv`, `hevc_qsv` (Intel QuickSync Video).
  - Chuỗi fallback tự động: `NVENC` $\rightarrow$ `QSV` $\rightarrow$ `AMF` $\rightarrow$ `Software (libx264/libx265)`.

### 2.5. Hardware Capabilities Probe & Dynamic Worker Throttling
- Triển khai `HardwareCapabilitiesProbe`:
  - Kiểm tra số phiên NVENC tối đa được cấp phép bởi driver (ví dụ 3-5 luồng trên card GeForce phổ thông).
  - Theo dõi dung lượng VRAM thực tế để tự động tính toán số lượng worker tối ưu trong `SceneWorkerPool`, tránh tình trạng vượt quá dung lượng VRAM hoặc bị từ chối phiên GPU.

---

## 3. Acceptance Criteria
- [ ] `FFIVideoEncoder` tự động chọn `hevc_nvenc` khi render cấu hình 4K (`youtube-4k` / H.265).
- [ ] Hỗ trợ cấu hình `av1_nvenc` cho phần cứng tương thích.
- [ ] Bổ sung codec phần cứng cho AMD (`h264_amf`) và Intel (`h264_qsv`).
- [ ] Triển khai chuyển đổi hệ màu RGBA $\rightarrow$ NV12/YUV420P bằng GPU (CUDA / D3D11).
- [ ] Khảo sát và tích hợp GPU acceleration cho khâu vẽ đồ họa Canvas.
- [ ] Tự động phát hiện giới hạn phiên GPU và VRAM để điều phối số parallel workers.
