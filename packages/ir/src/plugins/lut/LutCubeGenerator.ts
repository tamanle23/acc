// cube-generator-core.ts

/**
 * 1. Domain Types & Result Pattern (Enterprise Clean Coder)
 */
export type RGB = readonly [number, number, number];
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const GeneratorErrorCode = {
  InvalidSize: 'INVALID_SIZE',
} as const;
export type GeneratorErrorCode = (typeof GeneratorErrorCode)[keyof typeof GeneratorErrorCode];

/**
 * 2. Strategy Pattern cho Color Transformation
 * Bất kỳ bộ lọc màu nào cũng phải tuân thủ contract này.
 */
export type ColorOperation = (color: RGB) => RGB;

/**
 * 3. Math Utilities (Pure Functions - Immutability)
 */
export const ColorMath = {
  clamp: (val: number, min = 0, max = 1): number => Math.max(min, Math.min(max, val)),

  mix: (c1: RGB, c2: RGB, t: number): RGB => [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t,
  ],

  // Tính độ chói (Luminance) theo chuẩn Rec.709
  luminance: ([r, g, b]: RGB): number => 0.2126 * r + 0.7152 * g + 0.0722 *b,

  // Hàm S-Curve tạo độ tương phản mượt mà
  sCurve: (val: number, strength: number): number => {
    const v = val * 2 - 1;
    const curve = v >= 0 ? Math.pow(v, strength) : -Math.pow(-v, strength);
    return (curve + 1) / 2;
  }
} as const;

/**
 * 4. Composition Root (Pipeline Pattern)
 * Ghép nối nhiều hàm toán học thành một bộ lọc thống nhất.
 */
export class ColorPipeline {
  constructor(private readonly operations: readonly ColorOperation[]) {}

  apply(color: RGB): RGB {
    return this.operations.reduce((accColor, op) => op(accColor), color);
  }
}

/**
 * 5. WinterTC ReadableStream Generator
 * Trực tiếp sinh file .cube ra byte stream với overhead RAM siêu nhỏ (~O(1)).
 */
export class CubeLUTGenerator {
  static generateStream(
    title: string,
    pipeline: ColorPipeline,
    size: number = 33
  ): Result<ReadableStream<Uint8Array>, Error> {

    if (size < 2 || size > 256) {
      return {
        ok: false,
        error: new Error(`[${GeneratorErrorCode.InvalidSize}] Kích thước lưới phải từ 2 đến 256.`)
      };
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();

        // Ghi Metadata
        controller.enqueue(encoder.encode(`TITLE "${title}"\n`));
        controller.enqueue(encoder.encode(`LUT_3D_SIZE ${size}\n`));
        controller.enqueue(encoder.encode(`DOMAIN_MIN 0.0 0.0 0.0\n`));
        controller.enqueue(encoder.encode(`DOMAIN_MAX 1.0 1.0 1.0\n`));

        // Sinh ma trận lưới 3D
        for (let b = 0; b < size; b++) {
          for (let g = 0; g < size; g++) {
            for (let r = 0; r < size; r++) {
              // Tọa độ màu gốc (0.0 -> 1.0)
              const colorIn: RGB = [r / (size - 1), g / (size - 1), b / (size - 1)];

              // Chạy qua pipeline xử lý màu
              const [rOut, gOut, bOut] = pipeline.apply(colorIn);

              // Ép biên an toàn & Ghi ra stream
              const rC = ColorMath.clamp(rOut).toFixed(6);
              const gC = ColorMath.clamp(gOut).toFixed(6);
              const bC = ColorMath.clamp(bOut).toFixed(6);

              controller.enqueue(encoder.encode(`${rC} ${gC} ${bC}\n`));
            }
          }
        }
        controller.close();
      }
    });

    return { ok: true, value: stream };
  }
}


