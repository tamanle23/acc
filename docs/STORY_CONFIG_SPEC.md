# Story Configuration Specification (`story-config.json`)

Tài liệu đặc tả toàn diện về cấu trúc, kiểu dữ liệu, các tùy chọn tối ưu hóa nền tảng (TikTok, YouTube, Facebook, Web, Mobile), Video/Audio Codecs, CRF, GPU Acceleration, Container formats, Subtitle Modes (`burn` vs `soft`), và Caption Styles trong `story-config.json`.

---

## 1. Tổng quan cấu trúc JSON

Cấu trúc file `story-config.json` gồm các khối chính:
- **`name`** (Tùy chọn): Tên của video (được dùng làm tên file đầu ra).
- **`description`** (Tùy chọn): Mô tả tóm tắt nội dung video (ghi vào file metadata).
- **`settings`**: Cài đặt video toàn cục (platform preset, kích thước, fps, video/audio codec, CRF, container, GPU acceleration, captions).
- **`slides`**: Danh sách các phân cảnh (hình ảnh, âm thanh, danh sách timestamps phụ đề).

```json
{
  "name": "Chuyen_Tinh_Yeu_Khung_Long",
  "description": "Video kể về một chú khủng long đi tìm tình yêu đích thực",
  "settings": {
    "platform": "tiktok",
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "container": "mp4",
    "videoCodec": "h264",
    "crf": 21,
    "preset": "p4",
    "pixelFormat": "yuv420p",
    "audioCodec": "aac",
    "audioBitrate": "192k",
    "gpuAcceleration": "auto",
    "fastStart": true,
    "captions": {
      "preset": "tiktok",
      "subtitleMode": "burn",
      "position": "bottom",
      "fontSize": 54,
      "primaryColor": "#FFFF00",
      "outlineColor": "#000000",
      "shadowColor": "#000000",
      "outlineSize": 4,
      "shadowSize": 2,
      "marginV": 90,
      "marginH": 40,
      "borderStyle": 1
    },
    "transition": {
      "enabled": true,
      "type": "fade",
      "duration": 1.0,
      "audioBehavior": "pad"
    },
    "upscale": {
      "enabled": false,
      "model": "realesrgan-x4plus"
    }
  },
  "slides": [
    {
      "image": "scene1.jpg",
      "audio": "voiceover1.mp3",
      "captions": [
        { "text": "Ngày", "start": 0.0, "end": 0.35 },
        { "text": "xửa", "start": 0.35, "end": 0.7 },
        { "text": "ngày xưa...", "start": 0.7, "end": 1.85 }
      ]
    }
  ]
}
```

---

## 2. Chi tiết cấu hình Platform Preset (`settings.platform`)

Khi khai báo `platform`, hệ thống tự động thiết lập các thông số tối ưu nhất cho nền tảng đó. Mọi trường được khai báo tường minh sau đó sẽ **ghi đè** giá trị mặc định của platform.

| `platform` | Độ phân giải (Width x Height) | Tỉ lệ khung hình | FPS | Video Codec | Audio | Container | Mục đích |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`"tiktok"`** / **`"shorts"`** / **`"reels"`** | `1080 x 1920` | `9:16` (Dọc) | `30` | H.264 (NVENC/CPU) | AAC 192k | MP4 (FastStart) | Tối ưu hiển thị cho TikTok, YouTube Shorts, Facebook/Instagram Reels. |
| **`"youtube"`** | `1920 x 1080` | `16:9` (Ngang) | `30` | H.264 | AAC 256k | MP4 (FastStart) | Video chuẩn Full HD 1080p cho YouTube ngang. |
| **`"youtube-4k"`** | `3840 x 2160` | `16:9` (Ngang 4K) | `60` | H.265 / HEVC | AAC 320k | MP4 | Video 4K 60fps chất lượng siêu cao. |
| **`"facebook"`** | `1080 x 1350` | `4:5` (Dọc lửng) | `30` | H.264 | AAC 192k | MP4 (FastStart) | Tỉ lệ tối ưu cho News Feed Facebook & Instagram Post. |
| **`"instagram"`** | `1080 x 1080` | `1:1` (Vuông) | `30` | H.264 | AAC 192k | MP4 (FastStart) | Bài đăng feed vuông Instagram / Facebook. |
| **`"instagram-story"`** | `1080 x 1920` | `9:16` (Dọc) | `30` | H.264 | AAC 192k | MP4 (FastStart) | Instagram Story / Facebook Story. |
| **`"web"`** | `1280 x 720` | `16:9` | `30` | H.264 / VP9 | AAC 128k | MP4 / WebM | Nhẹ, nén tối ưu, tải nhanh trên website / web app. |
| **`"mobile"`** | `720 x 1280` | `9:16` | `30` | H.264 | AAC 128k | MP4 | Tiết kiệm dung lượng và băng thông mạng di động 3G/4G. |
| **`"custom"`** | `1920 x 1080` | Tùy biến | `30` | H.264 | AAC 192k | MP4 | Tự do cấu hình toàn bộ thông số thủ công. |

