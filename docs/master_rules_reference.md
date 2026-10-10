# Master Rules & Architectural Reference (Source of Truth)

Tài liệu tham chiếu toàn diện chứa đầy đủ ngữ cảnh, lý do thiết kế (rationale), ví dụ code và hướng dẫn chi tiết của tất cả quy tắc trong dự án Visual Storytelling Generator.

---

## 1. Architectural Standards & Defensive Coding

### Context & Rationale
Dự án đang chuyển dịch sang kiến trúc Middleware Pipeline độc lập (xem `docs/ARCHITECTURE_VISION.md`). Để tránh làm cho lõi đơn khối (`src/renderer.ts`) trở nên dễ vỡ trong quá trình chuyển đổi, tất cả agent và nhà phát triển phải tuân thủ nghiêm ngặt các tiêu chuẩn kiến trúc phòng thủ.

### Detailed Requirements
1. **Defensive Fallbacks mandatory**:
   - Không bao giờ cho phép một tính năng thử nghiệm hoặc tiến trình con (AI/Sub-process) làm sập vòng lặp render chính.
   - BẮT BUỘC bọc tất cả các thao tác gọi bên ngoài, volatiles hoặc nặng (như VieNeu-TTS, AI Upscaling, 3D Depth, Sound Effects) trong khối `try/catch`.
   - Khối `catch` BẮT BUỘC phải ghi log cảnh báo (`console.warn`) và cung cấp phương án dự phòng mượt mà (fallback seamless):
     - Lỗi AI Upscale $\rightarrow$ Fallback về ảnh gốc chưa upscale.
     - Lỗi 3D Depth $\rightarrow$ Fallback về render 2D truyền thống.
     - Lỗi TTS $\rightarrow$ Fallback về audio đệm hoặc bỏ qua cảnh.

2. **State Immutability**:
   - Tránh biến đổi dữ liệu trực tiếp (destructive in-place mutation) trên các đối tượng `ResolvedStoryConfig` hoặc `SceneConfig`.
   - Khi một tính năng sinh ra asset mới (ảnh upscaled, audio TTS, video composite), không ghi đè mù quáng lên file gốc. Giữ asset gốc làm phương án dự phòng.

3. **FFmpeg Filtergraph Hygiene**:
   - Khi dựng chuỗi `filter_complex`, phải cực kỳ cẩn trọng với nhãn stream (ví dụ `[v_out_1]`).
   - KHÔNG bao giờ tái sử dụng tên stream chung chung. Luôn gắn identifier hoặc index duy nhất để tránh xung đột tên stream làm sập FFmpeg.
   - Tránh nối chuỗi string quá dài và rối rắm. Phân tách filtergraph thành các mảng/khối nhỏ có comment trước khi join.

4. **Align with Architecture Vision**:
   - Trước khi thiết kế tính năng lớn trong `renderer.ts`, hãy đối chiếu `docs/ARCHITECTURE_VISION.md` để đảm bảo code hướng tới tính mô-đun hóa.

---

## 2. Cross-Platform & Backward Compatibility

### Context & Rationale
Hệ thống chạy trên Bun/Node.js hỗ trợ đa nền tảng (Windows, Linux, macOS). Công cụ có thể chạy trực tiếp bằng source hoặc compiled binary.

### Detailed Requirements
1. **Cross-Platform Compatibility**:
   - Code, scripts và thư viện phải hoạt động trên Windows, Linux, và macOS.
   - Khi tải hoặc gọi binary bên ngoài (`ffmpeg`, `ffprobe`, `realesrgan-ncnn-vulkan`), kiểm tra động `process.platform` (`win32`, `linux`, `darwin`) và `process.arch` (`x64`, `arm64`).
   - Tải chính xác variant binary phù hợp với OS/architecture của người dùng.
   - Xử lý đuôi file theo OS (ví dụ thêm `.exe` riêng cho Windows).
   - Đảm bảo quyền thực thi trên Unix systems (`chmod +x`).
   - KHÔNG bao giờ hardcode đường dẫn file dạng OS-specific (như `C:\...` hay `/usr/...`). Luôn dùng module `path` của Node.js (dùng `path.join`, `path.resolve`).

