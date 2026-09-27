# 3D Depth & Visual Pop-Out Backlog Specification

Tài liệu này lưu trữ danh mục ý tưởng, thông số kỹ thuật, công thức toán học và lộ trình phát triển của các kỹ thuật **Tạo nổi 3D & Chiều sâu thị giác** (3D Depth / Pop-Out Effects) cho hệ thống Storytelling Video Generator.

---

## 🗺️ Lộ trình Phát triển (Roadmap)

| ID | Kỹ thuật 3D | Trạng thái | Độ phức tạp | Tác động thị giác |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **Out-of-Bounds (Frame-Breaker 3D Illusion)** | 🟢 **Đang thực thi (Active)** | Thấp - Trung bình | ⭐⭐⭐⭐⭐ (Cực kỳ bắt mắt trên Shorts/TikTok) |
| **02** | **2.5D Multiplane Parallax & Inpainting** | 🟡 **Backlog (Phase 2)** | Trung bình | ⭐⭐⭐⭐ (Chuẩn điện ảnh tài liệu Ken Burns) |
| **03** | **Sandwich Volumetric Stacking (Atmosphere & Rim Light)** | 🟡 **Backlog (Phase 3)** | Thấp | ⭐⭐⭐⭐ (Không gian sâu đa tầng khí quyển) |
| **04** | **AI Monocular Depth Map 3D Mesh Displacement** | 🔵 **Backlog (Phase 4)** | Cao | ⭐⭐⭐⭐⭐ (Khối 3D biến dạng thực thụ) |
| **05** | **Wigglegram / Stereoscopic 3D Shake** | 🔵 **Backlog (Phase 5)** | Trung bình | ⭐⭐⭐⭐ (Ảo giác thị sai chuyển động 2 mắt) |

---

## 🔬 Chi tiết Kỹ thuật Từng Phương pháp

---

### 1. Out-of-Bounds / Frame-Breaker 3D Illusion (Phase 1)
* **Ý tưởng:** Đặt bức ảnh vào một khung viền thẩm mỹ (Polaroid, Card, Cinema, Comic). Phần nền ảnh bị cắt gọn bên trong khung, nhưng phần đầu/thân trên hoặc chi tiết nhô ra của chủ thể được vẽ tràn ra ngoài viền khung kèm hiệu ứng đổ bóng (Drop Shadow 3D).
* **Kiểu khung hỗ trợ:**
  - `card`: Khung card bo góc hiện đại với nền mờ kính mờ (Glassmorphism).
  - `polaroid`: Khung ảnh chụp lấy liền cổ điển với viền dày đáy.
  - `cinema`: Viền phim màn ảnh rộng 2.35:1 (Cinemascope Matte).
  - `comic`: Khung truyện tranh action với nét viền đen đậm.
* **Cơ chế toán học:**
  - Background Masking: $M_{\text{inner}}(x, y) = 1$ khi $(x, y) \in \text{FrameRect}$, ngược lại $= 0$.
  - Foreground Pop-out: Phần trên $(y < y_{\text{split}})$ hoặc vùng bóc tách đối tượng được render không bị giới hạn bởi mask và có lớp bóng đổ $S(x, y + \Delta y, \sigma)$.
* **Chuyển động:** Dao động nhẹ 3D Floating Motion ($z$-rotation góc $\pm 1.5^\circ$ theo sóng hình $\sin$) tạo cảm giác tấm ảnh đang lơ lửng trong không gian 3 chiều.

---

### 2. 2.5D Multiplane Parallax & Inpainting (Phase 2)
* **Ý tưởng:** Tách ảnh thành 2 lớp Tiền cảnh (Foreground) và Hậu cảnh (Background). Dùng AI Inpainting để tái tạo vùng nền bị che khuất, sau đó di chuyển 2 lớp với vận tốc khác nhau khi camera zoom/pan.
* **Toán học & Chuyển động:**
  - Vận tốc di chuyển: $v_{\text{fg}} = k \times v_{\text{bg}}$ (với $k = 2.5 \sim 3.5$).
  - Dolly Zoom (Vertigo Effect): $\text{Scale}_{\text{fg}}(t) = 1.0 + 0.25t$, trong khi $\text{Scale}_{\text{bg}}(t) = 1.15 - 0.15t$.
  - Depth of Field (DOF): Áp dụng Gaussian Blur $\sigma = 3 \sim 6\text{px}$ cho Background.

---

### 3. Sandwich Volumetric Stacking (Phase 3)
* **Ý tưởng:** Xếp các lớp hiệu ứng lớp phủ (Overlay) kẹp trước và sau chủ thể.
* **Cấu trúc xếp tầng:**
  - `Layer 0`: Background tĩnh / xa.
  - `Layer 1`: Hiệu ứng khí quyển nền (Khói mờ, sương mù, tia nắng nhẹ).
  - `Layer 2`: Ánh sáng viền lưng chủ thể (Rim Light Glow) tạo bằng toán tử giãn nở biên (Morphological Dilate + Blur).
  - `Layer 3`: Chủ thể sắc nét (Subject).
  - `Layer 4`: Hiệu ứng tiền cảnh cận camera (Hạt mưa to, bụi bokeh nhòe).

---

### 4. AI Monocular Depth Map 3D Mesh Displacement (Phase 4)
* **Ý tưởng:** Sử dụng mô hình AI (Depth Anything V2 / Marigold) tạo bản đồ độ sâu đơn sắc (Grayscale Depth Map). Dùng WebGL/Shader chiếu ảnh lên lưới 3D và di chuyển camera 3D ảo.
* **Công thức Displacement:**
  $$Z(x, y) = \text{DepthMap}(x, y) \times Z_{\text{max}}$$
  $$P'(x, y, z) = \mathbf{M}_{\text{proj}} \times \mathbf{M}_{\text{view}}(\theta_x, \theta_y) \times \begin{bmatrix} x \\ y \\ Z(x, y) \\ 1 \end{bmatrix}$$

---

### 5. Wigglegram / Stereoscopic 3D Shake (Phase 5)
* **Ý tưởng:** Tạo 2 góc nhìn Mắt Trái (Left Eye) và Mắt Phải (Right Eye) lệch nhau góc thị sai $\Delta \theta = 1.5^\circ$ dựa vào Depth Map.
* **Tần số rung lắc:** Chuyển đổi khung hình qua lại giữa Left và Right ở tần số $8 \sim 12\text{ Hz}$ tạo cảm giác không gian 3 chiều rung lắc sống động.