---

## 3. Chi tiết toàn bộ thuộc tính `settings`

### A. Kích thước & Khung hình
| Thuộc tính | Kiểu dữ liệu | Bắt buộc? | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `width` | `number` | Không | Theo platform (1080/1920) | Chiều rộng video (pixels). |
| `height` | `number` | Không | Theo platform (1920/1080) | Chiều cao video (pixels). |
| `fps` | `number` | Không | `30` | Số khung hình trên giây (24, 30, 60...). |

### B. Video & Audio Encoding Control
| Thuộc tính | Kiểu dữ liệu | Bắt buộc? | Giá trị hỗ trợ | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `videoCodec` | `string` | Không | `"auto"`, `"h264"`, `"h265"`, `"hevc"`, `"av1"`, `"vp9"`, `"h264_nvenc"`, `"libx264"`... | `"h264"` | Bộ giải mã video. Hỗ trợ tự động map sang GPU NVENC nếu có sẵn. |
| `crf` | `number` | Không | `0` - `51` (Khuyên dùng `18` - `26`) | `21` | **Constant Rate Factor / Constant Quality (CQ)**: Giá trị càng nhỏ thì chất lượng video càng cao và dung lượng file càng lớn (18: chất lượng gần như vô hao tổn, 21: rất đẹp, 26: nén nhẹ). |
| `preset` | `string` | Không | **NVIDIA:** `p1` (nhanh nhất) đến `p7` (chất lượng cao nhất).<br>**CPU:** `ultrafast`, `fast`, `medium`, `slow`... | `"p4"` | Điều khiển tỉ lệ giữa **tốc độ render** và **mức độ nén dung lượng**. |
| `pixelFormat` | `string` | Không | `"yuv420p"`, `"yuv444p"`, `"rgb24"` | `"yuv420p"` | Định dạng điểm ảnh. `"yuv420p"` đảm bảo tương thích 100% với tất cả trình duyệt, iOS, Android, TV, QuickTime, mạng xã hội. |
| `audioCodec` | `string` | Không | `"auto"`, `"aac"`, `"mp3"`, `"opus"`, `"libmp3lame"`, `"libopus"`, `"copy"` | `"aac"` | Bộ giải mã âm thanh đầu ra. |
| `audioBitrate` | `string` | Không | `"128k"`, `"192k"`, `"256k"`, `"320k"` | `"192k"` | Bitrate âm thanh (chất lượng âm thanh xuất xưởng). |

### C. Container Format, GPU Acceleration & Parallel Processing
| Thuộc tính | Kiểu dữ liệu | Bắt buộc? | Giá trị hỗ trợ | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `container` | `string` | Không | `"mp4"`, `"webm"`, `"mkv"`, `"mov"` | `"mp4"` | Định dạng tệp video đầu ra (`output.mp4`, `output.webm`...). |
| `fastStart` | `boolean` | Không | `true`, `false` | `true` | Đặt atom `moov` lên đầu file MP4/MOV để video có thể **phát ngay lập tức (streaming)** khi đang tải về trình duyệt web mà không cần đợi download hết file. |
| `gpuAcceleration` | `string` | Không | `"auto"`, `"nvidia"`, `"none"` | `"auto"` | Bật tăng tốc phần cứng GPU NVIDIA NVENC (nếu có card đồ họa RTX/GTX) giúp render siêu tốc chỉ trong vài giây. |
| `concurrency` | `number \| "auto"` | Không | `"auto"`, `1`, `2`, `4`, `6`, `8` | `"auto"` | **Số lượng phân cảnh (Slides) được render song song đồng thời** (Parallel Workers). `"auto"` tự động tối ưu dựa theo số nhân CPU và GPU NVENC để giảm thời gian render xuống tối đa. Đặt `1` để render tuần tự. |
| `fastIntermediate` | `boolean` | Không | `true`, `false` | `true` | Khi bật Transition, FFmpeg tạo các file MP4 tạm thời bằng chế độ ép xung (Ultrafast preset, CPU bypass compression). Tăng tốc độ render lên x4 lần nhưng tốn bộ nhớ đệm ổ cứng tạm thời lúc render. |