2. **Backward Compatibility Guarantee**:
   - Tất cả thuộc tính mới trong `story-config.json` hay CLI flags BẮT BUỘC là **OPTIONAL** với fallback an toàn.
   - File cấu hình cũ tạo ở các phiên bản trước phải tiếp tục biên dịch và render thành công mà không báo lỗi thiếu trường.

---

## 3. FFmpeg Manager & Zero-Copy Bun FFI Protocol

### Context & Rationale
Bộ quản lý `FFmpegManager` tự động phát hiện hoặc tải các bản dựng **FFmpeg Shared Build** chứa các thư viện động (`.dll`, `.so`, `.dylib` như `libavcodec`, `libavformat`, `libswscale`, `libavfilter`).
Dự án đã hoàn toàn loại bỏ `fluent-ffmpeg` và các tiến trình con `child_process.spawn('ffmpeg')` để giải phóng nghẽn cổ chai IPC/Pipe bộ nhớ. Mọi thao tác xử lý khung hình 4K và mã hóa video được truyền trực tiếp qua con trỏ bộ nhớ (Pointer) của mảng RGBA từ Canvas vào C space bằng `bun:ffi`.

### Usage Rules
1. **Initialization**: Tất cả entrypoint CLI (`cli.ts`, `auto-config.ts`, `sound-effects-cli.ts`) MUST khởi tạo manager trước khi xử lý:
   ```typescript
   import { FFmpegManager } from './src/core/FFmpegManager';
   async function main() {
     await FFmpegManager.prepare();
     // rest of logic
   }
   ```
2. **Native Bun FFI Integration & Absolute Ban on Subprocess Spawning**:
   - **TUYỆT ĐỐI KHÔNG** sử dụng `Bun.spawnSync`, `Bun.spawn`, `child_process.spawn`, `child_process.exec`, `execSync`, hay `fluent-ffmpeg` để invoke/gọi `ffmpeg` hoặc `ffprobe`.
   - Tất cả các thao tác liên quan đến media (decode video frame, canvas capture, depth 3D mesh rendering, audio resampling/DSP, AAC encoding, lossless bitstream stream copy / concat muxer) **BẮT BUỘC** phải load và tương tác trực tiếp với các shared libraries (`libavcodec`, `libavformat`, `libavutil`, `libswscale`, `libswresample`, `libavfilter`) qua `bun:ffi`.
   - Lấy thư mục binary chứa `.dll`/`.so` qua `FFmpegManager.getBinDir()`.
   - Gọi các hàm C-API lõi thông qua module FFI tập trung (`packages/core/src/ffmpeg-ffi/index.ts`):
   ```typescript
   import { initFFI, FFI } from '@acc/core';
   import { FFmpegManager } from '@acc/core';
   
   await FFmpegManager.prepare();
   initFFI(); // Dynamic load libavcodec, libavformat, libswscale, libswresample, libavfilter via dlopen()
   ```
3. **Zero-Copy Frame Memory Ingestion**:
   - Truyền mảng RGBA thuần trực tiếp từ Canvas sang `sws_scale` bằng `canvas.toBuffer('raw')` qua con trỏ `bun:ffi` mà không ghi file tạm hay ghi vào stream `stdin`.
4. **Defensive Pointer Casting**:
   - Mọi phép tính offset bộ nhớ con trỏ với BigInt (ví dụ `srcPtr + 64n`, `dstPtr + 64n`) BẮT BUỘC phải ép kiểu con trỏ gốc tường minh qua `BigInt(ptr)` trước khi cộng để tránh lỗi `TypeError: Invalid mix of BigInt and other type in addition`.

---

## 4. CLI Distribution & Global Storage Directory

### Context & Rationale
Để đảm bảo công cụ có thể biên dịch thành file thực thi độc lập (standalone binary với `bun build --compile`) hoặc cài đặt global (`npm install -g`), ứng dụng không được sử dụng `__dirname` hay đường dẫn tương đối để lưu dữ liệu tải về.

