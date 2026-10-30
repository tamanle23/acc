// cube-parser.ts

/**
 * 1. Result Pattern (Enterprise Clean Coder)
 * Tránh ném Exception bừa bãi, bọc các lỗi logic nghiệp vụ vào type-safe union.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * 2. Erasable Syntax First (TypeScript Node & Bun Architect)
 * Không dùng 'enum' truyền thống. Dùng 'as const' object literals với union types.
 */
export const CubeParserErrorCode = {
  InvalidFormat: 'INVALID_FORMAT',
  MissingSize: 'MISSING_SIZE',
  IncompleteData: 'INCOMPLETE_DATA',
  Unsupported1DLUT: 'UNSUPPORTED_1D_LUT',
} as const;

export type CubeParserErrorCode = (typeof CubeParserErrorCode)[keyof typeof CubeParserErrorCode];

export class CubeParserError extends Error {
  constructor(
    public readonly code: CubeParserErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CubeParserError';
  }
}

/**
 * 3. Domain Entity (SOLID - Core Domain)
 * Object chứa data sau khi parse. Immutability by default (sử dụng readonly).
 */
export interface CubeLUT {
  readonly title: string | null;
  readonly size: number;
  readonly domainMin: readonly [number, number, number];
  readonly domainMax: readonly [number, number, number];
  readonly data: Float32Array; // Flattened RGB floats (Kích thước: size * size * size * 3)
}

/**
 * 4. Transform Stream (WinterTC Web API)
 * Pipeline tiêu chuẩn ECMA-429 để chia nhỏ chuỗi văn bản thành từng dòng
 * mà không cần load toàn bộ file vào RAM (ngăn chặn Memory Leak).
 */
function createTextLineStream(): TransformStream<string, string> {
  let buffer = '';
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? ''; // Giữ lại phần dòng chưa hoàn chỉnh ở cuối
      for (const line of lines) {
        controller.enqueue(line);
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(buffer);
      }
    }
  });
}

/**
 * 5. Explicit Resource Management (TypeScript 5.2+)
 * Quản lý vòng đời Stream một cách nghiêm ngặt với `Symbol.asyncDispose`.
 */
class DisposableStreamReader<T> implements AsyncDisposable {
  constructor(private readonly reader: ReadableStreamDefaultReader<T>) { }

  async read(): Promise<ReadableStreamReadResult<T>> {
    return this.reader.read();
  }

  async [Symbol.asyncDispose]() {
    this.reader.releaseLock();
  }
}

/**
 * 6. Application Service Layer
 */
export class CubeLUTParser {
  /**
   * Parse luồng stream định dạng .cube thành Float32Array để nạp vào WebGPU/Canvas.
   * Tuân thủ cấu trúc Cooperative Cancellation thông qua AbortSignal.
   */
  static async parseStream(
    stream: ReadableStream<Uint8Array>,
    signal?: AbortSignal
  ): Promise<Result<CubeLUT, CubeParserError>> {

    // Ráp pipeline streams (Uint8Array -> String -> Lines)
    const lineStream = stream
      .pipeThrough(new TextDecoderStream(), { signal })
      .pipeThrough(createTextLineStream(), { signal });

    // Kích hoạt Explicit Resource Management (await using)
    await using reader = new DisposableStreamReader(lineStream.getReader());

    let title: string | null = null;
    let size = 0;
    let domainMin: [number, number, number] = [0, 0, 0];
    let domainMax: [number, number, number] = [1, 1, 1];

    // Trì hoãn việc cấp phát bộ nhớ mảng cho đến khi chốt được kích thước lưới (size)
    let data: Float32Array | null = null;
    let dataOffset = 0;
    let expectedDataCount = 0;

    while (true) {
      // Cooperative Cancellation check
      if (signal?.aborted) throw signal.reason;

      const { done, value: line } = await reader.read();
      if (done) break;

      const trimmed = line.trim();

      // Bỏ qua các dòng trống và comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Phase 1: Parse Headers & Metadata
      if (data === null) {
        if (trimmed.startsWith('TITLE')) {
          const match = trimmed.match(/^TITLE\s+"?(.*?)"?$/);
          if (match) title = match[1]!;
        } else if (trimmed.startsWith('LUT_3D_SIZE')) {
          const parts = trimmed.split(/\s+/);
          size = parseInt(parts[1] ?? '0', 10);

          if (Number.isNaN(size) || size < 2 || size > 256) {
            return {
              ok: false,
              error: new CubeParserError(CubeParserErrorCode.InvalidFormat, `LUT_3D_SIZE không hợp lệ: ${parts[1]}`)
            };
          }

          // Khởi tạo Float32Array với độ dài chính xác (O(1) memory overhead)
          expectedDataCount = size * size * size * 3;
          data = new Float32Array(expectedDataCount);

        } else if (trimmed.startsWith('LUT_1D_SIZE')) {
          return {
            ok: false,
            error: new CubeParserError(CubeParserErrorCode.Unsupported1DLUT, 'Parser này chỉ hỗ trợ 3D LUT')
          };
        } else if (trimmed.startsWith('DOMAIN_MIN')) {
          const parts = trimmed.split(/\s+/);
          domainMin = [parseFloat(parts[1]!), parseFloat(parts[2]!), parseFloat(parts[3]!)];
        } else if (trimmed.startsWith('DOMAIN_MAX')) {
          const parts = trimmed.split(/\s+/);
          domainMax = [parseFloat(parts[1]!), parseFloat(parts[2]!), parseFloat(parts[3]!)];
        } else if (trimmed.match(/^[-0-9.]/)) {
          // Gặp dữ liệu data trước khi khai báo SIZE -> Fail Fast
          return {
            ok: false,
            error: new CubeParserError(CubeParserErrorCode.MissingSize, 'Data points xuất hiện trước khai báo LUT_3D_SIZE.')
          };
        }
        continue;
      }

      // Phase 2: Parse RGB Floats
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        if (dataOffset < expectedDataCount) {
          data[dataOffset++] = parseFloat(parts[0]!);
          data[dataOffset++] = parseFloat(parts[1]!);
          data[dataOffset++] = parseFloat(parts[2]!);
        }
      }
    }

    // Phase 3: Integrity Validation (Fail Fast)
    if (data === null || dataOffset < expectedDataCount) {
      return {
        ok: false,
        error: new CubeParserError(
          CubeParserErrorCode.IncompleteData,
          `Dữ liệu bị thiếu. Kỳ vọng ${expectedDataCount} floats, nhưng chỉ parse được ${dataOffset}.`
        )
      };
    }

    return {
      ok: true,
      value: { title, size, domainMin, domainMax, data },
    };
  }
}
