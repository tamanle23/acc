# Brainstorming & Architecture: Concrete Sample Materials for All 6 Pipelines

Tài liệu đặc tả kiến trúc, thiết kế và kế hoạch triển khai bộ tài nguyên mẫu hoàn chỉnh (**Sample Materials**) cho toàn bộ 6 Orchestrator Pipelines của hệ thống ACC (Automated Content Creator), đặt tại thư mục `./samples/`.

---

## 1. Mục tiêu & Bối cảnh (Context & Objectives)

Hiện tại dự án có thư mục `./sample-story` đại diện độc quyền cho **Pipeline 4 (Generative Storytelling)**. Để bảo đảm tính bao phủ toàn diện của kiến trúc Monorepo Turborepo, Universal Video IR v3.0.0, và hệ thống Universal Auto-Config Engine (`auto-config.ts`), hệ thống cần một thư mục `./samples/` chuẩn hóa chứa đầy đủ tài nguyên cho cả 6 Pipelines.

Bộ tài nguyên mẫu này phải đáp ứng 4 tiêu chuẩn bắt buộc:
1. **Phân loại tự động (Auto-Config Accuracy)**: `MediaAssetProberChain` và `PipelineClassifierRegistry` nhận diện chính xác từng thư mục tương ứng với Pipeline 1 đến 6 với độ tin cậy $\ge 85\%$.
2. **Bao phủ toàn diện hiệu ứng (SFX, VFX Overlays & 3D In-Depth Effects)**: Tích hợp đầy đủ các engine âm thanh (`sfx`), hiệu ứng đồ họa lớp phủ canvas/shader (`overlayComposite` / VFX), và hiệu ứng chiều sâu 3D thị sai (`depth3d`: Frame-Breaker, Parallax 2.5D, Volumetric Sandwich, Wigglegram, Isometric Podium).
3. **Đa dạng Artifact (Triple-Emission Parity)**: Mỗi thư mục mẫu sở hữu đầy đủ bộ 3 tệp cấu hình:
   - `story-config.json` (chuẩn schema `story-config.schema.json` hỗ trợ render legacy và FFI NVENC chunking)
   - `pipeline-ir.json` (Universal Video IR AST v3.0.0)
   - `omnichannel-config.json` (Fine-Grained Video Director Config 3-tier)
4. **Khả năng thực thi (Runnable & Zero-Regression)**: Thực thi thành công qua cả Main CLI (`acc run <pipeline> -c ./samples/...`) và Auto-Config CLI (`bun run auto-config.ts ./samples/... --yes`).

---

## 2. Ma trận Hiệu ứng SFX, VFX & 3D In-Depth xuyên suốt 6 Pipelines