### Requirements
1. **Global App Directory**: Tất cả binary tải về (FFmpeg, Real-ESRGAN, AI models `.bin`) KHÔNG ĐƯỢC lưu trong thư mục dự án hay `__dirname`.
2. **Directory Resolution**: Đặt tại thư mục Home của người dùng dưới namespace `.acc`:
   - `path.join(os.homedir(), '.acc', ...)`
3. **Lý do**:
   - Đường dẫn `__dirname` bị hạn chế/chỉ đọc trong compiled binaries.
   - Tránh lỗi phân quyền ghi (`EACCES`) khi công cụ được cài ở `/usr/local/bin` hoặc `C:\Program Files`.
   - Tránh tải lại file nặng nhiều lần giữa các dự án.

---

## 5. Numbered History Archival & Git Commit Protocol

### Context & Rationale
Để theo dõi và quản lý mọi thay đổi (bug fix, refactor, tính năng mới), hệ thống áp dụng nhật ký đánh số 3 chữ số kèm quy trình commit Git tự động.

### Detailed Protocol
1. **Numbered History File (`docs/history/XXX_<task_description>.md`)**:
   - Đánh số thứ tự 3 chữ số tuần tự (`001_...`, `002_...`, `003_...`).
   - Cấu trúc bắt buộc:
     - `# [XXX] Task Title`
     - `1. Context & Problem Statement`: Lý do/vấn đề cần giải quyết.
     - `2. Implementation Plan`: Thiết kế kiến trúc & 8-point checklist.
     - `3. Changes Made`: Danh sách chi tiết file sửa đổi và diff.
     - `4. Verification & Walkthrough`: Lệnh kiểm thử, log CLI, kết quả.
2. **History Index (`docs/history/README.md`)**:
   - Cập nhật bảng tổng hợp gồm: ID, Ngày, Tên gói công việc, Phạm vi thay đổi.
3. **Git Commit Protocol**:
   - Sau khi kiểm thử thành công và ghi file history, BẮT BUỘC thực hiện commit Git:
     ```bash
     git add .
     git commit -m "[XXX] Task Title" -m "Brief description of changes."
     ```
     Trong đó `[XXX]` khớp với ID 3 chữ số của file history.

---

## 6. Import Integrity & Refactoring Rule

### Context & Rationale
Khi sửa đổi file hoặc refactor lớn, nguy cơ thiếu `import` dẫn tới lỗi runtime `ReferenceError` là rất cao.

### Detailed Requirements
1. **Never Assume Imports Exist**: Khi thêm bất kỳ hàm hay dependency mới, kiểm tra dòng `import` ở đầu file.
2. **Preserve Block Integrity**: Khi dùng các tool edit file (`replace_file_content`), giữ nguyên khối `import` ở đầu file, không cắt xén nhầm.
3. **Sanity Check**: Dùng grep/view_file xác nhận symbol đã được import.
4. **Type Check**: Chạy kiểm tra kiểu/biên dịch trước khi báo hoàn thành.

---

## 7. Zero Regression & Workflow Stability Rule

### Context & Rationale
Hệ thống tích hợp nhiều luồng xử lý phức tạp (render, transition, subtitle, 3D depth, sound effects, B-roll video). Thay đổi nhỏ ở một module không được gây side-effect lên các luồng khác.

### Detailed Requirements
1. **Zero Regression Guarantee**: Mọi thay đổi BẮT BUỘC không làm hỏng bất kỳ luồng hoạt động sẵn có nào.
2. **Side-Effect Awareness**: Trước khi xóa code hay đổi chữ ký hàm, tra cứu toàn bộ nơi gọi hàm đó.
3. **Strict Code Replacement**: Giữ nguyên logic xung quanh, fallbacks và xử lý lỗi khi thay thế code.
4. **End-to-End Test**: Đảm bảo các cấu hình cũ (legacy config) vẫn biên dịch và render hoàn hảo.

---

## 8. Story-Config 8-Point Synchronization Protocol

### Context & Rationale
Mỗi khi thay đổi schema, thuộc tính, presets hoặc hành vi của `story-config.json`, BẮT BUỘC thực hiện đồng bộ đầy đủ 8 thành phần:

