# COMPREHENSIVE 3D & POP-OUT EFFECTS TABLE (EVALUATED BY TARGET AND MEDIA)

This table provides a detailed breakdown of depth-creation visual techniques, combining an evaluation of the **Applied Target** (which element in the frame is affected) and the most suitable **Media Type** (Static Image, Video, or Web DOM), along with potential automation approaches.

## 1. Frame-Breaking & Occlusion

| Effect (Variant) | Applied Target | Image Application | Video Application | Automation Approach |
| :--- | :--- | :--- | :--- | :--- |
| **1.1 Out-of-Bounds (OOB) Card** | Characters, Products, Vehicles (subjects with protruding parts). | **Very Good.** Easy to remove static background and apply clip masks. | **Difficult.** Requires per-frame Video Segmentation. High processing cost. | **Image:** AI (RMBG) + CSS Mask / FFmpeg Overlay. |
| **1.2 Typographic Sandwiching** | Text (Large headlines) & Foreground subject. | **Very Good.** Extract alpha mask from 1 static frame. | **Feasible.** Requires subject motion tracking so text doesn't cover face/eyes. | AI extracts subject mask -> CSS Z-index: Background -> Text -> Mask. |
| **1.3 Isometric Podium** | Icons, Products, Device mockups. | **Good.** Often uses static 3D assets as pedestals. | **Very Difficult.** Requires 3D camera tracking to anchor the podium to the video scene. | Hard to 100% automate; requires physical alignment (center of gravity, lighting angle). |
| **1.4 Cutout Portal** | Background (Environment) or Transition frames. | **Good.** Vector static mask cutout (SVG/CSS). | **Good.** Alpha Matte mask cutout to reveal the video layer below. | CSS `clip-path` or FFmpeg `overlay` with Alpha mask. |

## 2. Depth Motion (Parallax & Z-Axis)

| Effect (Variant) | Applied Target | Image Application | Video Application | Automation Approach |
| :--- | :--- | :--- | :--- | :--- |
| **2.1 Multi-Speed Parallax** | All structural layers (Foreground - Mid - Background). | **Very Good.** Easy to split images into separate layers. | **Feasible.** Nested video parallax (PIP) or dynamic video depth map extraction. | Use AI for Depth Map. JS/CSS assigns translation speed based on `z-index`. |
| **2.2 Camera Dolly Push/Pull** | Framing container, Center subject. | **Good.** Smooth scaling via CSS transforms. | **Good.** Interpolated zooming on video frames. | JS bounding box interpolation (Morph) / FFmpeg `zoompan` filter. |
| **2.3 Subtle Gyro / Focal Tilt** | UI Cards, Flat image assets. | **Good.** Rotate image/card reacting to mouse move. | **Not Suitable.** Rotating video exposes black edges (unless scaled up significantly). | CSS `rotateX/Y` combined with JS mouse coordinate event listeners. |
| **2.4 3D Fly-through Carousel** | Content card groups, Image/Video galleries. | **Good.** Distribute image cards along the Z-axis. | **Good.** Looped videos playing on 3D card faces. | JS trigonometric calculations (Sin/Cos) or CSS `transform-style: preserve-3d`. |

## 3. Lighting & Materiality

| Effect (Variant) | Applied Target | Image Application | Video Application | Automation Approach |
| :--- | :--- | :--- | :--- | :--- |
| **3.1 Multi-tier Diffuse Shadow** | UI Cards, Block text, Masked images/subjects. | **Very Good.** Cast shadows using CSS/Layer styles. | **Feasible.** Add Drop Shadow filters to video overlays. | CSS `box-shadow` (static multi-layer) or FFmpeg filter. 100% automated. |
| **3.2 Glassmorphic Fresnel Edge** | Info cards, Overlay Layers. | **Very Good.** Blurs the static background beneath it. | **Feasible.** Blurs the video beneath (can consume heavy GPU resources). | CSS `border`, gradient outline, and `backdrop-filter: blur`. 100% automated. |
| **3.3 Silhouette Rim Lighting** | Character/Object outlines. | **Good.** Apply AI Relighting to static images. | **Very Difficult.** Requires AI to analyze lighting frame-by-frame on dynamic video. | AI (e.g., IC-Light) casts virtual back-light to generate glowing edges. |
| **3.4 Cast Shadow Across Planes** | Subject shadows cast onto curved surfaces/folds. | **Hard.** Requires manual warping or 3D rendering. | **Impossible (in 2D).** Requires an actual 3D environment for ray tracing. | Hard to automate. Usually falls back to flat drop-shadows. |

## 4. Depth of Field & Atmospherics

| Effect (Variant) | Applied Target | Image Application | Video Application | Automation Approach |
| :--- | :--- | :--- | :--- | :--- |
| **4.1 Macro Foreground Bokeh** | Dust particles, Light leaks, Edge objects. | **Very Good.** Uses blurred transparent PNG images. | **Very Good.** Uses looped video overlays (screen blend mode). | JS randomly spawns elements at 4 edges + CSS `filter: blur`. |
| **4.2 Aerial Perspective / Mist** | Distant background (Far Z-axis). | **Good.** Reduce opacity, blend background color. | **Good.** Apply semi-transparent color overlays to background videos. | Calculate Z-axis, assign desaturation variable, overlay using `mix-blend-mode`. |
| **4.3 Dynamic Rack Focus** | Content layers shifting user attention. | **Good.** Cross-blurring static images. | **Feasible.** Dynamic blur filters applied via FFmpeg. | CSS state change interpolation (`blur(0px)` -> `blur(15px)`). |
| **4.4 Vignette & Tunnel Light** | Entire Canvas (Frame borders). | **Very Good.** Apply radial gradient overlays. | **Very Good.** Apply dark gradient masks to the 4 corners of the video. | 100% automated via CSS `radial-gradient` or FFmpeg vignette filter. |

## 5. Spatial Architecture

| Effect (Variant) | Applied Target | Image Application | Video Application | Automation Approach |
| :--- | :--- | :--- | :--- | :--- |
| **5.1 Ground Perspective Grid** | Floor grid, Ground topography. | **Very Good.** Vector/CSS grid perspective. | **Feasible.** Render looped video of grid moving backwards. | CSS 3D `transform: perspective(600px) rotateX(60deg)`. |
| **5.2 3D Extruded Numbers** | Text/Data (KPIs, Prices, Metrics). | **Good.** Pseudo-3D text using layered CSS. | **Good.** Place rendered text into the FFmpeg/Video stream. | JS iterative algorithm cloning text nodes, receding on the Z-axis (using text-shadow). |
| **5.3 Isometric Billboards** | Text boxes, UI Charts. | **Very Good.** Skewing standard Web containers. | **Good.** Corner-pinning video into a skewed 3D frame. | Fixed CSS matrix: `transform: rotate(-30deg) skewX(30deg)`. |
| **5.4 Tunneling Text** | Key phrases, Slogans. | **Good.** Clone and scale down text towards the center. | **Feasible.** Uses After Effects scripts / pre-rendered loops. | JS loop spawning $N$ text clones, scaling down exponentially. |