---

## 4. Chi tiết thuộc tính `settings.captions` (Tùy chỉnh phụ đề, Chế độ Subtitle & Vị trí)

| Thuộc tính | Kiểu dữ liệu | Bắt buộc? | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `preset` | `"classic" \| "tiktok" \| "cinematic" \| "vlog" \| "neon-glow" \| "bold-retro" \| "minimal-clean" \| "karaoke" \| "news-banner" \| "retro-typewriter"` | Không | `"classic"` | Tên bộ style mẫu có sẵn (10 bộ phong cách đa dạng). |
| `subtitleMode` | `"burn" \| "soft"` | Không | `"burn"` | **Chế độ phụ đề**:<br>• `"burn"` (Hardsub): Khắc trực tiếp vào hình ảnh video (khuyên dùng cho TikTok/Reels/Shorts/Web).<br>• `"soft"` (Softsub): Đóng gói thành **Track phụ đề riêng biệt** bên trong file container (MKV/MP4/WebM), cho phép bật/tắt (Toggle ON/OFF) trong VLC. |
| `position` | `"bottom" \| "center" \| "top" \| "top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | Không | `"bottom"` | **Vị trí hiển thị chữ trên khung hình** (xem chi tiết mục 6). |
| `fontName` | `string` | Không | Tùy preset | Tên Font chữ hệ thống (ví dụ: `Arial`, `Impact`, `Times New Roman`, `Courier New`). |
| `fontSize` | `number` | Không | Tùy preset | Kích cỡ font chữ (pt/pixel trong ASS chuẩn độ phân giải video). |
| `primaryColor` | `string` (Hex `#RRGGBB` / `#RGB`) | Không | Tùy preset | Màu chữ chính (ví dụ `#FFFF00` là vàng, `#FFFFFF` là trắng, `#00FFFF` là xanh neon). |
| `outlineColor` | `string` (Hex `#RRGGBB`) | Không | `#000000` | Màu viền bao quanh chữ. |
| `shadowColor` | `string` (Hex `#RRGGBB`) | Không | `#000000` | Màu bóng đổ hoặc màu nền hộp phụ đề. |
| `outlineSize` | `number` | Không | Tùy preset | Độ dày viền chữ (pixel). `0` = tắt viền. |
| `shadowSize` | `number` | Không | Tùy preset | Độ đậm/khoảng cách bóng đổ (pixel). `0` = tắt bóng. |
| `marginV` | `number` | Không | Tùy preset | **Khoảng cách lề dọc** từ mép trên/dưới lên (Vertical margin - pixel thực tế). |
| `marginH` | `number` | Không | `40` | **Khoảng cách lề ngang** từ 2 mép trái/phải vào (Horizontal margin - pixel). |
| `marginL` | `number` | Không | `40` | Khoảng cách lề trái (Left margin - pixel, ghi đè `marginH`). |
| `marginR` | `number` | Không | `40` | Khoảng cách lề phải (Right margin - pixel, ghi đè `marginH`). |
| `alignment` | `number` (1 - 9) | Không | Tùy `position` | Căn lề thủ công theo cụm phím Numpad (nếu muốn override `position`). |
| `borderStyle` | `1 \| 3` | Không | `1` | `1` = Viền chữ & bóng đổ (Outline & Shadow).<br>`3` = Hộp nền màu đặc/mờ bao quanh chữ (Opaque Box). |
| `wordsPerPhrase` | `number` | Không | `1` | Sắp xếp phụ đề hiển thị thành cụm từ (Karaoke chunking). Nếu nhập `5` hoặc `6`, phụ đề sẽ xuất hiện cả câu thay vì hiển thị 1 từ trên mỗi khung hình. |
| `highlightPreset` | `"none" \| "color" \| "scale" \| "glow" \| "scale-color"` | Không | `"none"` | **Hiệu ứng Karaoke Highlight** làm nổi bật từ đang được phát âm. (Yêu cầu `wordsPerPhrase > 1` để thấy hiệu quả). |
| `highlightColor` | `string` (Hex `#RRGGBB`) | Không | `#00FFFF` | Mã màu dùng cho hiệu ứng highlight từ đang đọc. |

