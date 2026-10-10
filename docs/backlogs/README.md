# 📋 Project Backlogs & Roadmap Index

Bảng theo dõi toàn bộ danh mục kế hoạch phát triển, tính năng tương lai và nợ kỹ thuật (Technical Debt) của dự án Visual Storytelling Generator.

---

## 📑 Bảng mục lục Backlog (Backlog Index)

| ID | Tiêu đề Hạng mục (Epic / Feature) | Phân hệ (Component) | Trạng thái (Status) | Ngày tạo | Ngày hoàn thành / Linked History |
| :--- | :--- | :--- | :---: | :---: | :--- |
| [`001`](001_cultural_captions.md) | Multi-Language Cultural Subtitles | Subtitles / Audio | ✅ `Completed` | 2026-09-26 | [`116_mark_all_backlogs_completed.md`](../history/116_mark_all_backlogs_completed.md) |
| [`002`](002_fauna_enum_standardization.md) | Story Config Enum Standardization for Fauna | Schema / Sound FX | ✅ `Completed` | 2026-09-26 | [`116_mark_all_backlogs_completed.md`](../history/116_mark_all_backlogs_completed.md) |
| [`003`](003_spatial_3d_audio.md) | Spatial & 3D Audio for Sound Effects | Audio DSP / FFmpeg | ✅ `Completed` | 2026-09-27 | [`116_mark_all_backlogs_completed.md`](../history/116_mark_all_backlogs_completed.md) |
| [`004`](004_procedural_ui_synth.md) | Procedural Synth & MIDI for UI Sounds | Sound FX CLI | ✅ `Completed` | 2026-09-27 | [`047_procedural_ui_synth.md`](../history/047_procedural_ui_synth.md) |
| [`005`](005_auto_ducking_composites.md) | Advanced Auto-Ducking Composites | Audio / FFmpeg | ✅ `Completed` | 2026-09-27 | [`049_auto_ducking_composites.md`](../history/049_auto_ducking_composites.md) |
| [`006`](006_overlay_effects_dag_migration.md) | Migrate Overlay Effects to FFmpegFilterGraph DAG | Overlay CLI / Core | ✅ `Completed` | 2026-09-27 | [`053`](../history/053_ffmpeg_filtergraph_dag_phase_2.md), [`116`](../history/116_mark_all_backlogs_completed.md) |
| [`007`](007_pipeline_orchestrator_phase_3.md) | Isolated Pipeline Architecture (Phase 3) | Architecture / Core | ✅ `Completed` | 2026-09-27 | [`072`](../history/072_phase0_turborepo_monorepo_scaffolding.md), [`077`](../history/077_phase5_specialized_pipelines_db_repurpose_rule_ambient.md), [`116`](../history/116_mark_all_backlogs_completed.md) |
| [`008`](008_3d_depth_pop_out_suite.md) | 3D Depth & Visual Pop-Out Effects Suite | 3D Depth Engine | ✅ `Completed` | 2026-09-27 | [`046`](../history/046_3d_depth_backlog_and_frame_breaker.md), [`047`](../history/047_all_3d_depth_engines_implementation.md) |
| [`009`](009_gpu_acceleration_enhancement_suite.md) | Full GPU Acceleration & Hardware Encoding Enhancement Suite | Core Engine / Hardware Accel | ✅ `Completed` | 2026-09-30 | [`079`](../history/079_encoding_strategy_pattern_refactor.md), [`083`](../history/083_backlog_gpu_acceleration_enhancement_suite.md), [`116`](../history/116_mark_all_backlogs_completed.md) |
| [`010`](010_huggingface_transformers_js_sam_depth.md) | Native In-Process SAM & Depth via @huggingface/transformers | Effect Engines / Vision | ✅ `Completed` | 2026-10-01 | [`089_huggingface_transformers_js_vision_strategy_pattern.md`](../history/089_huggingface_transformers_js_vision_strategy_pattern.md) |
| [`011`](011_vision_segmentation_optimization_and_birefnet_acceleration.md) | Vision Segmentation Optimization & BiRefNet Acceleration | Effect Engines / Vision | ✅ `Completed` | 2026-10-01 | [`092_vision_segmentation_optimization_and_benchmark.md`](../history/092_vision_segmentation_optimization_and_benchmark.md) |
| [`012`](012_unify_all_6_pipelines_under_orchestrator.md) | Unify All 6 Pipelines Under Orchestrator & Middleware Architecture | Core Architecture / Orchestrator | ✅ `Completed` | 2026-10-02 | [`123_unify_all_6_pipelines_under_orchestrator.md`](../history/123_unify_all_6_pipelines_under_orchestrator.md) |
| [`013`](013_ir_pipeline_feature_parity.md) | IR Pipeline (processAndRender) Feature Parity with renderStoryVideo | Core Architecture / Orchestrator | ✅ `Completed` | 2026-10-06 | [`157_pillar1_parity_and_ssot_consolidation.md`](../history/157_pillar1_parity_and_ssot_consolidation.md) |
| [`018`](018_universal_video_ir_rendering_engine.md) | Universal Video IR Rendering Engine (Phases 1-6) | Core Architecture / Universal IR | ✅ `Completed` | 2026-10-09 | [`147_universal_video_ir_phase6_execution.md`](../history/147_universal_video_ir_phase6_execution.md) |
| [`019`](019_enterprise_ir_phase1_parallel_chunking.md) | Enterprise Universal IR High-Throughput Parallel Temporal Chunking (Phase 1) | Core Architecture / Universal IR | ✅ `Completed` | 2026-10-10 | [`169_enterprise_ir_phase1_parallel_chunking.md`](../history/169_enterprise_ir_phase1_parallel_chunking.md) |
| [`020`](020_canonical_pipeline_4_ir_migration.md) | Canonical Pipeline 4 Migration & Legacy Deprecation (Phase 2) | Core Architecture / Generative Story Pipeline | ✅ `Completed` | 2026-10-11 | [`170_canonical_pipeline_4_ir_migration.md`](../history/170_canonical_pipeline_4_ir_migration.md) |
| [`021`](021_enterprise_resilience_phase3.md) | Enterprise Resilience, VRAM Isolation & SAGA Workflows (Phase 3) | Core Architecture / Resilience & Resource Isolation | ✅ `Completed` | 2026-10-11 | [`171_enterprise_resilience_phase3.md`](../history/171_enterprise_resilience_phase3.md) |
| [`022`](022_omnichannel_pipelines_phase4.md) | Omnichannel Pipelines 1, 2, 3 Expansion via Output Modality Routing (Phase 4) | Omnichannel Pipelines / Universal IR | ✅ `Completed` | 2026-10-11 | [`172_omnichannel_pipelines_phase4.md`](../history/172_omnichannel_pipelines_phase4.md) |
| [`023`](023_enterprise_telemetry_security_phase5.md) | Zero-Trust Security, Dynamic Secrets & Observability (Phase 5) | Core Architecture / Telemetry & Security | ✅ `Completed` | 2026-10-11 | [`173_enterprise_telemetry_security_phase5.md`](../history/173_enterprise_telemetry_security_phase5.md) |
| [`024`](024_enterprise_tier5_chaos_hardening.md) | 5-Tier Continuous Quality Engineering & Chaos Hardening (Phase 6) | Enterprise QA / Chaos Hardening | ✅ `Completed` | 2026-10-11 | [`174_enterprise_tier5_chaos_hardening.md`](../history/174_enterprise_tier5_chaos_hardening.md) |
| [`025`](025_concrete_strategies_250_content_types.md) | Concrete Content Task Strategies for All 250 Content Variations | Core Architecture / Content Strategies | ✅ `Completed` | 2026-10-11 | [`176_concrete_strategies_250_content_variations.md`](../history/176_concrete_strategies_250_content_variations.md) |

---

## 📌 Chuyên đề Kỹ thuật Mở rộng (Deep Specifications)
- 🧊 **Đặc tả Toán học & Thuật toán 3D Depth**: Xem chi tiết tại [`3D_DEPTH_BACKLOG.md`](3D_DEPTH_BACKLOG.md).

---

*Quy tắc quản lý và cập nhật Backlog bắt buộc được định nghĩa tại [`.agents/rules/backlog-management.md`](../../.agents/rules/backlog-management.md) và [`AGENTS.md`](../../AGENTS.md).*
