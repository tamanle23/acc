# IN-DEPTH ANALYSIS: 3D/POP-OUT EFFECTS BASED ON APPLIED TARGET

Understanding exactly *which object* an effect is applied to (a block of text, a raw unaltered image, or a character segmented from a video) completely determines the technological architecture (CSS/JS, FFmpeg, or AI Segmentation) required for automation.

Below is a systematic analysis of effects categorized by 5 core Digital Asset groups.

## 1. Objects (Isolated from Image/Video)

*The subject is not a standard rectangular block. It is a specific character, product, vehicle, or item located inside a raw image or video, requiring layer separation (alpha mask) based on its physical contours.*

* **Compatible Effects:**

  * **1.1 Out-of-Bounds (OOB) Card:** The object's head/arm reaches outside the container frame.

  * **1.2 Typographic Sandwiching (Top Layer):** The object acts as the foreground layer obscuring text behind it.

  * **3.3 Silhouette Rim Lighting:** Edge lighting that tightly hugs the contour of the object.

  * **3.4 Cast Shadow Across Planes:** Shadows generated from the actual physical shape of the object.

* **Technical & Automation Evaluation:**

  * **Difficulty:** Very High.

  * **Mandatory Tools:** Requires AI Computer Vision models (Segment Anything, RMBG) to automatically generate an Alpha Matte. For Video, Video Instance Segmentation (highly GPU-intensive) is required to track the object frame-by-frame.

  * **Note:** If the object is cropped in the original image (e.g., cut off at the waist or edge), OOB effects will fail due to the loss of geometric integrity.

## 2. Text & Typography (Data)

*The subject consists of character strings, headlines, numbers (KPIs), or text blocks (DOM Text / Vector Text).*

* **Compatible Effects:**

  * **1.2 Typographic Sandwiching (Bottom Layer):** Large text partially obscured by a foreground object.

  * **5.2 3D Extruded Numbers:** 3D block extrusion for numbers or short titles.

  * **5.4 Tunneling Text:** A loop of slogans scaling down towards the center.

* **Technical & Automation Evaluation:**

  * **Difficulty:** Easy.

  * **Mandatory Tools:** Can be perfectly handled using HTML/CSS, JS (cloning nodes), or FFmpeg (`drawtext`).

  * **Note:** Text is vector-based, meaning it will never become pixelated when perspective transforms or scaling/zooming are applied (unlike Images or Video). It is ideal for leading depth perception.

## 3. Image (Whole) & UI Containers (Whole Image/Video, UI Cards)

*The subject is a standard geometric block (usually a rectangle: `<div>`, `<video>`, `<img>`). The effect applies to the entire bounding box without caring about the detailed content inside.*

* **Compatible Effects:**

  * **2.3 Subtle Gyro / Focal Tilt:** Tilting the entire image/video card based on mouse movement.

  * **2.4 3D Fly-through Carousel:** Placing image/video blocks along the Z-axis in space.

  * **3.1 Multi-tier Diffuse Shadow:** Casting shadows for the entire card frame.

  * **3.2 Glassmorphic Fresnel Edge:** Applying glowing edges and frosted glass blurs to the block.

  * **5.3 Isometric Billboards:** Skewing the entire image block into a 30-degree tilted billboard.

* **Technical & Automation Evaluation:**

  * **Difficulty:** Very Easy.

  * **Mandatory Tools:** CSS 3D Transforms (`rotate`, `skew`, `perspective`) or FFmpeg (corner-pinning).

  * **Note:** No AI is needed; the system simply manipulates the matrix of a rectangular frame. Rendering is extremely lightweight and stable across all devices.

## 4. The Canvas (Whole Frame / Master Background Plate)

*The subject is the bottom-most background plate or the global coordinate system of the entire Slide/Screen.*

* **Compatible Effects:**

  * **1.4 Cutout Portal:** Cutting a hole through the entire canvas to reveal the space beneath.

  * **2.2 Camera Dolly Push/Pull:** Zooming the entire canvas (including all layers) straight into the center.

  * **4.2 Aerial Perspective / Mist:** Applying a mist layer/color tint to the bottom-most background.

  * **4.4 Vignette & Tunnel Light:** Darkening the 4 corners of the entire screen.

  * **5.1 Ground Perspective Grid:** Drawing a sprawling grid across the background layer.

* **Technical & Automation Evaluation:**

  * **Difficulty:** Medium (requires math/interpolation).

  * **Mandatory Tools:** Full-screen CSS Overlays (`100vw`, `100vh`), or FFmpeg filters (Vignette, Zoompan applied to the master track).

  * **Note:** Strongly impacts the "Atmosphere" (sense of space). Often serves as the base plate to enhance the effects in groups 1 and 2.

## 5. Overlays & Particles (Discrete Elements)

*The subjects are newly generated, additive components (UI shards, dust particles, light leaks, flares) used to trick the eye regarding the distance between the viewer and the screen.*

* **Compatible Effects:**

  * **4.1 Macro Foreground Bokeh:** Floating light spots/secondary objects heavily blurred at the 4 extreme edges of the frame.

* **Technical & Automation Evaluation:**

  * **Difficulty:** Easy.

  * **Mandatory Tools:** JS Particle Generator (for random spawning), CSS Blur Filter, or pre-rendered video overlays (dust/light leaks) using `mix-blend-mode: screen`.

  * **Note:** This element is completely "Additive". They do not interfere with or alter original data (no image cropping, no text editing), making them highly safe for batch automation.

### SUMMARY OF AUTOMATION STRATEGY BY TARGET

1. If your system **does not have AI**: Only apply effects to the **Text**, **Whole Image**, and **Canvas** groups. (Using 100% Code/CSS/FFmpeg).

2. If your system **integrates AI Vision**: You unlock the ability to apply effects to **Isolated Objects** (OOB, Sandwiching) — the effects that deliver the highest "WOW" factor and immersive experience.