1. **TypeScript Definitions (`src/types.ts`)**: Cập nhật interface, types, docstrings.
2. **JSON Schema (`schema/story-config.schema.json`)**: Cập nhật schema validation.
3. **Specification Document (`docs/STORY_CONFIG_SPEC.md`)**: Cập nhật bảng thuộc tính, ví dụ JSON.
4. **Dedicated Feature Guides (`docs/..._GUIDE.md`)**: Tạo hoặc cập nhật guide hướng dẫn riêng (ví dụ `VIDEO_SCENES_GUIDE.md`, `OVERLAY_EFFECTS_CLI.md`).
5. **Core Renderer & Main CLI (`cli.ts`, `src/renderer.ts`, `src/styles.ts`, `src/platforms.ts`)**: Sửa logic parse, fallback và FFmpeg execution.
6. **Auto-Config Tool (`auto-config.ts`)**: Cập nhật template sinh config mặc định.
7. **Sample Story Config (`sample-story/story-config.json`)**: Cập nhật sample config và chạy `bun run cli.ts ./sample-story` để test end-to-end.
8. **Project Readme (`README.md`)**: Cập nhật Cheat Sheet và các link tài liệu.

---

## 9. Overlay Effects CLI: Architecture & Catalog Rules

### Architecture Principles
- **Strategy Pattern & Polymorphic CLI**: Lệnh `--effect <name> --variant <variant_name>`. Mỗi effect triển khai một strategy class.
- **Zero-Disk Pipeline**: Không xuất ảnh tĩnh ra đĩa. Render thẳng từng frame từ HTML5 Canvas (`@napi-rs/canvas`) ra Raw RGBA Buffer và pipe vào `stdin` của FFmpeg.
- **Seamless & Polyrhythmic Looping**: Đảm bảo khớp tọa độ frame đầu/cuối hoặc crossfade opacity. Hỗ trợ thời lượng số nguyên tố (3s, 5s, 7s, 11s) để khi chồng lớp không bị lặp hình.
- **Overlay Methods & Codecs**:
  - `alpha`: Nền trong suốt `rgba(0,0,0,0)`, WebM (`libvpx-vp9`), filter `overlay=shortest=1`.
  - `screen`: Nền đen `#000000`, MP4 (`libx264`), filter `blend=all_mode=screen`.
  - `multiply`: Nền trắng `#FFFFFF`, MP4 (`libx264`), filter `blend=all_mode=multiply`.
  - `overlay`: Nền xám 50% `#808080`, MP4 (`libx264`), filter `blend=all_mode=overlay`.
- **Companion Metadata**: Xuất file `.json` đi kèm chứa cấu hình blend mode, resolution, fps, duration và filter snippet.

---

## 10. Sound Effects CLI: Architecture & Catalog Rules

### Architecture Principles
- **CLI Pattern**: `--effect <name> --variant <name> --sub-variant <name>`.
- **Engine Selection**:
  - `library` (Freesound): Fauna (tiếng động vật), Diegetic (thời tiết thật, giao thông), Foley thực tế.
  - `ai` (Deep Learning): Sci-Fi (lasers, tàu vũ trụ), Cinematic (braams, risers), Sinh vật hư cấu.
  - `ffmpeg` (Procedural): UI (clicks, beeps), âm thanh toán học, composite layering (`amix`).
- **3-Layer Frequency Blueprint for Composites**:
  1. Transient / Attack (Highs: 2kHz - 8kHz)
  2. Body / Texture (Mids: 300Hz - 2kHz)
  3. Weight / Sub (Lows: 40Hz - 120Hz)

## 11. Backlog Management & Incremental Tracking Rule

**Context:** Features, architectural refactors, and technical debt are frequently deferred to the project backlog. Without a standardized, incremental convention, backlog items become disorganized, orphaned, or unverified against implemented work.

---

### 1. Incremental Numbering Protocol
* Whenever an idea, feature, or refactor is added to the backlog:
  - Assign a sequential 3-digit number (`001`, `002`, `003`, etc.).
  - Create a dedicated markdown file in `docs/backlogs/XXX_<epic_name>.md`.
