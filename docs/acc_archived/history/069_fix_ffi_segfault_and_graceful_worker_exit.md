# 🏛️ History Log: [069] Fix FFI Segmentation Fault & Graceful Worker Thread Shutdown

## 1. Mục tiêu (Objective)
Khắc phục triệt để lỗi crash tiến trình `Bun has crashed. Segmentation fault at address 0x...` phát sinh khi chạy render song song đa luồng qua FFI và Worker Threads.

---

## 2. Phân tích nguyên nhân gốc rễ (Root Cause Analysis)

1. **Lỗi con trỏ tạm thời trong `encodeRawFrame()` (Scene B-Roll)**:
   - Trong `FFIVideoEncoder.ts`, phương thức `encodeRawFrame` tạo các mảng tạm thời `ptr(new Uint8Array(toArrayBuffer(srcFrame, 0, 64)))` và truyền vào `sws_scale`.
   - Các mảng này nằm trên JavaScript Nursery Heap. Khi Garbage Collector chạy giữa các khung hình hoặc khi luồng xử lý scene B-roll (`b-roll-nature.mp4`), con trỏ bộ nhớ bị thu hồi hoặc di chuyển, dẫn đến việc `sws_scale` truy cập vào địa chỉ bộ nhớ không hợp lệ (`0x1CA3E010000`) $\rightarrow$ gây Segmentation Fault (Access Violation).

2. **Lỗi con trỏ tĩnh `srcDataPtr` trong `encodeRgbaFrame()`**:
   - Việc lưu trữ `this.srcDataPtr = ptr(this.srcData.buffer)` từ lúc `initialize()` khiến con trỏ bị lỗi thời (dangling pointer) nếu engine JavaScriptCore của Bun di dời đối tượng TypedArray trong các chu kỳ dọn rác (GC compaction).

3. **Lỗi hủy luồng đột ngột `w.terminate()`**:
   - `node:worker_threads` trong Bun trên Windows kích hoạt panic handler nếu gọi `worker.terminate()` đột ngột trong khi các addon native (N-API Skia Canvas) đang trong tiến trình giải phóng tài nguyên.

---

## 3. Các thay đổi kỹ thuật (Key Technical Fixes)

### 3.1. Sửa lỗi con trỏ trong `FFIVideoEncoder.ts`
- **File**: `src/core/ffmpeg-ffi/FFIVideoEncoder.ts`
- **Trong `encodeRawFrame()`**: Loại bỏ hoàn toàn các mảng `Uint8Array` trung gian. Truyền trực tiếp địa chỉ vùng nhớ C của `AVFrame`:
  ```ts
  FFI.swscale.sws_scale(
      this.customSwsCtx,
      srcFrame,
      srcFrame + 64n,
      0,
      srcH,
      this.frame,
      this.frame + 64n
  );
  ```
- **Trong `encodeRgbaFrame()`**: Gọi trực tiếp `ptr(this.srcData.buffer)` và `ptr(this.srcStride.buffer)` tại thời điểm gọi hàm C để đảm bảo địa chỉ bộ nhớ luôn tươi mới và hợp lệ 100%.

### 3.2. Cơ chế tắt luồng an toàn (Graceful Exit) trong `SceneWorker.ts`
- **File**: `src/core/SceneWorker.ts`
- Bổ sung lệnh nhận `EXIT` trong worker:
  ```ts
  if (task.type === 'EXIT') {
    process.exit(0);
  }
  ```
- Thay thế `w.terminate()` cưỡng bức bằng `w.postMessage({ type: 'EXIT' })`, cho phép luồng worker đóng các handle native và kết thúc chu trình sự kiện một cách an toàn.

### 3.3. Đảm bảo khởi tạo FFmpegManager trong `renderer.ts`
- **File**: `src/renderer.ts`
- Bổ sung `await FFmpegManager.prepare();` ngay tại đầu hàm `renderStoryVideo()`, phòng ngừa trường hợp gọi trực tiếp từ API/script mà chưa qua `cli.ts`.

---

## 4. Kết quả kiểm thử (Verification)
- Chạy liên tiếp 3 lần kiểm thử stress test với `./sample-story`:
  - Lần 1: Hoàn thành trong **3.8s** (0 lỗi, 0 crash).
  - Lần 2: Hoàn thành trong **3.8s** (0 lỗi, 0 crash).
  - Lần 3: Hoàn thành trong **4.7s** (0 lỗi, 0 crash).
- Kiểm tra B-Roll video frame decoding: hoạt động trơn tru, không còn lỗi `Segmentation fault`.
