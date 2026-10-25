# 🏛️ History Log: [066] Phase 5 - Route FFmpegExecutor to FFI & 100% Deprecate Process Spawning

## 1. Mục tiêu (Objective)
Hoàn thành giai đoạn cuối cùng (Phase 5) của kế hoạch di trú toàn diện sang Native `bun:ffi`:
- Xóa bỏ 100% lời gọi `Bun.spawn`, `child_process.spawn`, và `child_process.exec` ra khỏi toàn bộ hệ thống xử lý media (`src/`).
- Tích hợp `FFISceneEngine` xử lý cả ảnh 2D và video B-Roll (tự động decode, scale qua `swscale` và encode qua `FFIVideoEncoder`).
- Định tuyến `FFmpegCommand.run()` trong `FFmpegExecutor.ts` sang các FFI engines chuyên biệt (`FFISceneEngine`, `FFIConcatMuxer`, `FFIAudioDSP`).

---

## 2. Các thay đổi kỹ thuật chính (Key Technical Changes)

### 2.1. Xóa bỏ hoàn toàn `Bun.spawn` trong `FFmpegExecutor.ts`
- **File**: `src/core/FFmpegExecutor.ts`
- Xóa bỏ hoàn toàn lời gọi `Bun.spawn({ cmd: [ffmpegPath, ...args] })`.
- Chuyển hướng `FFmpegCommand.run()` tự động phân tích cấu hình ngữ cảnh và gọi trực tiếp các engine FFI:
  - Ghép nối video / Chuyển cảnh $\rightarrow$ `FFIConcatMuxer.concatenate()`.
  - Phân đoạn đơn lẻ (Image/Video) $\rightarrow$ `FFISceneEngine.renderScene()`.
  - Mix nhạc nền / Âm thanh $\rightarrow$ `FFIAudioDSP`.

### 2.2. Xây dựng Module `FFISceneEngine.ts`
- **File**: `src/core/ffmpeg-ffi/FFISceneEngine.ts`
- **Render Image Scene**: Sử dụng `@napi-rs/canvas` vẽ ảnh gốc căn giữa letterbox/pillarbox và stream trực tiếp mảng RGBA vào `FFIVideoEncoder` trong RAM.
- **Render Video Scene (B-Roll)**: Mở file video đầu vào qua `avformat`, giải mã từng video frame bằng `avcodec_receive_frame`, đưa qua `sws_scale` để upscale/downscale tự động về kích thước project (1920x1080), và đẩy vào `FFIVideoEncoder.encodeRawFrame()`. Đảm bảo 100% video output đồng nhất về chuẩn NAL, timebase 90kHz và kích thước.

### 2.3. Bổ sung `encodeRawFrame` trong `FFIVideoEncoder.ts`
- **File**: `src/core/ffmpeg-ffi/FFIVideoEncoder.ts`
- Cung cấp phương thức `encodeRawFrame(srcFrame, srcW, srcH, srcFmt)`:
  - Khởi tạo `swscale` context động theo định dạng pixel và kích thước của frame nguồn.
  - Scale trực tiếp từ YUV/RGB của decoder sang YUV420P của encoder mà không cần thông qua canvas trung gian.

### 2.4. Loại bỏ `child_process.exec` trong Audio Engines
- **File**: `src/core/AudioNormalizer.ts` & `src/sound-effects/engine.ts`
- Thay thế các đoạn code gọi `execAsync` bằng `FFmpegCommand`.

---

## 3. Kết quả kiểm thử (Verification)
- Kiểm tra toàn bộ mã nguồn `src/`: Không còn bất kỳ lệnh `spawn`, `Bun.spawn`, hay `exec` nào (0 occurrences).
- Chạy `bun run cli.ts ./sample-story`:
  - 4 scenes được render song song với hiệu năng cực cao: Scene 4 hoàn thành trong 0.3s, Scene 2 trong 3.6s, Scene 3 trong 5.3s, Scene 1 trong 9.0s.
  - Video hoàn chỉnh `output/Dinosaur_Story_29.mp4` được xuất ra trong 9.1 giây với độ dài 18.77s.
  - Chất lượng hình ảnh 1080p đồng bộ tuyệt đối giữa video B-roll, 3D Depth, phụ đề karaoke và nhạc nền BGM.
