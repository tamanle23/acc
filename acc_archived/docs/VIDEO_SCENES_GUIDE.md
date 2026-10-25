# Hướng Dẫn Tích Hợp Video (B-Roll & Stock Footage)

Tài liệu hướng dẫn chi tiết cách chèn video clips (B-Roll, Stock Footage, Meme Videos) vào làm phân cảnh, xử lý xung đột thời lượng và trộn âm thanh song song với giọng đọc AI (Voiceover).

---

## 1. Cách Sử Dụng Tool `auto-config.ts`

Chỉ cần ném các tệp video (`.mp4`, `.mov`, `.webm`, `.mkv`) vào cùng thư mục với hình ảnh (ví dụ: `images/` hoặc `video/`). Tool `auto-config.ts` sẽ tự động:
1. Nhận diện các tệp là Video thay vì ảnh tĩnh.
2. Tự động liên kết video đó với tệp âm thanh (Voiceover) tương ứng.
3. Sinh ra khối cấu hình `video` và `videoSettings` an toàn mặc định bên trong file `story-config.json`.

---

## 2. Cấu Trúc JSON Phân Cảnh Video (`story-config.json`)

Trong mảng `scenes`, bạn sử dụng thuộc tính `video` thay cho `image`:

```json
{
  "video": "b-roll-thien-nhien.mp4",
  "audio": "voiceover-3.mp3",
  "videoSettings": {
    "timeBase": "audio",
    "shortVideoMode": "freeze",
    "longVideoMode": "trim",
    "volume": 0.2
  },
  "captions": [...]
}
```

---

## 3. Quản Lý Xung Đột Thời Lượng & Âm Thanh (`videoSettings`)

Khi chèn một đoạn video vào kèm theo một file Voiceover, thời lượng của 2 file này hiếm khi bằng nhau. Thuộc tính `videoSettings` giúp bạn định nghĩa luật giải quyết xung đột này.

### A. Mốc Thời Gian Chính (`timeBase`)
- **`"audio"` (Mặc định):** Voiceover là thước đo chính. Phân cảnh kết thúc khi giọng đọc kết thúc, bất kể video dài hay ngắn.
- **`"video"`:** Video là thước đo chính. Giọng đọc kết thúc nhưng video vẫn sẽ tiếp tục phát cho tới khung hình cuối cùng (âm thanh Voiceover sẽ được bù bằng khoảng lặng - silence padding).

### B. Xử Lý Khi Video Quá Ngắn (`shortVideoMode`)
Áp dụng khi `timeBase="audio"` nhưng video lại ngắn hơn đoạn hội thoại.
- **`"freeze"` (Mặc định):** Khi video chạy hết, hệ thống sẽ **Đóng Băng** (Hold) khung hình cuối cùng thành ảnh tĩnh trong lúc đợi Voiceover đọc xong đoạn còn lại.
- **`"loop"`:** Khi video chạy hết, hệ thống sẽ liên tục **Lặp Lại** (Seamless Loop) video từ đầu cho tới khi Voiceover đọc xong. Rất phù hợp cho các đoạn video ambient, cinemagraphs, hoặc mưa rơi/lửa cháy.

### C. Xử Lý Khi Video Quá Dài (`longVideoMode`)
Áp dụng khi video dài hơn đoạn hội thoại.
- **`"trim"` (Mặc định):** Tự động **Cắt Bỏ** phần video thừa ngay khi Voiceover kết thúc để chuyển sang cảnh tiếp theo.
- **`"continue"`:** Phân cảnh sẽ tiếp tục phát nốt phần hình ảnh còn lại của video. (Tương đương việc ép `timeBase = "video"`).

### D. Trộn Âm Thanh Gốc Của Video (`volume`)
Bạn có thể quyết định xem có giữ lại âm thanh gốc của đoạn video hay không.
- **`0.0` (Mặc định):** Tắt toàn bộ tiếng của đoạn video, chỉ lấy hình ảnh (B-Roll câm).
- **`0.1` đến `1.0+`:** Giữ lại âm thanh của video theo mức âm lượng chỉ định. Hệ thống thuật toán Audio Mixing (amix) sẽ tự động trộn âm thanh này làm nền đằng sau giọng đọc Voiceover mà không gây nhiễu.

---

## 4. Bảng Tra Cứu Nhanh (Use Cases)

| Tình Huống Thực Tế | Khuyên dùng `videoSettings` |
| :--- | :--- |
| **Video mượn làm nền minh họa (B-Roll) câm** | `timeBase: "audio", shortVideoMode: "freeze", volume: 0` |
| **Video lặp vô tận (Cinemagraph, Meme loop)** | `timeBase: "audio", shortVideoMode: "loop", volume: 0` |
| **Video có tiếng động (VD: Tiếng mưa rào)** | `timeBase: "audio", shortVideoMode: "loop", volume: 0.15` |
| **Video phỏng vấn/Vlog muốn giữ trọn vẹn** | `timeBase: "video", longVideoMode: "continue", volume: 1.0` |