* Each backlog file **MUST** contain:
  - Header metadata: `Status` (initially `⏳ [ ] Planned`), `Component`, `Created Date`, `Completed Date`, `Linked History`.
  - **Context & Problem Statement**: Why this is needed and what problem it solves.
  - **Proposed Design & Implementation Ideas**: Architectural sketch and key concepts.
  - **Acceptance Criteria**: Checkbox list defining what constitutes completion.

### 2. Master Backlog Index Synchronization (`docs/backlogs/README.md`)
* Every backlog item **MUST** be recorded in the master table at `docs/backlogs/README.md`.
* The table must maintain: ID, Title, Component, Status (`Planned` vs `Completed`), Created Date, and Linked History.

### 3. Completion Marking Protocol (Zero Orphan Epics)
* When ANY implementation task is completed that fulfills a backlog item:
  - Open the corresponding `docs/backlogs/XXX_<epic_name>.md` file.
  - Change status to `✅ [x] Completed`.
  - Fill in `Completed Date` and add a link to the History record: `Linked History: [YYY_...md](../history/YYY_...md)`.
  - Mark checkboxes `[x]` in the Acceptance Criteria.
  - Update `docs/backlogs/README.md` status column to `✅ Completed` and link to the history file.

### 4. Never Create Unnumbered Dump Files
* Do not dump unformatted notes into generic text files. All future items must follow the sequential incremental convention in `docs/backlogs/`.

---

## 12. Automated Unit Testing & Test Reusability Protocol (`/autogenerated-tests`)

### Context & Rationale
Trong quá trình phát triển và gỡ lỗi (debugging/profiling), các agent thường có xu hướng tạo ra các file test tạm bợ (ad-hoc scratch scripts như `stress_test.ts`, `test-ffi.ts`) ở thư mục gốc và sau đó xóa bỏ sau khi hoàn thành phiên làm việc. Điều này gây lãng phí công sức, đánh mất các kịch bản kiểm thử biên (edge cases) và ngăn cản việc hồi quy (regression testing) trong các vòng lặp phát triển tiếp theo.

### Detailed Requirements
1. **Mandatory Test Directory (`/autogenerated-tests`)**:
   - TUYỆT ĐỐI KHÔNG tạo các script test tạm bợ nằm rải rác ở thư mục gốc của repository.
   - Mọi mã kiểm thử (unit test, integration test, stress test, performance benchmark) BẮT BUỘC phải được tổ chức thành các file test chính thức trong thư mục `/autogenerated-tests/` (ví dụ: `autogenerated-tests/stress_render.test.ts`, `autogenerated-tests/ffi_encoder.test.ts`).

2. **Bun Native Test Runner**:
   - Sử dụng framework kiểm thử tích hợp sẵn của Bun (`import { test, expect, describe, beforeAll, afterAll } from 'bun:test'`).
   - Đảm bảo các test case có assertion rõ ràng (`expect(...)`), xử lý cleanup tài nguyên tạm mượt mà, và thiết lập timeout thích hợp cho các tác vụ render nặng (`{ timeout: 60000 }`).

3. **Strict Test Retention & Reusability**:
   - TUYỆT ĐỐI KHÔNG xóa các file test sau khi sửa xong lỗi hoặc kết thúc tính năng.
   - Tất cả các bài test trong `/autogenerated-tests/` BẮT BUỘC phải được commit vào Git repository.
   - Trong mỗi vòng lặp phát triển hoặc trước khi đóng gói tính năng mới, agent BẮT BUỘC phải tái sử dụng và chạy lại bộ test (`bun test autogenerated-tests`) để đảm bảo không xảy ra hồi quy (zero regression).

4. **Self-Contained & Deterministic**:
   - Các file test phải tự cung tự cấp dữ liệu giả lập (mocking) hoặc tham chiếu tới tài nguyên mẫu có sẵn (như `sample-story`).
   - Các file sinh ra trong quá trình test phải được lưu trong thư mục tạm của hệ điều hành (`os.tmpdir()`) hoặc tự dọn dẹp sau khi kiểm thử kết thúc (`afterAll` / `afterEach`).



## 13. Performance Tuning & Asynchronous I/O Optimization Protocol

