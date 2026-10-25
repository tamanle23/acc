# 137 - Fix FFI Video Encoder Heap Cloning & Multi-Worker Segmentation Fault

**Ngày hoàn thành**: 2026-10-04  
**Trạng thái**: [x] Hoàn thành  
**Phạm vi**: `packages/core/src/ffmpeg-ffi/FFIVideoEncoder.ts`, `packages/effect-engines/src/subtitles/BoundedAcousticCaptionStrategy.ts`

---

## 1. Problem & Crash Analysis

Khi kết xuất các story có độ phân giải lớn (ví dụ TikTok 1080x1920) với nhiều phân cảnh và 6 luồng worker song song (`workers_spawned(6)`), tiến trình Bun bị crash đột ngột với mã lỗi:
```
Elapsed: 12114ms | RSS: 4.11 GB | Peak: 4.19 GB | Commit: 7.1 GB | Faults: 7128880
panic(thread 23956): Segmentation fault at address 0x2ACB8B60000
oh no: Bun has crashed. This indicates a bug in Bun, not your code.
```

### Nguyên nhân gốc rễ:
1. **Sao chép bộ nhớ 8.3MB liên tục mỗi frame trong `encodeRgbaFrame`**:
   - Khung hình RGBA độ phân giải 1080x1920 có kích thước $1080 \times 1920 \times 4 \approx 8.3\text{ MB}$.
   - Trong `FFIVideoEncoder.ts`, dòng code `const frameBuf = Buffer.from(rgbaBuffer);` tạo bản sao 8.3MB của buffer hình ảnh trên mỗi frame.
   - Khi 6 workers cùng encode ở 30fps (tổng 180 fps), tốc độ cấp phát bộ nhớ rác đạt tới $\approx 1.5\text{ GB/s}$.
   - Sau 12 giây, bộ nhớ RSS vượt ngưỡng 4.19 GB khiến Bun's garbage collector trên Windows bị nghẽn (7.1 triệu page faults).
2. **Cấp phát mảng con trỏ trên JS Nursery Heap truyền vào C FFI**:
   - Các mảng `new BigUint64Array(...)` và `new Int32Array(...)` được tạo trên JavaScript nursery heap mỗi frame và truyền con trỏ tạm vào hàm C `sws_scale`.
   - Dưới áp lực dọn rác cực lớn, Bun GC di dời đối tượng heap (heap compaction) hoặc giải phóng mảng trong khi C `sws_scale` đang đọc, gây Segmentation Fault (`0x2ACB8B60000`).
3. **Phân mảnh cụm từ lặp lại mỗi frame trong `BoundedAcousticCaptionStrategy`**:
   - `groupPhrases` phân tách regex và mảng từ mới trên mỗi frame thay vì lưu cache theo mảng caption của từng cảnh.

---

## 2. Technical Solution

1. **Zero-Copy & Pre-Allocated Native C Memory trong `FFIVideoEncoder.ts`**:
   - Loại bỏ hoàn toàn `Buffer.from(rgbaBuffer)`.
   - Ghi trực tiếp con trỏ vùng nhớ `rgbaBuffer` vào bộ nhớ C cố định đã cấp phát sẵn `this.srcDataC` (`av_malloc(64n)`) và `this.srcStrideC` (`av_malloc(32n)`).
   - Truyền trực tiếp `this.srcDataC` và `this.srcStrideC` vào `FFI.swscale.sws_scale`, triệt tiêu 100% việc cấp phát bộ nhớ trung gian trên JavaScript heap.
2. **WeakMap Cache trong `BoundedAcousticCaptionStrategy.ts`**:
   - Thêm `phraseCache` dạng `WeakMap<CaptionConfig[], Map<number, CaptionConfig[][]>>` để gom nhóm cụm từ đúng 1 lần duy nhất cho mỗi scene, truy xuất O(1) qua hàng nghìn frames.

---

## 3. Verification

- Chạy toàn bộ test suites (`caption-timeline-engine.test.ts`, `whisper-syllable-alignment.test.ts`, `video_scene_captions.test.ts`, `active-word-highlight.test.ts`, `phase6_unified_cli.test.ts`):
  - 25 pass, 0 fail (100% pass trong 2.33s).
