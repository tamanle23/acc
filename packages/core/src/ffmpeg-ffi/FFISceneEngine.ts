import { ptr, toArrayBuffer } from "bun:ffi";
import { createCanvas, loadImage, ImageData } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import { FFI, initFFI, makeAVRational, AV_PIX_FMT_RGBA, Structs } from "./index";
import { FFIVideoEncoder } from "./FFIVideoEncoder";
import type { ResolvedStoryConfig, ResolvedSceneConfig, CaptionConfig, CaptionSettings } from "../types";
import { drawCanvasCaptions, groupCaptionsIntoPhrases } from "../../../effect-engines/src/subtitles/captions-canvas";

export interface SceneEngineOptions {
  scene: ResolvedSceneConfig;
  duration: number;
  assPath: string | null;
  config: ResolvedStoryConfig;
  outputPath: string;
  fallbackImagePath: string;
  fallbackAudioPath: string;
  paddingTime?: number;
}

export class FFISceneEngine {
  /**
   * Renders a 2D scene (Image or B-Roll Video) completely using native bun:ffi with zero external processes.
   */
  public static async renderScene(options: SceneEngineOptions): Promise<{ path: string; duration: number }> {
    const { scene, duration, assPath, config, outputPath, fallbackImagePath, fallbackAudioPath, paddingTime = 0 } = options;
    const { width, height, fps } = config.settings;
    const totalDuration = duration + paddingTime;

    const hasVideo = !!scene.resolvedVideo && fs.existsSync(scene.resolvedVideo);
    const hasAudio = fs.existsSync(scene.resolvedAudio);
    const audioInput = hasAudio ? scene.resolvedAudio : fallbackAudioPath;

    if (hasVideo) {
      return await this.renderVideoScene({
        videoPath: scene.resolvedVideo!,
        audioPath: audioInput,
        duration: totalDuration,
        outputPath,
        width,
        height,
        fps,
        captions: scene.captions,
        captionSettings: config.settings.captions
      });
    } else {
      const imagePath = (scene.resolvedImage && fs.existsSync(scene.resolvedImage)) ? scene.resolvedImage : fallbackImagePath;
      return await this.renderImageScene({
        imagePath,
        audioPath: audioInput,
        duration: totalDuration,
        outputPath,
        width,
        height,
        fps,
        captions: scene.captions,
        captionSettings: config.settings.captions
      });
    }
  }

