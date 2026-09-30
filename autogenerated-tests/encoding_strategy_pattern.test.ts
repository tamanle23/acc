import { describe, it, expect } from "bun:test";
import {
  FileVideoEncodingStrategy,
  RtmpLiveStreamEncodingStrategy,
  type IVideoEncodingStrategy
} from "../packages/core/src/ffmpeg-ffi/EncodingStrategies";
import { FFIVideoEncoder } from "../packages/core/src/ffmpeg-ffi/FFIVideoEncoder";

describe("Video Encoding Strategy Pattern Unit Tests", () => {
  it("FileVideoEncodingStrategy operates in 'file' mode and performs no sleep pacing", () => {
    const strategy = new FileVideoEncodingStrategy();
    expect(strategy.mode).toBe("file");

    const t0 = performance.now();
    strategy.paceFrame(0, 30);
    strategy.paceFrame(1, 30);
    strategy.paceFrame(2, 30);
    const t1 = performance.now();
    // Offline rendering pacing must be instantaneous (< 10ms)
    expect(t1 - t0).toBeLessThan(10);
  });

  it("RtmpLiveStreamEncodingStrategy operates in 'rtmp_live' mode", () => {
    const strategy = new RtmpLiveStreamEncodingStrategy();
    expect(strategy.mode).toBe("rtmp_live");
  });

  it("FFIVideoEncoder auto-detects Strategy based on destination protocol", () => {
    const fileEncoder = new FFIVideoEncoder(1280, 720, 30, "output.mp4");
    expect(fileEncoder.getStrategy().mode).toBe("file");
    expect(fileEncoder.getStrategy()).toBeInstanceOf(FileVideoEncodingStrategy);

    const rtmpEncoder = new FFIVideoEncoder(1280, 720, 30, "rtmp://a.rtmp.youtube.com/live2/xxxx-xxxx-xxxx");
    expect(rtmpEncoder.getStrategy().mode).toBe("rtmp_live");
    expect(rtmpEncoder.getStrategy()).toBeInstanceOf(RtmpLiveStreamEncodingStrategy);

    const rtmpsEncoder = new FFIVideoEncoder(1280, 720, 30, "rtmps://live-api-s.facebook.com:443/rtmp/xxxx");
    expect(rtmpsEncoder.getStrategy().mode).toBe("rtmp_live");
    expect(rtmpsEncoder.getStrategy()).toBeInstanceOf(RtmpLiveStreamEncodingStrategy);
  });

  it("FFIVideoEncoder supports custom Strategy dependency injection via constructor and setter", () => {
    class MockCustomStrategy implements IVideoEncodingStrategy {
      public readonly mode = 'file' as const;
      public configured = false;
      public paced = false;

      configureCodec(): void {
        this.configured = true;
      }
      allocateFormatContext(): bigint {
        return 1234n;
      }
      configureFormatContext(): void {}
      paceFrame(): void {
        this.paced = true;
      }
    }

    const mock = new MockCustomStrategy();
    const encoder = new FFIVideoEncoder(1280, 720, 30, "mock.mp4", 20, undefined, mock);
    expect(encoder.getStrategy()).toBe(mock);

    const newMock = new MockCustomStrategy();
    encoder.setStrategy(newMock);
    expect(encoder.getStrategy()).toBe(newMock);
  });

  it("FileVideoEncodingStrategy dynamically selects container format and faststart from config", () => {
    const defaultStrategy = new FileVideoEncodingStrategy();
    expect(defaultStrategy.getContainer()).toBe("mp4");
    expect(defaultStrategy.isFastStart()).toBe(true);

    const mkvStrategy = new FileVideoEncodingStrategy({ container: "mkv" });
    expect(mkvStrategy.getContainer()).toBe("mkv");
    expect(mkvStrategy.isFastStart()).toBe(false);

    const webmStrategy = new FileVideoEncodingStrategy({ container: "webm" });
    expect(webmStrategy.getContainer()).toBe("webm");

    const movStrategy = new FileVideoEncodingStrategy({ container: "mov", fastStart: false });
    expect(movStrategy.getContainer()).toBe("mov");
    expect(movStrategy.isFastStart()).toBe(false);
  });

  it("FFIVideoEncoder automatically resolves container format from file extension and fileOptions", () => {
    const mkvEncoder = new FFIVideoEncoder(1280, 720, 30, "output.mkv");
    const strategy = mkvEncoder.getStrategy() as FileVideoEncodingStrategy;
    expect(strategy).toBeInstanceOf(FileVideoEncodingStrategy);
    expect(strategy.getContainer()).toBe("mkv");

    const webmEncoder = new FFIVideoEncoder(1280, 720, 30, "output.webm");
    const webmStrat = webmEncoder.getStrategy() as FileVideoEncodingStrategy;
    expect(webmStrat.getContainer()).toBe("webm");

    const customEncoder = new FFIVideoEncoder(
      1280, 720, 30, "custom_video_output",
      20, undefined, undefined,
      { container: "mkv", fastStart: true }
    );
    const customStrat = customEncoder.getStrategy() as FileVideoEncodingStrategy;
    expect(customStrat.getContainer()).toBe("mkv");
    expect(customStrat.isFastStart()).toBe(true);
  });
});
