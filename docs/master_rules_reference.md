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
2. **Native Bun FFI Integration**:
   - TUYỆT ĐỐI KHÔNG dùng package `fluent-ffmpeg` hay `child_process.spawn('ffmpeg')`.
   - Lấy thư mục binary chứa `.dll`/`.so` qua `FFmpegManager.getBinDir()`.
   - Gọi các hàm C-API lõi thông qua module FFI tập trung (`src/core/ffmpeg-ffi/index.ts`):
   ```typescript
   import { initFFI, FFI } from './src/core/ffmpeg-ffi';
   import { FFmpegManager } from './src/core/FFmpegManager';
   
   await FFmpegManager.prepare();
   initFFI(); // Dynamic load libavcodec, libavformat, libswscale via dlopen()
   ```
3. **Zero-Copy Frame Memory Ingestion**:
   - Truyền mảng RGBA thuần trực tiếp từ Canvas sang `sws_scale` bằng `canvas.toBuffer('raw')` qua con trỏ `bun:ffi` mà không ghi file tạm hay ghi vào stream `stdin`.

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