| Pipeline | Thư mục Mẫu | Nghiệp vụ Cốt lõi | 3D In-Depth Effect (`depth3d`) | VFX Overlay Effect (`overlayComposite`) | Sound Design Cues (`sfx` & `bgm`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pipeline 1**<br>`scraper-summarizer` | `./samples/01-scraper-summarizer` | **AI & Tech Breaking News Digest**<br>Bản tin tóm tắt công nghệ thời gian thực | • **`isometric_billboard`**<br>• `plane_cast_shadow`<br>• Khung nổi tiêu đề tin tức | • **`camera_ui`** (viewfinder rec)<br>• **`digital_glitch`** (chuyển cảnh tiêu đề)<br>• **`light_leak`** | • `notification` chime (xuất hiện card)<br>• `whoosh` (headline wipe)<br>• `ui_click`<br>• BGM: High-tempo tech ambient |
| **Pipeline 2**<br>`db-templating` | `./samples/02-db-templating` | **Tech Market Adoption Race**<br>Biểu đồ Bar Chart Race 60 FPS từ dữ liệu CSV | • **`isometric_podium`**<br>• `perspective_grid`<br>• 60 FPS motion interpolation | • **`sci_fi_hud`** (thước đo telemetry)<br>• **`matrix_rain`** (dữ liệu số)<br>• **`audio_spectrum`** | • `data_stream` (âm thanh dữ liệu tần số cao)<br>• `sub_drop` (top 1 takeover)<br>• `tick` (tăng số liệu)<br>• BGM: Cyberpunk synthwave |
| **Pipeline 3**<br>`repurposing-recycler` | `./samples/03-repurposing-recycler` | **Viral Podcast Vertical Short**<br>Cắt trích hook podcast 9:16 & kinetic subtitles | • **`gyro_focal_tilt`**<br>• `rack_focus`<br>• Auto-reframe face tracking & zoom punch-in | • **`vhs`** (nhiễu băng từ vintage)<br>• **`speed_lines`** (nhấn mạnh punch-in)<br>• **`film_damage`** | • `pop` (kinetic karaoke subtitle pop)<br>• `whoosh` (punch-in zoom)<br>• `riser` (tạo kịch tính cho hook)<br>• BGM: Upbeat viral beat |
| **Pipeline 4**<br>`generative-storytelling` | `./samples/04-generative-storytelling` | **Mythological Fantasy Narrative**<br>Câu chuyện hoạt hình thần thoại đa phân cảnh | • **`volumetric_sandwich`** (chữ lồng sau lưng nhân vật)<br>• **`frame_breaker`** (nhân vật nhô ra khỏi khung)<br>• **`parallax_25d`** | • **`dust`** & **`embers`** (bụi phát sáng)<br>• **`fog`** (sương mù điện ảnh)<br>• **`god_rays`** (luồng sáng thần thánh) | • `cinematic_trailer_hit` (mở màn)<br>• `kaiju_roar` (tiếng gầm quái thú)<br>• `thunder` & `ambient_wind`<br>• BGM: Epic cinematic orchestral |
| **Pipeline 5**<br>`rule-logic` | `./samples/05-rule-logic` | **Math Proof & Logic Solver**<br>Chứng minh định lý Pythagoras dạng bảng phấn | • **`cutout_portal`**<br>• **`extruded_text_3d`**<br>• Hiệu ứng viết phấn từng bước | • **`confetti`** (ăn mừng khi có Q.E.D.)<br>• **`digital_glitch`** (chuyển bước logic)<br>• **`bokeh`** (chiều sâu bảng phấn) | • `chalk_write` (âm thanh viết phấn)<br>• `success_ding` / `bell` (hoàn tất chứng minh)<br>• `whoosh` (xóa bảng)<br>• BGM: Classical acoustic focus |
| **Pipeline 6**<br>`ambient-loops` | `./samples/06-ambient-loops` | **Cyberpunk Rain Lo-Fi Stream**<br>Không gian thư giãn vô tận lặp liền mạch 24/7 | • **`macro_bokeh`**<br>• **`vignette_tunnel`**<br>• Procedural particle depth shader | • **`rain_on_glass`** (giọt mưa chảy trên kính)<br>• **`starfield`** / **`smoke`**<br>• **`bokeh`** | • `rain_sound` (mưa rào ban đêm)<br>• `tape_hiss` (tiếng sôi đĩa than lo-fi)<br>• BGM: Infinite lo-fi study beat |

---

## 3. Cấu trúc Thư mục Chi tiết `./samples/`

```text
samples/
├── 01-scraper-summarizer/
│   ├── assets/
│   │   ├── editorial_cover.png
│   │   ├── bgm_tech.mp3
│   │   └── sfx_whoosh.wav
│   ├── breaking_news.md              # File tin tức Markdown > 150 từ kích hoạt Classifier 1
│   ├── source_feed.json              # Dữ liệu feed đầu vào cho Scraper Pipeline
│   ├── story-config.json             # Cấu hình video kèm SFX + VFX + 3D
│   ├── pipeline-ir.json              # Universal Video IR v3.0.0
│   ├── omnichannel-config.json       # Director Config
│   └── README.md
│
├── 02-db-templating/
│   ├── assets/
│   │   ├── brand_logo.png
│   │   ├── bgm_synth.mp3
│   │   └── sfx_data_blip.wav
│   ├── tech_market_adoption.csv      # File dữ liệu CSV > 15 dòng kích hoạt Classifier 2
│   ├── database_payload.json         # Entity payload đầu vào cho DB Pipeline
│   ├── story-config.json
│   ├── pipeline-ir.json
│   ├── omnichannel-config.json
│   └── README.md
│
├── 03-repurposing-recycler/
│   ├── assets/
│   │   ├── podcast_clip.mp4          # File video gốc > 30 giây kích hoạt Classifier 3
│   │   ├── bgm_viral.mp3
│   │   └── sfx_pop.wav
│   ├── repurpose_transcript.json     # Word-level timestamps & speaker positions
│   ├── transcript.txt
│   ├── story-config.json
│   ├── pipeline-ir.json
│   ├── omnichannel-config.json
│   └── README.md
│
├── 04-generative-storytelling/
│   ├── assets/
│   │   ├── scene1.png
│   │   ├── scene2.png
│   │   ├── voiceover1.mp3
│   │   ├── voiceover1.txt
│   │   ├── voiceover2.mp3
│   │   ├── voiceover2.txt
│   │   ├── bgm.mp3
│   │   └── sfx_impact.wav
│   ├── story-config.json             # Khớp tiêu chuẩn sample-story với 3D Sandwich & Frame Breaker
│   ├── pipeline-ir.json
│   ├── omnichannel-config.json
│   └── README.md
│
├── 05-rule-logic/
│   ├── assets/
│   │   ├── board_diagram.png
│   │   ├── bgm_classical.mp3
│   │   └── sfx_chalk.wav
│   ├── dialogue_logic_tree.txt       # Script chứa từ khóa choice/condition/branch kích hoạt Classifier 5
│   ├── proof_problem.json            # Step-by-step LaTeX formulas & explanations
│   ├── story-config.json
│   ├── pipeline-ir.json
│   ├── omnichannel-config.json
│   └── README.md
│
└── 06-ambient-loops/
    ├── assets/
    │   ├── lofi_sleep_beat_loop.mp3  # Audio loop chứa từ khóa loop/lofi kích hoạt Classifier 6
    │   ├── sfx_rain.wav
    │   └── ambient_texture.png
    ├── ambient_config.json           # Cấu hình shader, particle count, BPM
    ├── story-config.json
    ├── pipeline-ir.json
    ├── omnichannel-config.json
    └── README.md
```

---

## 4. Kế hoạch Thực thi (Execution Roadmap)

1. **Backlog & History Archival**:
   - Backlog: `docs/backlogs/033_concrete_samples_for_all_pipelines.md`.
   - History Record: `docs/history/186_concrete_samples_for_all_pipelines.md`.
2. **Tổng hợp Media Synthesizer**:
   - Sử dụng script Bun nhẹ nhàng (`@napi-rs/canvas` và PCM audio generation) để sinh các file ảnh PNG, file âm thanh WAV/MP3 chuẩn độ dài, và video MP4 hợp lệ mà không cần phụ thuộc vào external download nặng nề.
3. **Scaffolding tự động và Bổ sung Hiệu ứng SFX/VFX/3D**:
   - Dùng `AutoConfigEngineFacade.scaffoldDirectory` cho từng thư mục mẫu để tạo bộ khung IR và StoryConfig.
   - Bổ sung cấu hình chi tiết cho `depth3d`, `overlayComposite`, `sfx`, `bgm`, và `captions` theo đúng ma trận mục 2.
4. **Kiểm thử tự động (E2E Verification Suite)**:
   - Viết bài kiểm thử `autogenerated-tests/samples-scaffolding-verification.test.ts`.
   - Kiểm tra:
     - Khả năng crawl và phân tích của `MediaAssetProberChain`.
     - Phân loại đúng Pipeline 1–6 với $\text{confidence} \ge 0.85$.
     - Khả năng biên dịch và chạy dry-run của `cli.ts run <pipeline> -c ./samples/... -n`.
5. **Cập nhật Tài liệu**:
   - Cập nhật `README.md` và `docs/guide/CLI_GUIDE.md` dẫn chiếu đến `./samples/`.