### Context & Rationale
Hệ thống tạo video, render đồ họa 3D, đọc/ghi file và nén codec (FFmpeg FFI) yêu cầu băng thông bộ nhớ và CPU lớn. Việc sử dụng các hàm đồng bộ (synchronous I/O) chặn (block) toàn bộ Node.js Event Loop, ngăn chặn hệ thống xử lý các tiến trình song song (như Conductor workers, networking, hoặc HTTP Webhooks), làm giảm nghiêm trọng thông lượng xử lý.

### Detailed Requirements
1. **Always Use Async `fs.promises`**: Mọi thao tác đọc/ghi file như (`fs.readFile`, `fs.writeFile`, `fs.readdir`, `fs.stat`) BẮT BUỘC sử dụng phiên bản bất đồng bộ `await fs.promises.*`. TUYỆT ĐỐI KHÔNG dùng `fs.readFileSync` hoặc `fs.writeFileSync` (ngoại trừ giai đoạn nạp cấu hình duy nhất ở lúc boot app ban đầu).
2. **Main Render Loop Non-blocking**: Trong các vòng lặp tạo khung hình liên tục (per-frame rendering) hoặc khởi tạo FFI, mọi hàm có thể block I/O hoặc network cần phải được pre-load bất đồng bộ trước.
3. **Yield Event Loop (`setImmediate` / `setTimeout`)**: Với các tác vụ tính toán CPU-bound rất nặng nề và lặp dài (như xử lý mảng raw pixels hoặc tensor math), phải thiết kế cơ chế nhường quyền điều khiển (yield loop) cho V8 Event Loop sau một số batch xử lý nhất định để GC (Garbage Collector) dọn dẹp bộ nhớ và tránh out-of-memory.
4. **Zero-Copy & Native Buffer Mapping**: Ưu tiên sử dụng `Buffer`, `ArrayBuffer`, và FFI C-structs bằng native pointer, giảm thiểu serialize/deserialize dữ liệu ảnh (JSON to Pixel Array).

---

## 14. Zero-Allocation Frame Loop & Native FFI Memory Invariance Protocol

### Context & Rationale
Trong quá trình kết xuất video (video rendering pipeline) với độ phân giải cao (ví dụ: Full HD dọc 1080x1920 cho TikTok/Reels hay 4K 3840x2160) chạy song song đa luồng (`concurrency = 6` workers), mỗi khung hình RGBA thuần chưa nén có kích thước từ 8.3 MB đến 33 MB.
Tại tốc độ render 30fps across 6 workers (tương đương 180 fps), nếu có bất kỳ hành vi sao chép buffer (như `Buffer.from(rgbaBuffer)`) hoặc cấp phát đối tượng JavaScript tạm thời (như `new BigUint64Array(...)`, `new Int32Array(...)`, tạo regex, mảng cụm từ lặp lại) diễn ra bên trong vòng lặp khung hình (`encodeRgbaFrame`, `renderFrame`, `drawCanvasCaptions`):
1. **Bùng nổ bộ nhớ rác (Garbage Churn > 1.5 GB/s)**: Vùng nhớ JavaScript Nursery Heap bị phình to liên tục, chạm trần giới hạn tiến trình (4.19 GB RSS) chỉ trong vài giây.
2. **Crash Segmentation Fault do GC Compaction**: Dưới áp lực dọn rác cực hạn (hàng triệu page faults), Garbage Collector của Bun di dời đối tượng trên heap (Heap Compaction) hoặc giải phóng các mảng tạm thời đúng vào thời điểm hàm C bên trong FFmpeg Shared Library (`sws_scale`, `avcodec_send_frame`) đang giải mã con trỏ bộ nhớ. Điều này dẫn tới việc truy cập địa chỉ không hợp lệ và làm sập tiến trình (`panic: Segmentation fault at address 0x...`).

Lỗi này từng được giải quyết ở commit [069] nhưng bị hồi quy (regression) ở commit `e57226c` do thiếu luật cưỡng chế rõ ràng đối với các agent/developer trong tương lai.

