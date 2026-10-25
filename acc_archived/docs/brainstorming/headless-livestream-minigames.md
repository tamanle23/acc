# Tài Liệu Triển Khai: Hệ Thống Livestream Mini-Game Tương Tác (Headless Architecture)

Tài liệu này hướng dẫn xây dựng một hệ thống phát sóng trực tiếp (livestream) tích hợp mini-game thời gian thực hoàn toàn tự động. Hệ thống loại bỏ sự phụ thuộc vào OBS Studio và trình duyệt web (Puppeteer/Chrome), sử dụng sức mạnh xử lý luồng tĩnh của **Bun**, **@napi-rs/canvas** và **FFmpeg** để đạt hiệu năng tối đa.

## 1. Kiến Trúc Hệ Thống (Architecture)

Hệ thống hoạt động theo mô hình **Headless Pure Canvas Streamer**:
1.  **Event Listener (Bun WebSockets):** Lắng nghe sự kiện tương tác từ người dùng (comment, thả tim, chốt đơn).
2.  **Game Engine (@napi-rs/canvas + Lottie):** Quản lý trạng thái trò chơi (State) và vẽ đồ họa trực tiếp lên RAM buffer (In-memory Canvas) ở tốc độ 30/60 FPS.
3.  **Video Compositor (FFmpeg):** Nhận dòng dữ liệu điểm ảnh thô (Raw RGBA) từ Canvas qua đường ống `stdin`, trộn với luồng Camera thực tế, mã hóa (Encode) bằng GPU và đẩy lên RTMP Server (TikTok/Shopee).

---

## 2. Chuẩn Bị Môi Trường

### Cài đặt công cụ lõi
Hệ thống yêu cầu cài đặt sẵn **Bun** và **FFmpeg** trên thiết bị thực thi (Server Linux hoặc Local PC Windows/macOS).

```bash
# 1. Cài đặt Bun (nếu chưa có)
curl -fsSL [https://bun.sh/install](https://bun.sh/install) | bash

# 2. Kiểm tra FFmpeg (phải có sẵn trong PATH)
ffmpeg -version
```

### Khởi tạo dự án
```bash
mkdir headless-livestream && cd headless-livestream
bun init
bun add @napi-rs/canvas
bun add -d @types/node
```

Tạo một file mẫu Lottie (ví dụ `celebration.json`) trong thư mục dự án để làm hiệu ứng trúng thưởng.

---

## 3. Mã Nguồn Cốt Lõi (Implementation)

Cấu trúc file chính `index.ts` được chia làm 3 thành phần: Khởi tạo FFmpeg, Vòng lặp Render (Game Loop), và Xử lý Sự kiện.

