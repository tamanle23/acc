# 🏛️ History Log: [064] Phase 3 - FFI TimeBase Normalization, Audio Timestamp Rescaling & Zero-Copy Audio Remuxing

## 1. Mục tiêu (Objective)
Giải quyết triệt để lỗi xung đột timebase `First input link main timebase do not match second input link` trong filtergraph `xfade`/`acrossfade`, tích hợp remux audio đa kênh vào `FFIVideoEncoder`, chuẩn hóa `codec_tag`, và tự động đồng bộ timestamp `pts`/`dts` âm thanh qua `av_rescale_q`.

---

## 2. Các thay đổi kỹ thuật chính (Key Technical Changes)

### 2.1. Chuẩn hóa TimeBase FilterGraph
- **File**: `src/renderer.ts: concatenateWithTransitions`
- Thêm các node tiền xử lý `settb=AVTB` (`1/1,000,000`) cho toàn bộ luồng video ngõ vào trước khi cấp cho bộ chuyển cảnh `xfade`.
- Thêm node `aresample=44100:async=1` cho toàn bộ luồng audio ngõ vào trước khi cấp cho `acrossfade`, triệt tiêu hoàn toàn sự chênh lệch tần số lấy mẫu giữa các phân đoạn.

### 2.2. Khắc phục lỗi tương thích container MP4 & Timestamp Rescaling
- **File**: `src/core/ffmpeg-ffi/FFIVideoEncoder.ts`
- **Audio Timestamp Rescaling**: Ghi nhận `inAudioTimeBase` từ `AVStream.time_base` ngõ vào (offset 32 trong `AVStream`), sau đó dùng `av_rescale_q` để tính toán lại `pts`, `dts`, và `duration` sang `outAudioTimeBase` của container MP4 (thường là `1/44100`). Giới hạn `scaledPts <= maxPts` theo độ dài khung hình video thực tế.
- **Chuẩn hóa Codec Tag**: Đặt `codec_tag = 0` trên `AVCodecParameters` sau khi sao chép từ stream audio ngõ vào để ngăn chặn lỗi `Tag incompatible with output codec` khi mux audio vào MP4.

### 2.3. Thay thế Silent WAV bằng Silent MP3 Buffer
- **File**: `src/renderer.ts`
- Viết hàm `createSilentMp3Buffer(seconds)` tạo chuỗi MPEG-1 Layer 3 audio frames hợp lệ (sync word `0xFFFB9004`, 417 bytes/frame, 1152 samples/frame tại 44.1kHz).
- Thay thế hoàn toàn file tạm `silent_fallback.wav` bằng `_fallback_silent.mp3`, đảm bảo tính tương thích tuyệt đối 100% với MP4 muxer mà không cần giải mã/mã hóa lại.

---

## 3. Kết quả kiểm thử (Verification)
- Chạy `bun run cli.ts ./sample-story`:
  - Scene 1 (`frame_breaker`), Scene 2 (`volumetric_sandwich`), và Scene 3 (`depth_map_3d`) đều hoàn thành render trực tiếp qua native FFI `FFIVideoEncoder` (0 lần fallback 2D).
  - Scene 4 (`b-roll-nature.mp4`) render mượt mà.
  - Video hoàn chỉnh `output/Dinosaur_Story_26.mp4` được xuất ra trong 10.4 giây với độ dài chuẩn xác 9.54s, âm thanh BGM, phụ đề và chuyển cảnh đồng bộ tuyệt đối.
