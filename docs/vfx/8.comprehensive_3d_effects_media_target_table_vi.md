# BẢNG TỔNG HỢP HIỆU ỨNG 3D & POP-OUT (ĐÁNH GIÁ TRÊN MEDIA VÀ ĐỐI TƯỢNG)

Bảng dưới đây phân tích chi tiết các kỹ thuật tạo chiều sâu, kết hợp đánh giá về **đối tượng áp dụng** (yếu tố nào trong khung hình bị tác động) và **loại Media** (Ảnh tĩnh, Video, hay Web DOM) phù hợp nhất, kèm phương án tự động hóa.

## 1. Nhóm Phá vỡ Mặt phẳng (Frame-Breaking & Occlusion)

| Hiệu ứng (Variant) | Đối tượng áp dụng (Target) | Áp dụng trên Image | Áp dụng trên Video | Phương án Tự động hóa |
| :--- | :--- | :--- | :--- | :--- |
| **1.1 Out-of-Bounds (OOB) Card** | Nhân vật, Sản phẩm, Xe cộ (chủ thể có mảng vươn ra). | **Rất tốt.** Dễ dàng tách nền tĩnh và kẹp mask. | **Khó.** Đòi hỏi Video Segmentation (tách nền động) từng frame. Rất nặng. | **Ảnh:** AI (RMBG) + CSS Mask/FFmpeg Overlay. |
| **1.2 Typographic Sandwiching** | Text (Tiêu đề lớn) & Chủ thể tiền cảnh. | **Rất tốt.** Tách mask 1 frame tĩnh. | **Khả thi.** Cần track chuyển động chủ thể để Text không che mặt/mắt. | AI bóc Mask chủ thể -> CSS Z-index xếp: Nền -> Text -> Mask. |
| **1.3 Isometric Podium** | Biểu tượng, Sản phẩm, Mockup thiết bị. | **Tốt.** Thường dùng asset 3D tĩnh làm bục. | **Rất khó.** Cần tracking 3D camera để bục dính chặt vào cảnh video. | Khó tự động 100%, cần căn chỉnh vật lý (trọng tâm, góc sáng). |
| **1.4 Cutout Portal** | Nền (Background) hoặc Khung chuyển cảnh. | **Tốt.** Cắt mask vector tĩnh (SVG/CSS). | **Tốt.** Cắt mask (Alpha Matte) xuyên thấu để lộ video layer dưới. | CSS `clip-path` hoặc FFmpeg `overlay` với Alpha mask. |

---

## 2. Nhóm Chuyển động Chiều sâu (Parallax & Z-Axis Motion)

| Hiệu ứng (Variant) | Đối tượng áp dụng (Target) | Áp dụng trên Image | Áp dụng trên Video | Phương án Tự động hóa |
| :--- | :--- | :--- | :--- | :--- |
| **2.1 Multi-Speed Parallax** | Toàn bộ các lớp (Tiền - Trung - Hậu cảnh). | **Rất tốt.** Tách ảnh thành các layer rời. | **Khả thi.** Parallax video lồng nhau (PIP) hoặc tách depth map video. | Dùng AI lấy Depth Map. JS/CSS gán tốc độ theo `Z-index`. |
| **2.2 Camera Dolly Push/Pull** | Khung hình, Chủ thể trung tâm. | **Tốt.** Scale mượt bằng CSS transform. | **Tốt.** Zoom nội suy trên frame video. | JS nội suy Bounding Box (Morph) / FFmpeg `zoompan`. |
| **2.3 Subtle Gyro / Focal Tilt** | Thẻ UI, Hình ảnh phẳng (Card/Image). | **Tốt.** Xoay ảnh/thẻ theo chuột. | **Không phù hợp.** Video xoay sẽ lộ viền đen (trừ khi scale up). | CSS `rotateX/Y` kết hợp event listener tọa độ chuột. |
| **2.4 3D Fly-through Carousel** | Nhóm thẻ nội dung, Gallery ảnh/video. | **Tốt.** Trải các thẻ ảnh trên trục Z. | **Tốt.** Các video lặp chạy trên mặt thẻ 3D. | Tính toán lượng giác JS (Sin/Cos) hoặc CSS `transform-style: preserve-3d`. |

---

## 3. Nhóm Ánh sáng & Đổ bóng (Lighting & Materiality)