```typescript
import { spawn } from 'child_process';
import { createCanvas, LottieAnimation } from '@napi-rs/canvas';
import { serve } from 'bun';

// ==========================================
// 1. CẤU HÌNH HỆ THỐNG
// ==========================================
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const FRAME_TIME = 1000 / FPS;

// RTMP Đích (Thay bằng URL của TikTok/Shopee/YouTube)
const RTMP_URL = 'rtmp://127.0.0.1/live/test'; 

// Khởi tạo Canvas (RAM Buffer)
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Load Lottie Animation
let lottieFile: LottieAnimation;
try {
  lottieFile = LottieAnimation.loadFromFile('./celebration.json');
} catch (e) {
  console.warn("Không tìm thấy file Lottie, bỏ qua hiệu ứng.");
}

// Trạng thái Mini-game
const gameState = {
  leaderboard: ['User_A: 1500đ', 'User_B: 1200đ', 'User_C: 900đ'],
  showCelebration: false,
  lottieFrame: 0,
};

// ==========================================
// 2. KHỞI TẠO ĐƯỜNG ỐNG FFMPEG
// ==========================================
console.log('Khởi động FFmpeg process...');
const ffmpeg = spawn('ffmpeg', [
  '-y', // Ghi đè file nếu có
  
  // Input 0: Luồng Raw Video từ Bun (@napi-rs/canvas) bơm qua stdin
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba', // Canvas xuất ra định dạng RGBA
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', 'pipe:0',

  // Input 1: Luồng Camera hoặc Video nền (Ví dụ dùng Test pattern cho dễ chạy)
  // Thực tế: Thay bằng '-f', 'dshow', '-i', 'video="Tên Camera"' (trên Windows)
  '-f', 'lavfi', 
  '-i', `testsrc=size=${WIDTH}x${HEIGHT}:rate=${FPS}`, 

  // Filter: Overlay Canvas (Input 0) đè lên Camera (Input 1)
  '-filter_complex', '[1:v][0:v]overlay=0:0[out]',
  '-map', '[out]',

  // Encoding: Sử dụng CPU libx264 (Đổi thành h264_nvenc nếu có VGA NVIDIA)
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-b:v', '4000k',
  '-maxrate', '4500k',
  '-bufsize', '8000k',
  '-pix_fmt', 'yuv420p',
  '-g', `${FPS * 2}`, // Keyframe 2s
  
  '-f', 'flv',
  RTMP_URL
]);

ffmpeg.stderr.on('data', (data) => {
  // Bỏ comment dòng dưới để debug FFmpeg
  // process.stdout.write(data.toString()); 
});

// ==========================================
// 3. VÒNG LẶP RENDER TRÒ CHƠI (GAME LOOP)
// ==========================================
console.log('Khởi động Game Loop...');

setInterval(() => {
  // 1. Xóa nền trong suốt cho frame mới
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // 2. Vẽ UI Bảng Xếp Hạng
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(50, 100, 980, 400);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 50px Arial';
  ctx.fillText('🏆 TOP CHỐT ĐƠN', 100, 180);

  ctx.font = '40px Arial';
  gameState.leaderboard.forEach((user, index) => {
    ctx.fillText(`${index + 1}. ${user}`, 100, 260 + (index * 60));
  });

  // 3. Vẽ Animation Lottie (Nếu đang kích hoạt trúng thưởng)
  if (gameState.showCelebration && lottieFile) {
    lottieFile.seekFrame(gameState.lottieFrame);
    lottieFile.render(ctx);

    gameState.lottieFrame++;
    // Tắt hiệu ứng khi chạy hết frame
    if (gameState.lottieFrame >= lottieFile.frames) {
      gameState.showCelebration = false;
      gameState.lottieFrame = 0;
    }
  }

  // 4. Trích xuất Buffer thô và Bơm vào stdin của FFmpeg
  const buffer = canvas.toBuffer('raw');
  
  // Xử lý Backpressure (Tránh kẹt RAM nếu FFmpeg encode không kịp)
  if (ffmpeg.stdin.writable) {
    ffmpeg.stdin.write(buffer);
  }
}, FRAME_TIME);

// ==========================================
// 4. KÍCH HOẠT TƯƠNG TÁC THỜI GIAN THỰC
// ==========================================
// Sử dụng Server HTTP/WebSocket siêu tốc tích hợp sẵn của Bun
serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    
    // API Giả lập kích hoạt hiệu ứng nổ pháo hoa từ hệ thống chốt đơn
    if (url.pathname === '/trigger-win') {
      gameState.showCelebration = true;
      gameState.lottieFrame = 0;
      return new Response("Kích hoạt hiệu ứng thành công!");
    }
    
    return new Response("Hệ thống Livestream Headless đang chạy.");
  }
});
console.log('API Controller chạy tại http://localhost:3000');
```

---

## 4. Tối Ưu Hóa & Vận Hành Khối Lượng Lớn

Để hệ thống hoạt động ổn định liên tục trong các phiên Mega Sale (hàng giờ đồng hồ), cần áp dụng các biện pháp tối ưu sau:

### Hardware Acceleration (Tăng tốc phần cứng)
Mặc định trong code mẫu dùng `libx264` (CPU). Nếu hệ thống chạy trên End Devices có Card đồ họa, bắt buộc phải thay đổi thông số `-c:v` trong mảng lệnh của FFmpeg để giải phóng CPU cho Node.js:
* **NVIDIA:** Dùng `h264_nvenc` kết hợp `-preset p4`.
* **Intel:** Dùng `h264_qsv`.
* **AMD:** Dùng `h264_amf`.

### Xử lý Backpressure trên Standard Input (stdin)
Buffer ảnh Raw RGBA rất lớn (~8MB mỗi khung hình cho độ phân giải 1080x1920). Nếu FFmpeg bị quá tải (do mạng chậm hoặc encode chậm), hàm `stdin.write()` sẽ dội ngược (backpressure) làm tràn RAM của Bun. Luôn kiểm tra `ffmpeg.stdin.writable` trước khi đẩy buffer mới và cân nhắc drop frame (bỏ qua khung hình) nếu ống dẫn dữ liệu bị kẹt.

### Asset Caching
Với các file Lottie hoặc hình ảnh tĩnh (Avatar người chơi, Logo thương hiệu, Khung nền sản phẩm), phải dùng hàm nạp (`Image` hoặc `LottieAnimation.loadFromFile`) một lần duy nhất lúc khởi động ứng dụng và lưu vào biến toàn cục. Tuyệt đối không nạp lại file từ ổ cứng bên trong vòng lặp `setInterval`.

### Thay Thế Nguồn Video Linh Hoạt
Lệnh FFmpeg mẫu sử dụng `testsrc` (Video pattern tạo giả). Trong môi trường thực tế, sửa đổi Input 1 (`-i`) để kết nối thiết bị chuyên dụng:
* **Windows Camera:** `'-f', 'dshow', '-i', 'video=Tên Camera Capture Card'`
* **Linux Camera:** `'-f', 'v4l2', '-i', '/dev/video0'`
* **Pull luồng RTMP khác:** `'-i', 'rtmp://local-network/live/camera_stream'`