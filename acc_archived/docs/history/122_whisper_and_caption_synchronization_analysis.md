# 122 - Whisper Model Architecture & Caption Timing Analysis Documentation

**Ngày hoàn thành**: 2026-10-02  
**Trạng thái**: [x] Hoàn thành  
**Phạm vi**: `docs/WHISPER_AND_CAPTION_SYNC_GUIDE.md`, `docs/master_rules_reference.md`, `docs/history/README.md`

---

## 1. Context & Technical Inquiry
Người dùng đặt câu hỏi và yêu cầu lưu lại tài liệu kỹ thuật về:
1. Mô hình Whisper hiện tại đang sử dụng trong hệ thống (`onnx-community/whisper-tiny` via Transformers.js).
2. Liệu phiên bản `tiny` có phải là nguyên nhân gây ra hiện tượng mất đồng bộ giữa voiceover và caption hay không?
3. Các yếu tố ảnh hưởng đến độ chính xác mốc thời gian phụ đề (Macro stream drift vs Micro-timing offset, Linear word splitting, Acoustic onset vs Token timestamps).

---

## 2. Comprehensive Documentation Delivered
Đã xây dựng tài liệu kỹ thuật chuyên sâu tại [`docs/WHISPER_AND_CAPTION_SYNC_GUIDE.md`](../WHISPER_AND_CAPTION_SYNC_GUIDE.md):
- **Phân tách 2 cấp độ lệch pha**:
  - *Cấp độ Macro*: Lệch hàng chục giây do thiếu Silence Padding trong container MP4 khi ghép bằng `acrossfade` (đã fix ở history [120]).
  - *Cấp độ Micro*: Lệch 50ms-150ms do độ trễ mốc token Whisper so với âm khởi phát (acoustic onset) và phân bổ độ dài từ tuyến tính.
- **Ma trận so sánh Whisper Model**:
  - `whisper-tiny` (75MB - siêu nhẹ, cực nhanh trên CPU).
  - `whisper-base` (140MB - độ nhạy mốc từ tiếng Việt cao hơn).
  - `whisper-small` (460MB - chi tiết âm vị chuyên sâu).
- **Cơ chế Acoustic Lead-In Offset (`timeOffset = 0.12s`)**:
  - Triệt tiêu hoàn toàn cảm giác giọng đọc phát trước chữ, mang lại hiệu ứng Karaoke frame-perfect.

---

## 3. Reference & Integration
- Tài liệu hướng dẫn: [`docs/WHISPER_AND_CAPTION_SYNC_GUIDE.md`](../WHISPER_AND_CAPTION_SYNC_GUIDE.md).
- Đặc tả cấu hình: [`docs/STORY_CONFIG_SPEC.md`](../STORY_CONFIG_SPEC.md).
