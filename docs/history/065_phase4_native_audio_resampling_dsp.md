# 🏛️ History Log: [065] Phase 4 - Native In-Memory Audio Resampling & DSP (`FFIAudioDSP`)

## 1. Mục tiêu (Objective)
Loại bỏ hoàn toàn tiến trình phụ `Bun.spawn` và các file tạm `.wav` trong pipeline nhận diện giọng nói `whisper.ts`. Triển khai engine xử lý âm thanh `FFIAudioDSP` sử dụng `libswresample-7.dll` và `libavcodec-63.dll` trực tiếp trên bộ nhớ RAM.

---

## 2. Các thay đổi kỹ thuật chính (Key Technical Changes)

### 2.1. Cấu hình FFI Bindings cho `libswresample`
- **File**: `src/core/ffmpeg-ffi/index.ts`
- Bổ sung nạp động thư viện `swresample-7.dll` và các hàm C API:
  - `swr_alloc_set_opts2`: Cấu hình tái lấy mẫu giữa các định dạng âm thanh và layout kênh khác nhau.
  - `swr_init`: Khởi tạo context resampler.
  - `swr_convert`: Chuyển đổi trực tiếp các audio buffer đa kênh hoặc planar sang cấu trúc đích.
  - `swr_free`: Giải phóng an toàn context resampler.
- Khai báo thêm `av_channel_layout_default` trong `avutil-61.dll` và `avcodec_find_decoder`, `avcodec_send_packet`, `avcodec_receive_frame` trong `avcodec-63.dll`.

### 2.2. Xây dựng Module `FFIAudioDSP`
- **File**: `src/core/ffmpeg-ffi/FFIAudioDSP.ts`
- Cung cấp phương thức `decodeTo16kMonoFloat32(audioPath: string): Promise<Float32Array>`:
  - Giải mã mọi định dạng âm thanh đầu vào (MP3, WAV, AAC, OGG, FLAC, M4A) thành các audio frame RAW.
  - Tự động thiết lập `SwrContext` chuyển đổi sample rate bất kỳ sang chuẩn 16,000Hz Mono 32-bit Float (`AV_SAMPLE_FMT_FLT = 3`).
  - Trả về trực tiếp mảng `Float32Array` phục vụ suy luận Whisper ONNX mà không cần ghi file tạm ra đĩa cứng hay dùng thư viện bên ngoài `wavefile`.
- Cung cấp phương thức `createSilentMp3Buffer(seconds: number): Buffer` phục vụ muxing âm thanh tĩnh tốc độ cao.

### 2.3. Refactor `src/whisper.ts`
- Loại bỏ hoàn toàn hàm cũ `convertAudioTo16kWavBuffer` (từng gọi `Bun.spawn` và ghi file tạm ra `os.tmpdir()`).
- Loại bỏ dependency `wavefile`.
- Gọi trực tiếp `await FFIAudioDSP.decodeTo16kMonoFloat32(audioPath)` để nạp audio tensor vào pipeline HuggingFace Whisper.

---

## 3. Kết quả kiểm thử (Verification)
- Kiểm thử đơn vị độc lập:
  - Giải mã file `sample-story/voiceover1.mp3` thành công trong 40ms, tạo ra 31,984 mẫu 16kHz float32 tương ứng chính xác 1.999s.
  - Chạy `transcribeAudio` qua mô hình ONNX `whisper-tiny`: Tạo ra đầy đủ 4 mốc thời gian phụ đề chính xác 100% khớp với kịch bản gốc.
  - 0 file `.wav` tạm thời được tạo ra trên đĩa, 0 tiến trình phụ `ffmpeg.exe` được khởi chạy.