export const LUTPresets = {

  // 1. Teal & Orange (Bom Tấn)
  tealAndOrange: new ColorPipeline([
    (color: RGB): RGB => {
      const luma = ColorMath.luminance(color);
      // Shadows ngả xanh ngọc (Teal), Highlights ngả cam ấm (Orange)
      const targetShadows: RGB = [0.0, 0.4, 0.6];
      const targetHighlights: RGB = [1.0, 0.6, 0.2];

      const shadowMix = ColorMath.mix(color, targetShadows, (1 - luma) * 0.4);
      const finalMix = ColorMath.mix(shadowMix, targetHighlights, luma * 0.3);

      return [
        ColorMath.sCurve(finalMix[0], 1.1),
        ColorMath.sCurve(finalMix[1], 1.0),
        ColorMath.sCurve(finalMix[2], 1.2) // Đẩy gắt kênh Blue ở vùng tối
      ];
    }
  ]),

  // 2. Kodak 2383 Film Emulation (Giả lập Phim Nhựa)
  kodak2383: new ColorPipeline([
    (color: RGB): RGB => {
      const luma = ColorMath.luminance(color);
      // Lift blacks (xám mờ), giảm nhẹ whites
      const r = ColorMath.mix([color[0], color[1], color[2]], [0.1, color[1], color[2]], luma < 0.1 ? 0.5 : 0)[0];
      // Ám vàng/đỏ nhẹ ở midtones
      const rWarm = r + (Math.sin(luma * Math.PI) * 0.05);
      const bCool = color[2] - (Math.sin(luma * Math.PI) * 0.08);

      return [
        ColorMath.sCurve(rWarm, 1.3),
        ColorMath.sCurve(color[1], 1.2), // S-curve tạo tương phản phim
        ColorMath.sCurve(bCool, 1.2)
      ];
    }
  ]),

  // 3. Bleach Bypass (Chiến Tranh / Thô Ráp)
  bleachBypass: new ColorPipeline([
    (color: RGB): RGB => {
      const luma = ColorMath.luminance(color);
      // Giảm độ bão hòa (Saturation) mạnh
      const desaturated = ColorMath.mix(color, [luma, luma, luma], 0.75);
      // Kéo Contrast cực gắt
      return [
        ColorMath.sCurve(desaturated[0], 1.6),
        ColorMath.sCurve(desaturated[1], 1.6),
        ColorMath.sCurve(desaturated[2], 1.6)
      ];
    }
  ]),

  // 4. Sci-Fi Moody (Giật gân / Bí ẩn)
  sciFiMoody: new ColorPipeline([
    (color: RGB): RGB => {
      const luma = ColorMath.luminance(color);
      // Dìm sáng tổng thể
      const exposedDown: RGB = [color[0] * 0.8, color[1] * 0.8, color[2] * 0.8];
      // Shadow ngả xanh biển sậm
      const moody = ColorMath.mix(exposedDown, [0.0, 0.1, 0.4], luma < 0.5 ? (0.5 - luma) : 0);
      return [
        ColorMath.sCurve(moody[0], 1.2),
        ColorMath.sCurve(moody[1], 1.1),
        ColorMath.sCurve(moody[2], 1.3)
      ];
    }
  ]),

  // 5. Light & Airy (Vlog / Pastel)
  lightAndAiry: new ColorPipeline([
    (color: RGB): RGB => {
      // Nâng sáng tổng thể và giảm contrast nhẹ
      let r = Math.pow(color[0], 0.85);
      let g = Math.pow(color[1], 0.85);
      let b = Math.pow(color[2], 0.90); // Ấm lên một chút
      // Ép xanh lá (Green) về dạng Mint/Pastel
      if (g > r && g > b) {
        g = g * 0.9;
        b = b * 1.1;
      }
      return [r, g, b];
    }
  ]),

  // 6. Cyberpunk (Neon Night)
  cyberpunk: new ColorPipeline([
    (color: RGB): RGB => {
      // Đẩy mạnh kênh Magenta (Đỏ + Xanh) và Cyan (Xanh lam + Xanh lá)
      const luma = ColorMath.luminance(color);
      let [r, g, b] = color;

      // Hút màu vàng (Yellow) về đỏ/cam
      if (r > 0.5 && g > 0.5 && b < 0.4) { g *= 0.7; }

      // Hút xanh lá (Green) về Cyan
      if (g > 0.5 && r < 0.4) { b = Math.min(1.0, b + 0.3); }

      return [
        ColorMath.sCurve(r, 1.4),
        ColorMath.sCurve(g, 1.5),
        ColorMath.sCurve(b, 1.3)
      ];
    }
  ]),

  // 7. Vintage Faded (Camcorder 90s)
  vintageFaded: new ColorPipeline([
    (color: RGB): RGB => {
      const luma = ColorMath.luminance(color);
      // Giảm độ tương phản hoàn toàn, lift black lên 0.15, hạ white xuống 0.9
      const r = 0.15 + color[0] * 0.75 + (luma * 0.1); // Thêm chút đỏ/vàng
      const g = 0.15 + color[1] * 0.75 + (luma * 0.05);
      const b = 0.20 + color[2] * 0.70; // Shadows ám xanh xám
      return [r, g, b];
    }
  ]),

  // 8. Monochrome Noir (Trắng Đen Kịch Tính)
  monochromeNoir: new ColorPipeline([
    (color: RGB): RGB => {
      // Chuyển luma theo tỷ lệ custom: dìm xanh trời (làm trời tối mịt), đẩy đỏ
      const customLuma = color[0] * 0.7 + color[1] * 0.2 + color[2] * 0.1;
      // Tạo độ tương phản tàn bạo
      const contrastLuma = ColorMath.sCurve(customLuma, 2.0);
      return [contrastLuma, contrastLuma, contrastLuma];
    }
  ])
} satisfies Record<string, ColorPipeline>;