### Detailed Requirements
1. **ABSOLUTE BAN on Heap Cloning in Frame Loops**:
   - TUYỆT ĐỐI KHÔNG sử dụng `Buffer.from(rgbaBuffer)`, `new Uint8Array(buffer)`, hay bất kỳ thao tác clone buffer nào trong `encodeRgbaFrame`, `encodeRawFrame`, hoặc bên trong vòng lặp per-frame của bất kỳ scene renderer nào.
   - Luôn sử dụng trực tiếp con trỏ vùng nhớ `ptr(rgbaBuffer)` của buffer đã tồn tại.
2. **Pre-Allocated Native C Memory for FFI Pointer Arrays**:
   - Mọi mảng con trỏ dữ liệu và stride truyền vào các hàm C FFI (đặc biệt là `sws_scale`) BẮT BUỘC phải được cấp phát một lần duy nhất trong vùng nhớ C cố định thông qua `FFI.avutil.av_malloc(...)` ở giai đoạn `initialize()`.
   - TUYỆT ĐỐI KHÔNG cấp phát mảng tạm thời `new BigUint64Array(...)` hoặc `new Int32Array(...)` trên JavaScript heap trong mỗi frame.
   - Ghi địa chỉ con trỏ của frame trực tiếp vào bộ nhớ C cố định bằng `DataView` trên `safeArrayBuffer(this.srcDataC, 0, ...)`.
3. **Memoization / WeakMap Caching for Frame Helpers**:
   - Mọi thao tác tính toán phụ trợ lặp lại qua các frame (như phân nhóm cụm từ `groupPhrases`, biểu thức chính quy regex, tính toán trọng số âm tiết) BẮT BUỘC phải được lưu cache (ví dụ qua `WeakMap<T, ...>` hoặc khởi tạo 1 lần trước vòng lặp render).
   - TUYỆT ĐỐI KHÔNG thực hiện regex hay biến đổi cấu trúc mảng mới trên mỗi frame tick.

## 15. Multi-Track Timeline & Master Audio Architecture Protocol

### Context & Rationale
Hệ thống video hỗ trợ hai mô hình trục thời gian (Timebase Models):
1. **Per-Scene Model**: Thời lượng video là tổng thời lượng các phân cảnh tuần tự ($\sum \text{scene}_i$). Cần tính toán đệm chuyển cảnh (`dialogue clearance`) để tránh nuốt âm thanh.
2. **Master Audio Timeline Model (`settings.audioTrack`)**: 1 file Voiceover duy nhất đóng vai trò trục thời gian chủ quyền (Master Clock). Các phân cảnh hình ảnh/video (`scenes`) hoạt động như các clip nằm trên track video, chuyển cảnh không làm gián đoạn hoặc xê dịch âm thanh hay phụ đề.

Đồng thời, hệ thống hỗ trợ Track Sound Effects (`sfx`) ở cả cấp độ Scene (`scenes[].sfx`) và cấp độ Global (`settings.sfx`), tự động tích hợp vào DSP Graph để điều khiển sidechain ducking làm giảm âm lượng BGM mà không lấn át lời thoại.

### Detailed Requirements
1. **Single Source of Truth (`TimelineEngine`)**: Mọi track (`caption`, `video`, `audio`, `sfx`, `overlay`) phải đăng ký vào `TimelineEngine` theo Strategy Pattern. Trạng thái tại thời điểm $t$ là bất biến (immutable).
2. **Master Audio Immutability**: Trong chế độ `settings.audioTrack`, thời lượng video được khóa cứng theo độ dài của file master voiceover. Các clip hình ảnh/video phải tự động tính toán thời điểm bắt đầu/kết thúc dựa theo `duration` khai báo hoặc phân bổ đều.
3. **SFX Sidechain Priority Bus**: Khi `duckBgm: true` trong SFX clip, tín hiệu SFX phải được gom cùng bus thoại để kích hoạt bộ nén Sidechain làm chìm BGM, đảm bảo độ rõ nét của âm thanh.