---

## 5. Danh sách 10 bộ Caption Presets đẹp mắt

| Preset Name | Font | Cỡ | Màu chính | Viền / Bóng | `borderStyle` | `marginV` | Phong cách & Thể loại phù hợp |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`"tiktok"`** | `Impact` | `54` | Vàng (`#FFFF00`) | Viền `4px`, Bóng `2px` | `1` (Viền) | `90px` | Video ngắn viral TikTok, Shorts, Reels. Nổi bật trên mọi background. |
| **`"classic"`** | `Arial` | `44` | Trắng (`#FFFFFF`) | Viền `3px`, Bóng `2px` | `1` (Viền) | `60px` | Phụ đề chuẩn truyền hình, phim ảnh truyền thống. |
| **`"cinematic"`** | `Times New Roman` | `42` | Trắng (`#FFFFFF`) | Tắt viền, Bóng mềm `3px` | `1` (Bóng mềm) | `60px` | Phim điện ảnh, video nghệ thuật, phim tài liệu sâu lắng. |
| **`"vlog"`** | `Arial` | `44` | Trắng (`#FFFFFF`) | Tắt viền/bóng | `3` (Box đen) | `70px` | Video Vlog YouTube, phóng sự tài liệu, dễ đọc với nền hộp đen mờ. |
| **`"neon-glow"`** | `Impact` | `52` | Xanh Cyan (`#00FFFF`) | Viền tím (`#2A0845`), Bóng neon `4px` | `1` (Glow) | `85px` | Gaming, Tech, Công nghệ, Cyberpunk, Sci-Fi. |
| **`"bold-retro"`** | `Impact` | `54` | Cam rực (`#FF7700`) | Viền trắng (`#FFFFFF`), Bóng `3px` | `1` (Pop-art) | `80px` | Hoạt hình, Anime, Truyện tranh (Comics), kể chuyện nhí nhảnh. |
| **`"minimal-clean"`** | `Arial` | `40` | Trắng tinh (`#FFFFFF`) | Viền mỏng `1px`, Không bóng | `1` (Minimal) | `50px` | Phong cách Bắc Âu / Apple Minimalist, thanh lịch, tinh tế. |
| **`"karaoke"`** | `Arial` | `50` | Xanh Lime (`#00FF66`) | Viền xanh thẫm (`#003311`), Bóng `2px` | `1` (Highlight) | `80px` | Video âm nhạc, lyric, video giáo dục nhấn mạnh từng từ. |
| **`"news-banner"`** | `Arial` | `42` | Trắng (`#FFFFFF`) | Nền hộp Navy (`#001F3F`) | `3` (Banner) | `50px` | Bản tin thời sự, tin tức, thông báo khẩn cấp, thời sự báo chí. |
| **`"retro-typewriter"`**| `Courier New` | `42` | Màu ngà (`#FFFDD0`) | Viền nâu cà phê (`#2C1A11`), Bóng `2px`| `1` (Vintage) | `60px` | Video trinh thám, lịch sử, đọc thư cổ, sách nói cổ điển. |

---

## 6. Tùy chỉnh vị trí Caption trên khung hình (`position` & `alignment`)

| `position` | Mã `alignment` | Vị trí trên khung hình | Sử dụng phù hợp |
| :--- | :--- | :--- | :--- |
| `"bottom"` / `"bottom-center"` | `2` | Giữa mép dưới (Bottom-Center) | Mặc định cho video, phim ảnh, TikTok. |
| `"center"` / `"middle"` | `5` | **Chính giữa màn hình (Center-Center)** | Video trích dẫn, thông điệp ngắn, lyric nhạc. |
| `"top"` / `"top-center"` | `8` | **Giữa mép trên (Top-Center)** | Tiêu đề chương, thông báo đầu video. |
| `"bottom-left"` | `1` | Góc dưới bên trái | Subtitle dạng thoại nhân vật (Visual Novel). |
| `"bottom-right"` | `3` | Góc dưới bên phải | Chú thích tác giả/nguồn. |
| `"top-left"` | `7` | Góc trên bên trái | Chú thích thời gian / địa điểm. |
| `"top-right"` | `9` | Góc trên bên phải | Thông tin ngày tháng / chapter. |