| Hiệu ứng (Variant) | Đối tượng áp dụng (Target) | Áp dụng trên Image | Áp dụng trên Video | Phương án Tự động hóa |
| :--- | :--- | :--- | :--- | :--- |
| **3.1 Multi-tier Diffuse Shadow** | Thẻ UI, Text khối, Hình bóc nền. | **Rất tốt.** Bóng đổ bằng CSS/Layer style. | **Khả thi.** Thêm filter Drop Shadow vào overlay video. | CSS `box-shadow` đa lớp tĩnh / FFmpeg filter. Tự động 100%. |
| **3.2 Glassmorphic Fresnel Edge** | Thẻ thông tin, Overlay Layer. | **Rất tốt.** Làm mờ nền tĩnh bên dưới. | **Khả thi.** Làm mờ video bên dưới (tốn tài nguyên GPU). | CSS `border`, gradient và `backdrop-filter: blur`. Tự động 100%. |
| **3.3 Silhouette Rim Lighting** | Đường viền nhân vật/vật thể. | **Tốt.** Áp dụng AI Relighting. | **Rất khó.** Đòi hỏi AI phân tích ánh sáng frame-by-frame trên video. | AI (như IC-Light) đánh back-light sinh viền. |
| **3.4 Cast Shadow Across Planes** | Bóng chủ thể đổ lên các mặt cong/nếp gấp. | **Khó.** Cần vẽ bóng bẻ gãy tay/3D. | **Bất khả thi (2D).** Cần môi trường 3D thực tế để dò tia. | Khó tự động. Thường fallback về flat drop-shadow. |

---

## 4. Nhóm Ống kính & Không khí (Depth of Field & Atmospherics)

| Hiệu ứng (Variant) | Đối tượng áp dụng (Target) | Áp dụng trên Image | Áp dụng trên Video | Phương án Tự động hóa |
| :--- | :--- | :--- | :--- | :--- |
| **4.1 Macro Foreground Bokeh** | Hạt bụi, Ánh sáng, Vật thể góc rìa. | **Rất tốt.** Dùng ảnh PNG mờ. | **Rất tốt.** Dùng video overlay (screen mode). | Sinh ngẫu nhiên (JS) ở 4 góc rìa và gán CSS `filter: blur`. |
| **4.2 Aerial Perspective / Mist** | Hậu cảnh xa (Background / Xa trục Z). | **Tốt.** Giảm opacity, pha màu nền. | **Tốt.** Phủ overlay màu bán trong suốt lên video nền. | Tính toán trục Z, gán biến giảm độ bão hòa, phủ `mix-blend-mode`. |
| **4.3 Dynamic Rack Focus** | Các lớp nội dung thay đổi sự chú ý. | **Tốt.** Làm mờ/nét ảnh chéo nhau. | **Khả thi.** Dùng filter blur động trên FFmpeg. | CSS đổi trạng thái State (`blur(0)` -> `blur(15px)`). |
| **4.4 Vignette & Tunnel Light** | Toàn bộ Canvas (Khung hình). | **Rất tốt.** Phủ overlay gradient. | **Rất tốt.** Phủ mask tối 4 góc video. | Tự động hoàn toàn qua CSS `radial-gradient` hoặc FFmpeg filter. |

---

## 5. Nhóm Cấu trúc Phối cảnh (Spatial Architecture)

| Hiệu ứng (Variant) | Đối tượng áp dụng (Target) | Áp dụng trên Image | Áp dụng trên Video | Phương án Tự động hóa |
| :--- | :--- | :--- | :--- | :--- |
| **5.1 Ground Perspective Grid** | Lưới sàn nhà, Mặt đất. | **Rất tốt.** Lưới vector/CSS. | **Khả thi.** Render video lưới chạy lùi. | CSS 3D `transform: perspective(600px) rotateX(60deg)`. |
| **5.2 3D Extruded Numbers** | Text/Số liệu (KPI, Giá tiền). | **Tốt.** Text giả 3D bằng layer CSS. | **Tốt.** Đặt text vào luồng FFmpeg/Video. | Thuật toán lặp JS clone text node, lùi trục Z (text-shadow). |
| **5.3 Isometric Billboards** | Khung văn bản, Biểu đồ. | **Rất tốt.** Bóp méo container Web. | **Tốt.** Corner-pinning video vào khung méo. | Cố định ma trận CSS `transform: rotate() skewX()`. |
| **5.4 Tunneling Text** | Cụm từ trọng tâm, Slogan. | **Tốt.** Clone text thu nhỏ về tâm. | **Khả thi.** Dùng After Effects script. | JS vòng lặp đẻ ra N bản sao text, giảm kích thước theo hàm mũ. |