## 16. ACC System Architecture Anchor Rule
**Rule**: `docs/SYSTEM_ARCHITECTURE_DOCUMENT.md` is the primary source of truth for the end-to-end ACC system architecture.
**Context**: As the ACC project scales across multiple workspaces, pipelines, and the Python gRPC backend, it is critical to maintain a single, cohesive architectural master blueprint. `docs/SYSTEM_ARCHITECTURE_DOCUMENT.md` was created to serve exactly this purpose. It contains detailed breakdowns of the Turborepo structure, Netflix Conductor OSS stateless orchestration, the 6 Canonical Pipelines (with step-by-step processing flows), AI Subsystems, UI control planes, and performance standards.
**Actionable Requirement**: Any future modifications, feature additions, or structural refactors that fundamentally alter the system's architecture, pipeline data flow, or structural dependencies must be accompanied by a synchronous update to `docs/SYSTEM_ARCHITECTURE_DOCUMENT.md`. This ensures the master blueprint never falls out of sync with the codebase.
---

## 17. Deterministic Headless Rendering & Handshake Backpressure Protocol

### Context & Rationale
Trong kiến trúc Universal Video IR (`packages/ir`), công đoạn rasterize khung hình headless (`IRMasterRenderer`) và encoder sink (`FFIVideoEncoderSink`) là nền tảng cốt lõi của tính năng Render phân tán (Distributed Temporal Chunking).
Để đảm bảo kết quả render trên mọi máy chủ, cloud worker hoặc luồng render cục bộ cho ra kết quả bit-identical (trùng khớp từng bit màu và từng byte âm thanh), hệ thống đặt ra 2 ràng buộc tuyệt đối (Hard Constraints):
1. **Deterministic Rendering (Không phụ thuộc Wall-Clock)**:
   - Mọi phép toán biến đổi hình ảnh, chuyển động góc xoay, scale, camera dolly, hạt bụi lơ lửng, gradient và karaoke highlight BẮT BUỘC phải là hàm số thuần túy (pure mathematical function) của chỉ số khung hình nguyên `globalFrame` hoặc đồng hồ thời gian rời rạc `timeSec = globalFrame / fps`.
   - TUYỆT ĐỐI KHÔNG sử dụng `Date.now()`, `performance.now()`, `Math.random()`, `setTimeout`, hoặc bất kỳ nguồn biến thiên thời gian thực tế nào bên trong render loop hoặc modifier plugin.
   - Mọi yếu tố ngẫu nhiên phải được sinh ra qua bộ giả ngẫu nhiên có seed cố định (`DeterministicNoiseGenerator`).
2. **Synchronous Frame Handshake Backpressure (`FrameBackpressureLock`)**:
   - Khung hình $t+1$ TUYỆT ĐỐI KHÔNG được phép render hoặc ghi đè buffer trước khi khung hình $t$ được xác nhận tiêu thụ hoàn tất (`acknowledge`) bởi Encoder Sink.
   - Cơ chế handshake này ngăn chặn 100% tình trạng frame drop (mất khung hình), biến dạng video do chạy đua bộ nhớ, hoặc rò rỉ buffer không kiểm soát khi producer chạy nhanh hơn consumer.
3. **Temporal Chunking Seamless Concatenation**:
   - Khi chia video thành các temporal chunks (`--chunk-start` / `--chunk-end`), khung hình tại biên giao nhau của chunk phải khớp hoàn toàn về trạng thái đồ họa và âm thanh với frame kế tiếp, cho phép nối chuỗi (FFmpeg concat) mà không bị giật, đen, hay lệch nhịp phụ đề.

### Detailed Requirements
1. **PURE-FRAME-DISCRETE**: Mọi biểu thức modifier trong `renderClipSpace`, `renderStreamSpace`, `renderMasterComposite` chỉ được nhận `timeSec = localFrame / fps` hoặc `localFrame`. Cấm dùng wall-clock thời gian thực.
2. **HANDSHAKE-INTEGRITY**: Trong `IRMasterRenderer.render`, cặp lệnh `await this.lock.acquire(f)` và `this.lock.acknowledge(f)` là bất khả xâm phạm. Không được phép bypass hoặc gọi bất đồng bộ chạy nền không đợi ack.
3. **BIT-IDENTICAL HASH VERIFICATION**: Bất kỳ tối ưu hóa hiệu năng nào trong tương lai đối với `IRMasterRenderer` hoặc modifier plugin đều BẮT BUỘC phải vượt qua bài kiểm tra `res1.cumulativeHash === res2.cumulativeHash` với 100% độ chính xác bit-identical.

