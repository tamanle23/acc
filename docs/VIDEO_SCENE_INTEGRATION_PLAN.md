# 🎥 Video Scene Integration - Architecture Design

Tài liệu này đặc tả kiến trúc tích hợp loại phân cảnh mới (`video`) vào hệ thống Visual Storytelling Generator. Toàn bộ các phương án xử lý thời lượng và âm thanh đều được phơi bày qua config để người dùng kiểm soát 100%.

## 1. Mở rộng cấu trúc `story-config.json`

Hệ thống bổ sung khóa `video` (ưu tiên cao hơn `image` nếu cả hai tồn tại trong 1 slide). Cấu trúc `videoSettings` cung cấp toàn quyền điều khiển:

```json
"slides": [
  {
    "video": "b-roll.mp4",
    "audio": "voiceover.mp3",
    "videoSettings": {
      "timeBase": "audio",           // 'audio' hoặc 'video'. Mốc thời gian chính để kết thúc cảnh.
      "shortVideoMode": "freeze",    // 'freeze' hoặc 'loop'. Xử lý khi video ngắn hơn.
      "longVideoMode": "trim",       // 'trim' hoặc 'continue'. Xử lý khi video dài hơn.
      "volume": 0.0                  // 0.0 đến 1.0+. Mặc định tắt tiếng, nếu bật sẽ mix với voiceover.
    }
  }
]
```

## 2. Giải quyết Xung đột Thời lượng (Duration Conflict)

Có thể cấu hình linh hoạt mọi trường hợp thông qua các biến trên:

### 2.1. Thước đo thời gian chính (`timeBase`)
*   **Mặc định (`timeBase: "audio"`):** Giữ Voiceover làm thước đo thời gian chuẩn (Source of Truth).
*   **Tùy chọn (`timeBase: "video"`):** Lấy độ dài của Video làm chuẩn. (Nếu Voiceover ngắn hơn, video vẫn tiếp tục chạy kèm khoảng lặng. Nếu Voiceover dài hơn, Voiceover sẽ bị cắt ngang).

### 2.2. Khi Video NGẮN HƠN Voiceover (Thiếu hình)
*(Thường xảy ra khi `timeBase: "audio"`)*
*   **Mặc định (`shortVideoMode: "freeze"`):** Video chạy hết, sau đó **đóng băng (Frame Hold)** ở khung hình cuối cùng để chờ Voiceover đọc xong.
*   **Tùy chọn (`shortVideoMode: "loop"`):** Lặp lại video (seamless loop) liên tục cho đến khi Voiceover kết thúc.

### 2.3. Khi Video DÀI HƠN Voiceover (Thừa hình)
*(Thường xảy ra khi `timeBase: "audio"`)*
*   **Mặc định (`longVideoMode: "trim"`):** **Cắt bỏ (Trim)** phần thừa của video. Ngay khi Voiceover đọc xong, kết thúc slide.
*   **Tùy chọn (`longVideoMode: "continue"`):** **Tiếp tục với video**. Mặc dù Voiceover đã hết, video vẫn tiếp tục phát cho đến frame cuối cùng (khúc này Voiceover sẽ im lặng). *(Lưu ý: Chế độ này về bản chất tạo ra kết quả giống hệt `timeBase: "video"`).*

### 2.4. Xử lý Âm thanh gốc (Audio Mix)
*   **Mặc định (`volume: 0.0`):** **Mute hoàn toàn** âm thanh gốc của video.
*   **Tùy chọn (`volume > 0`):** Bật âm thanh gốc. Hệ thống sẽ trộn (Mix) âm thanh của video và Voiceover lại với nhau, trong đó thuật toán sẽ ưu tiên làm nổi bật (Ducking/Gain) tiếng Voiceover để không bị nhạc nền/tạp âm của video lấn át.

---

## 3. Kiến trúc FFmpeg Rendering Pipeline

Trình xuất (Renderer) sẽ sinh lệnh dựa trên config:

**1. Mặc định: (Audio Base + Trim Long + Freeze Short + Mute)**
```bash
ffmpeg -i video.mp4 -i audio.mp3 -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=9999[v]" -map "[v]" -map 1:a -c:v h264 -c:a aac -shortest output.mp4
```

**2. Audio Base + Loop Short + Mute**
```bash
ffmpeg -stream_loop -1 -i video.mp4 -i audio.mp3 -map 0:v -map 1:a -shortest output.mp4
```

**3. Video Base (Hoặc Audio Base + Continue) + Mix Audio**
```bash
# Không dùng -shortest, dùng amix để trộn tiếng, apad để đệm khoảng lặng nếu audio ngắn
ffmpeg -i video.mp4 -i audio.mp3 -filter_complex "[0:a]volume=0.3[va];[1:a]volume=1.0,apad[aa];[va][aa]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" output.mp4
```

## 4. Cập nhật công cụ `auto-config.ts`

1. **Quét File:** Bổ sung nhận diện định dạng `.mp4`, `.mov`, `.webm`.
2. **Bắt cặp (Pairing):** Hỗ trợ ghép Video + Audio (cùng tên hoặc thứ tự).
3. **Tạo JSON:** Điền `video: "..."` thay vì `image` nếu file nguồn là video. Điền sẵn block `videoSettings` mặc định.

## 5. Tính tương thích với Transition (xfade)
Hoàn toàn tương thích. Vì luồng xử lý xuất ra intermediate `.mp4` có độ phân giải/framerate chuẩn hóa, quy trình ghép `xfade` phía sau không bị ảnh hưởng.