---

## 7. Chi tiết mảng `slides`

Mỗi phần tử trong `slides` đại diện cho một phân cảnh trong video:

| Thuộc tính | Kiểu dữ liệu | Bắt buộc? | Mô tả |
| :--- | :--- | :--- | :--- |
| `image` | `string` | **Bắt buộc** | Tên tệp ảnh (ví dụ `scene1.jpg`), đường dẫn tương đối (ví dụ `./assets/scene1.png`, `../shared/bg.jpg`), hoặc **đường dẫn tuyệt đối** (ví dụ `C:/Users/Admin/Pictures/scene1.jpg`, `/var/media/images/scene1.png`). |
| `audio` | `string` | **Bắt buộc** | Tên tệp âm thanh/voiceover tương ứng (ví dụ `voiceover1.mp3`), đường dẫn tương đối (ví dụ `./audio/v1.wav`), hoặc **đường dẫn tuyệt đối** (ví dụ `C:/Users/Admin/Audio/voiceover1.mp3`, `/var/media/voiceover1.wav`). |
| `captions` | `CaptionConfig[]` | Không | Mảng danh sách các mốc hiển thị chữ trong phân cảnh này. |

### Cấu trúc từng mục trong `captions`:
* **`text`** (`string`): Đoạn văn bản hoặc từ hiển thị trên màn hình.
* **`start`** (`number`): Thời điểm bắt đầu xuất hiện (tính bằng **giây** từ `0.0` của slide hiện tại).
* **`end`** (`number`): Thời điểm kết thúc hiển thị (tính bằng **giây**, phải thỏa mãn `end > start`).

---

## 8. Quy tắc thứ tự ưu tiên cấu hình (Precedence Order & Fallbacks)

1. **Ưu tiên 1 (Cao nhất)**: Giá trị được khai báo tường minh trong khối `settings` (ví dụ `width`, `height`, `fps`, `crf`, `videoCodec`, `container`...).
2. **Ưu tiên 2**: Giá trị mặc định của `platform` được chọn (ví dụ `"tiktok"`, `"youtube"`, `"web"`...).
3. **Ưu tiên 3 (Thấp nhất - Fallback khi không có `platform`)**: Giá trị mặc định toàn cục của hệ thống (`"custom"`):
   - `width`: 1920, `height`: 1080, `fps`: 30
   - `videoCodec`: `"h264"` (NVIDIA NVENC nếu có GPU, CPU libx264 nếu không)
   - `crf`: 21, `preset`: `"p4"` / `"medium"`, `pixelFormat`: `"yuv420p"`
   - `audioCodec`: `"aac"`, `audioBitrate`: `"192k"`
   - `container`: `"mp4"`, `fastStart`: `true`, `gpuAcceleration`: `"auto"`

---

## 9. Bảng tổng hợp thuộc tính Bắt buộc (Required) vs Tùy chọn (Optional)

### 🔴 Thuộc tính BẮT BUỘC:
Chỉ có duy nhất 3 trường bắt buộc trong toàn bộ tệp cấu hình:
1. `slides` (cấp root): Mảng phân cảnh (tối thiểu 1 slide).
2. `slides[i].image` (trong từng slide): Đường dẫn tệp ảnh.
3. `slides[i].audio` (trong từng slide): Đường dẫn tệp âm thanh.

### 🟢 File cấu hình TỐI GIẢN NHẤT vẫn chạy được:
```json
{
  "slides": [
    {
      "image": "scene1.jpg",
      "audio": "voiceover1.mp3"
    },
    {
      "image": "scene2.jpg",
      "audio": "voiceover2.mp3"
    }
  ]
}
```
*Tất cả các thông số còn lại (`settings`, `captions`) đều có giá trị mặc định an toàn và tự động tương thích ngược 100%.*

---

## 10. Cơ chế Căn Chỉnh Phụ Đề Theo Script Gốc (Script-Guided Timestamp Alignment)

