# Brainstorming Kiến trúc Multi-Timeline (Hướng 1: Main Track + Overlays)

Kiến trúc này giữ nguyên mảng `scenes` (đóng vai trò như **Main Track** quyết định nhịp độ và tổng thời lượng của video), đồng thời bổ sung các **Track vệ tinh** đè lên (Overlays) hình ảnh và âm thanh.

---

## 1. Mở rộng JSON Schema (Data Model)

Chúng ta sẽ thêm 2 mảng mới vào cấp root của `story-config.json`: `audioTracks` và `visualOverlays`.

```json
{
  "settings": { ... },
  "scenes": [
    { "image": "bg1.jpg", "audio": "voice1.wav" },
    { "image": "bg2.jpg", "audio": "voice2.wav" }
  ],
  "audioTracks": [
    {
      "type": "bgm",
      "source": "audio/lofi-chill.mp3",
      "volume": 0.1,
      "loop": true,
      "fadeIn": 2.0,
      "fadeOut": 3.0,
      "ducking": true // Tự động giảm âm lượng khi có Voiceover
    },
    {
      "type": "sfx",
      "source": "audio/swoosh.wav",
      "reference": { "sceneIndex": 1, "offset": 0.0 }, // Relative time!
      "volume": 0.8
    }
  ],
  "visualOverlays": [
    {
      "type": "watermark",
      "source": "assets/logo.png",
      "position": "top-right",
      "opacity": 0.5,
      "startTime": 0.0,
      "duration": -1 // -1 = Toàn bộ video
    },
    {
      "type": "pip", // Picture-in-Picture hoặc B-Roll
      "source": "assets/reaction.mp4",
      "reference": { "sceneIndex": 1, "offset": 2.0 },
      "duration": 5.0,
      "layout": { "x": 50, "y": 50, "scale": 0.3 }
    }
  ]
}
```

### Điểm nhấn: Relative Timestamps (Tham chiếu thời gian tương đối)
Thay vì bắt buộc người dùng (hoặc AI) tính toán thời gian tuyệt đối (`startTime: 24.5` giây), hệ thống hỗ trợ **Tham chiếu tương đối**:
- `reference: { sceneIndex: 1, offset: 2.0 }` nghĩa là: Chèn clip này vào đúng lúc **giây thứ 2.0 của Scene thứ 2**.
- Tại sao quan trọng? Vì độ dài của một Scene phụ thuộc vào TTS (Giọng đọc AI). AI text-to-speech có thể đọc nhanh hoặc chậm. Việc gán tọa độ tương đối giúp B-roll hoặc SFX luôn "bám sát" phân cảnh bất kể giọng đọc dài bao nhiêu!

---

## 2. Render Pipeline (Luồng xử lý FFmpeg)

Việc nhồi nhét tất cả vào một lệnh FFmpeg duy nhất (Giant Filtergraph) rất dễ gây tràn bộ nhớ, crash, và rất khó debug. Hướng tiếp cận tốt nhất là **Multi-Pass Pipeline (Chia để trị)**:

### Pass 1: Render Main Sequence (Như hiện tại)
- Render từng Scene (Hình + Voiceover + Transition + Captions).
- Nối (Concat) thành file `main_track_temp.mp4`.

### Pass 2: Xử lý Visual Overlays
Nếu có Logo, B-Roll, Sticker:
- Load `main_track_temp.mp4` làm Input 0.
- Load các file hình ảnh/video vệ tinh làm Input 1, 2, 3...
- Dùng `filter_complex`: Scale kích thước, gán tọa độ tọa độ `[x, y]`, và dùng `enable='between(t,start,end)'` để quyết định lúc nào nó hiện ra.
- Xuất ra file `main_with_visuals_temp.mp4`.

### Pass 3: Xử lý Audio Mixing (Multi-track Audio)
Nếu có BGM, SFX:
- Tính toán chính xác thời điểm tuyệt đối (Absolute time) của từng SFX dựa vào thông tin `sceneDuration` thu được ở Pass 1.
- Dùng filter `adelay` để lùi âm thanh SFX về đúng số mili-giây cần thiết.
- Dùng filter `amix` để trộn: (Main Voiceover) + (BGM) + (SFX 1) + (SFX 2).
- Có thể kết hợp filter `sidechaincompress` để làm tính năng **Audio Ducking** (Nhạc nền tự động nhỏ lại khi có tiếng người nói).
- Ghép âm thanh cuối cùng với video ở Pass 2 để ra **Final File**.

---

## 3. Các Tính Năng Cao Cấp Mở Rộng Được

Việc có mô hình Track độc lập mang lại không gian sáng tạo lớn cho Auto-Config:

1. **Auto-BGM (Nhạc nền tự động)**:
   - Tự động lấy 1 file nhạc `.mp3` trong thư mục, set volume `0.1` và gán vào `audioTracks`.
   - Nếu nhạc ngắn hơn video, FFmpeg tự động loop (`-stream_loop -1`).
2. **Transition Sound Effects (SFX Chuyển cảnh)**:
   - Auto-Config có thể tự gài `swoosh.wav` vào vị trí giao nhau giữa các Scene (`sceneIndex: i, offset: 0`) thông qua relative reference.
3. **Picture-in-Picture (Reaction Video / B-Roll)**:
   - Rất phổ biến trên YouTube Shorts: Giọng đọc chính đang nói, tự nhiên hiện ra 1 meme video nhỏ đè lên góc màn hình trong 3 giây.
4. **Watermark / Kênh Brand**:
   - Gắn logo cố định ở góc xuyên suốt video mà không cần encode cứng vào ảnh nền.

---

## 4. Lộ Trình Gợi Ý (Migration Path)

Không nên làm tất cả cùng lúc vì độ rủi ro cao. Chia nhỏ thành các Phase:

*   **Phase 1: Basic Background Music (BGM)**
    *   Hỗ trợ 1 trường `bgm` đơn giản trong settings: Nhạc nền lặp vô tận, chỉnh âm lượng, tự động mờ dần (fade out) ở cuối video.
*   **Phase 2: Mảng `audioTracks` hoàn chỉnh (SFX, Multiple Audios)**
    *   Phát triển hệ thống tính toán thời gian Delay. Hỗ trợ Audio Ducking.
*   **Phase 3: Visual Overlays (B-Roll, PIP, Stickers)**
    *   Xây dựng thuật toán tạo Filtergraph động cho hình ảnh.