  /**
   * Renders a static image scene into an MP4 video using Canvas and FFIVideoEncoder.
   */
  private static async renderImageScene(options: {
    imagePath: string;
    audioPath: string;
    duration: number;
    outputPath: string;
    width: number;
    height: number;
    fps: number;
    captions?: CaptionConfig[];
    captionSettings?: CaptionSettings;
  }): Promise<{ path: string; duration: number }> {
    const { imagePath, audioPath, duration, outputPath, width, height, fps, captions, captionSettings } = options;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const img = await loadImage(imagePath);

    // Letterbox / Pillarbox centering
    const imgAspect = img.width / img.height;
    const canvasAspect = width / height;
    let drawW = width;
    let drawH = height;
    let drawX = 0;
    let drawY = 0;

    if (imgAspect > canvasAspect) {
      drawW = width;
      drawH = width / imgAspect;
      drawY = (height - drawH) / 2;
    } else {
      drawH = height;
      drawW = height * imgAspect;
      drawX = (width - drawW) / 2;
    }

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const encoder = new FFIVideoEncoder(width, height, fps, outputPath, 20, audioPath);
    encoder.initialize();

    const totalFrames = Math.ceil(fps * duration);

    if (captions && captions.length > 0) {
      const bgCanvas = createCanvas(width, height);
      const bgCtx = bgCanvas.getContext("2d");
      bgCtx.fillStyle = "#000000";
      bgCtx.fillRect(0, 0, width, height);
      bgCtx.drawImage(img, drawX, drawY, drawW, drawH);

      const wordsPerPhrase = captionSettings?.wordsPerPhrase ?? 1;
      const phrases = groupCaptionsIntoPhrases(captions, wordsPerPhrase);

      let lastPhraseIdx = -2;
      let lastActiveWordIdx = -2;
      let cachedRgbaBuffer: Buffer | null = null;

      for (let f = 0; f < totalFrames; f++) {
        const timeSec = f / fps;

        let activePhraseIdx = -1;
        let activeWordIdx = -1;

        for (let pIdx = 0; pIdx < phrases.length; pIdx++) {
          const phrase = phrases[pIdx];
          const pStart = phrase[0].start;
          const pEnd = phrase[phrase.length - 1].end + 0.2;
          if (timeSec >= pStart && timeSec <= pEnd) {
            activePhraseIdx = pIdx;
            for (let wIdx = 0; wIdx < phrase.length; wIdx++) {
              const word = phrase[wIdx];
              const nextStart = (wIdx === phrase.length - 1) ? (word.end + 0.25) : phrase[wIdx + 1].start;
              if (timeSec >= word.start && timeSec < nextStart) {
                activeWordIdx = wIdx;
                break;
              }
            }
            break;
          }
        }

        // Only redraw canvas and allocate new buffer if the active subtitle state changed!
        if (activePhraseIdx !== lastPhraseIdx || activeWordIdx !== lastActiveWordIdx || !cachedRgbaBuffer) {
          ctx.drawImage(bgCanvas, 0, 0);
          drawCanvasCaptions(ctx, captions, timeSec, captionSettings, width, height);
          cachedRgbaBuffer = canvas.data();
          lastPhraseIdx = activePhraseIdx;
          lastActiveWordIdx = activeWordIdx;
        }

        encoder.encodeRgbaFrame(cachedRgbaBuffer);

        // Periodic yield to allow event loop & GC reclamation of dereferenced frames
        if (f % 15 === 0) {
          if (typeof Bun !== 'undefined' && (Bun as any).gc) {
            (Bun as any).gc(true);
          }
          await new Promise(r => setTimeout(r, 0));
        }
      }
    } else {
      const rawRgba = canvas.data();
      for (let f = 0; f < totalFrames; f++) {
        encoder.encodeRgbaFrame(rawRgba);
        if (f % 60 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }

    encoder.close();
    return { path: outputPath, duration };
  }

  /**
   * Decodes, scales, and encodes a B-Roll video scene to match project dimensions and framerate.
   */
  private static async renderVideoScene(options: {
    videoPath: string;
    audioPath: string;
    duration: number;
    outputPath: string;
    width: number;
    height: number;
    fps: number;
    captions?: CaptionConfig[];
    captionSettings?: CaptionSettings;
  }): Promise<{ path: string; duration: number }> {
    const { videoPath, audioPath, duration, outputPath, width, height, fps, captions, captionSettings } = options;
    initFFI();

    // 1. Open Input Video
    const vInFmtPtr = new BigUint64Array(1);
    const retV = FFI.avformat.avformat_open_input(ptr(vInFmtPtr.buffer), Buffer.from(videoPath + "\0"), 0n, 0n);
    if (retV !== 0) throw new Error(`Failed to open input video: ${videoPath}`);
    const vInFmt = vInFmtPtr[0];
    FFI.avformat.avformat_find_stream_info(vInFmt, 0n);

    const vView = new DataView(toArrayBuffer(vInFmt, 0, 64));
    const vStreams = new DataView(toArrayBuffer(vView.getBigUint64(48, true), 0, 64));
    const inVideoStream = vStreams.getBigUint64(0, true);
    const inVideoCodecpar = new DataView(toArrayBuffer(inVideoStream, 0, 64)).getBigUint64(16, true);
    const cpView = new DataView(toArrayBuffer(inVideoCodecpar, 0, 160));
    const codecId = cpView.getInt32(4, true);
    const srcW = cpView.getInt32(72, true);
    const srcH = cpView.getInt32(76, true);
    const srcFmt = cpView.getInt32(44, true);

    const decoder = FFI.avcodec.avcodec_find_decoder(codecId);
    if (!decoder) throw new Error(`Decoder not found for video codec: ${codecId}`);
    const decCtx = BigInt(FFI.avcodec.avcodec_alloc_context3(decoder));
    FFI.avcodec.avcodec_parameters_to_context(decCtx, inVideoCodecpar);
    FFI.avcodec.avcodec_open2(decCtx, decoder, 0n);

    const encoder = new FFIVideoEncoder(width, height, fps, outputPath, 20, audioPath);
    encoder.initialize();

    const pkt = BigInt(FFI.avcodec.av_packet_alloc());
    const frame = BigInt(FFI.avutil.av_frame_alloc());
    const totalFrames = Math.ceil(fps * duration);
    let framesEncoded = 0;

    const hasCaptions = !!(captions && captions.length > 0);

    let canvas: any = null;
    let ctx: any = null;
    let rgbaFrame: bigint = 0n;
    let imgData: any = null;
    let swsToRgbaCtx: bigint = 0n;
    let uint8Clamped: Uint8ClampedArray | null = null;

    if (hasCaptions) {
      canvas = createCanvas(width, height);
      ctx = canvas.getContext("2d");

      rgbaFrame = BigInt(FFI.avutil.av_frame_alloc());
      Structs.AVFrame.setFormat(rgbaFrame, AV_PIX_FMT_RGBA);
      Structs.AVFrame.setWidth(rgbaFrame, width);
      Structs.AVFrame.setHeight(rgbaFrame, height);
      FFI.avutil.av_frame_get_buffer(rgbaFrame, 0);

      swsToRgbaCtx = BigInt(FFI.swscale.sws_getContext(
        srcW, srcH, srcFmt,
        width, height, AV_PIX_FMT_RGBA,
        2, 0n, 0n, 0n
      ));

      const rgbaPtr = Structs.AVFrame.getDataPointer(rgbaFrame, 0);
      const linesize = Structs.AVFrame.getLinesize(rgbaFrame, 0);
      const ab = toArrayBuffer(rgbaPtr as any, 0, linesize * height);
      uint8Clamped = new Uint8ClampedArray(ab, 0, width * height * 4);
      imgData = new ImageData(width, height);
    }

    const encodeDecodedFrame = async (f: bigint) => {
      if (hasCaptions) {
          FFI.swscale.sws_scale(
            swsToRgbaCtx,
            f,
            f + 64n,
            0,
            srcH,
            rgbaFrame,
            rgbaFrame + 64n
          );
          imgData.data.set(uint8Clamped);
          ctx.putImageData(imgData, 0, 0);
          const timeSec = framesEncoded / fps;
          drawCanvasCaptions(ctx, captions!, timeSec, captionSettings, width, height);
          encoder.encodeRgbaFrame(canvas.data());
        } else {
          encoder.encodeRawFrame(f, srcW, srcH, srcFmt);
        }
      framesEncoded++;

      if (framesEncoded % 15 === 0) {
        if (typeof Bun !== 'undefined' && (Bun as any).gc) {
          (Bun as any).gc(true);
        }
        await new Promise(r => setTimeout(r, 0));
      }
    };

    while (framesEncoded < totalFrames) {
      let readRet = FFI.avformat.av_read_frame(vInFmt, pkt);
      if (readRet < 0) {
        // Loop video if needed
        FFI.avformat.av_seek_frame(vInFmt, -1, 0n, 1);
        FFI.avcodec.avcodec_flush_buffers(decCtx);
        readRet = FFI.avformat.av_read_frame(vInFmt, pkt);
        if (readRet < 0) {
          break;
        }
      }

      const pktView = new DataView(toArrayBuffer(pkt, 0, 64));
      if (pktView.getInt32(36, true) === 0) { // Stream 0 is video
        if (FFI.avcodec.avcodec_send_packet(decCtx, pkt) === 0) {
          while (FFI.avcodec.avcodec_receive_frame(decCtx, frame) === 0) {
            await encodeDecodedFrame(frame);
            FFI.avutil.av_frame_unref(frame);
            if (framesEncoded >= totalFrames) break;
          }
        }
      }
      FFI.avcodec.av_packet_unref(pkt);
    }

    encoder.close();

    // Cleanup
    if (rgbaFrame) {
      const pRgba = new BigUint64Array([rgbaFrame]);
      FFI.avutil.av_frame_free(ptr(pRgba.buffer));
    }
    if (swsToRgbaCtx) {
      FFI.swscale.sws_freeContext(swsToRgbaCtx);
    }
    const pDec = new BigUint64Array([decCtx]);
    FFI.avcodec.avcodec_free_context(ptr(pDec.buffer));
    const pPkt = new BigUint64Array([pkt]);
    FFI.avcodec.av_packet_free(ptr(pPkt.buffer));
    const pFrame = new BigUint64Array([frame]);
    FFI.avutil.av_frame_free(ptr(pFrame.buffer));
    const pVIn = new BigUint64Array([vInFmt]);
    FFI.avformat.avformat_close_input(ptr(pVIn.buffer));

    return { path: outputPath, duration };
  }
}