Khi sử dụng Whisper để nhận diện giọng nói tự động, mô hình AI có thể đôi khi viết sai chính tả tiếng Việt hoặc lặp từ (hallucination). Hệ thống hỗ trợ tính năng **Script-guided Timestamp Alignment**: Sử dụng văn bản kịch bản gốc bạn cung cấp để làm nội dung chữ 100% chuẩn xác, kết hợp với Whisper AI để trích xuất mốc thời gian (timestamps) thực tế của giọng nói.

### Các cách đặt file kịch bản để tự động nhận diện:

1. **File `.txt` riêng cho từng slide (Khuyên dùng)**:
   - Cùng thư mục với audio: `voiceover/01.txt`, `voiceover/01.mp3.txt`, `voiceover/02.txt`
   - Hoặc ở thư mục gốc story: `01.txt`, `voiceover1.txt`, `scene1.txt`
2. **File `.txt` toàn cục (`script.txt` / `story.txt` / `transcript.txt`)**:
   - Mỗi dòng văn bản trong file tương ứng với 1 phân cảnh (slide).
3. **File `.json` toàn cục (`script.json` / `story.json`)**:
   - Chứa mảng các chuỗi (`["Câu 1...", "Câu 2..."]`) hoặc mảng object (`[{"text": "Câu 1..."}, ...]`).
4. **Fallback tự động**:
   - Nếu không tìm thấy file script gốc nào, hệ thống sẽ tự động dùng văn bản do Whisper nhận diện.

---

## 11. Tính năng AI Upscale & Chuyển cảnh (Transitions)

### A. Tùy chỉnh AI Upscale (`settings.upscale`)
Hệ thống tích hợp sẵn luồng gọi Real-ESRGAN/UltraSharp để làm nét hình ảnh (x4) tự động trước khi ghép video. Tool sẽ tự động tải các model phù hợp với HDH của bạn (Windows/Mac/Linux) nếu chưa có.

| Thuộc tính | Kiểu dữ liệu | Bắt buộc? | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | Không | `false` | Bật/tắt tự động upscale ảnh đầu vào (làm nét ảnh gốc trước khi gen video). |
| `model` | `string` | Không | `"realesrgan-x4plus"` | Model làm nét. Hỗ trợ: `"realesrgan-x4plus"` (đa dụng), `"4x-UltraSharp"` (chân thực), `"realesrgan-x4plus-anime"` (hoạt hình 2D), `"realesrnet-x4plus"`. |

### B. Tùy chỉnh Chuyển Cảnh (`settings.transition` & `slides[i].transition`)
Cấu hình hiệu ứng chuyển cảnh sử dụng `xfade` của FFmpeg. **Hỗ trợ cấu hình mức Global (cho toàn bộ video) và mức Local (riêng cho từng slide để override).**

| Thuộc tính | Kiểu dữ liệu | Bắt buộc? | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | Không | `false` | Bật/tắt hiệu ứng chuyển cảnh. |
| `type` | `string` | Không | `"fade"` | Kiểu hiệu ứng. Các loại phổ biến: `"fade"`, `"wipeleft"`, `"circlecrop"`, `"random"`, `"slideleft"`, `"dissolve"`... |
| `duration` | `number` | Không | `1.0` | Thời gian chuyển cảnh (giây). |
| `audioBehavior` | `"pad" \| "crossfade"` | Không | `"pad"` | Cách xử lý âm thanh chồng chéo (overlap).<br>• `"pad"`: Tự động đệm tĩnh âm thanh, tránh trường hợp 2 giọng nói đè lên nhau trong lúc hình ảnh mờ dần.<br>• `"crossfade"`: Mix đều 2 audio (chỉ nên dùng cho video ca nhạc). |

**Ví dụ cấu hình riêng biệt (Override) ở từng Slide:**
Hiệu ứng sẽ được áp dụng khi chuyển từ `Slide 1` sang `Slide 2`. Nếu slide không ghi, hệ thống fallback về Global `settings.transition`.
```json
{
  "image": "scene1.jpg",
  "audio": "voiceover1.mp3",
  "transition": {
    "enabled": true,
    "type": "wipeleft",
    "duration": 1.5,
    "audioBehavior": "pad"
  }
}
```


