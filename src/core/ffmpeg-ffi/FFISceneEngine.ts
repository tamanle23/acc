import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import { FFI, initFFI, makeAVRational } from "./index";
import { FFIVideoEncoder } from "./FFIVideoEncoder";
import { ptr, toArrayBuffer } from "bun:ffi";
import type { ResolvedStoryConfig, ResolvedSceneConfig, CaptionConfig, CaptionSettings } from "../../types";
import { drawCanvasCaptions } from "../captions-canvas";

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
        fps
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

      for (let f = 0; f < totalFrames; f++) {
        const timeSec = f / fps;
        ctx.drawImage(bgCanvas, 0, 0);
        drawCanvasCaptions(ctx, captions, timeSec, captionSettings, width, height);
        encoder.encodeRgbaFrame(canvas.data());
      }
    } else {
      const rawRgba = canvas.data();
      for (let f = 0; f < totalFrames; f++) {
        encoder.encodeRgbaFrame(rawRgba);
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
  }): Promise<{ path: string; duration: number }> {
    const { videoPath, audioPath, duration, outputPath, width, height, fps } = options;
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

    while (FFI.avformat.av_read_frame(vInFmt, pkt) >= 0 && framesEncoded < totalFrames) {
      const pktView = new DataView(toArrayBuffer(pkt, 0, 64));
      if (pktView.getInt32(36, true) === 0) { // Stream 0 is video
        if (FFI.avcodec.avcodec_send_packet(decCtx, pkt) === 0) {
          while (FFI.avcodec.avcodec_receive_frame(decCtx, frame) === 0) {
            encoder.encodeRawFrame(frame, srcW, srcH, srcFmt);
            framesEncoded++;
            FFI.avutil.av_frame_unref(frame);
            if (framesEncoded >= totalFrames) break;
          }
        }
      }
      FFI.avcodec.av_packet_unref(pkt);
    }

    encoder.close();

    // Cleanup
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
