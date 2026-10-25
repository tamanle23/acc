import fs from 'fs';
import path from 'path';
import { ptr, toArrayBuffer } from 'bun:ffi';
import { FFI, Structs, AV_PIX_FMT_RGBA, safeArrayBuffer, initFFI } from './index';
import { FFmpegManager } from '../FFmpegManager';
import type { ICanvasInstance, ICanvasContext2D } from '@acc/core-isomorphic';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import type { IVideoDecoder } from '../media-engine/types';

export interface DecodedVideoFrame {
  width: number;
  height: number;
  canvas: ICanvasInstance;
  ctx: ICanvasContext2D;
}

/**
 * FFIVideoDecoder:
 * Native in-memory B-Roll and video decoder leveraging libavcodec, libavformat,
 * and libswscale via pure bun:ffi.
 * Decodes video files frame-by-frame directly into standard RGBA Canvas instances.
 */
export class FFIVideoDecoder implements IVideoDecoder {
  private vInFmt: bigint = 0n;
  private decCtx: bigint = 0n;
  private swsCtx: bigint = 0n;
  private pkt: bigint = 0n;
  private frame: bigint = 0n;
  private rgbaFrame: bigint = 0n;
  private srcW = 0;
  private srcH = 0;
  private srcFmt = 0;
  private targetW = 0;
  private targetH = 0;
  private canvas: ICanvasInstance | null = null;
  private ctx: ICanvasContext2D | null = null;
  private imgData: any = null;
  private uint8Clamped: Uint8ClampedArray | null = null;
  private currentFrameIndex = 0;
  private isOpened = false;

  constructor(private videoPath: string, targetWidth: number, targetHeight: number) {
    this.targetW = targetWidth;
    this.targetH = targetHeight;
  }

  public async open(): Promise<boolean> {
    if (this.isOpened) return true;
    await FFmpegManager.prepare();
    initFFI();

    if (!fs.existsSync(this.videoPath)) {
      return false;
    }

    const vInFmtPtr = new BigUint64Array(1);
    const resolvedPath = path.resolve(this.videoPath);
    const ret = FFI.avformat.avformat_open_input(
      ptr(vInFmtPtr.buffer),
      Buffer.from(resolvedPath + '\0'),
      0n,
      0n
    );
    if (ret !== 0) return false;

    this.vInFmt = vInFmtPtr[0];
    FFI.avformat.avformat_find_stream_info(this.vInFmt, 0n);

    const vView = new DataView(toArrayBuffer(this.vInFmt, 0, 64));
    const vStreams = new DataView(toArrayBuffer(vView.getBigUint64(48, true), 0, 64));
    const inVideoStream = vStreams.getBigUint64(0, true);
    const inVideoCodecpar = new DataView(toArrayBuffer(inVideoStream, 0, 64)).getBigUint64(16, true);
    const cpView = new DataView(toArrayBuffer(inVideoCodecpar, 0, 160));
    const codecId = cpView.getInt32(4, true);
    this.srcW = cpView.getInt32(72, true);
    this.srcH = cpView.getInt32(76, true);
    this.srcFmt = cpView.getInt32(44, true);

    const decoder = FFI.avcodec.avcodec_find_decoder(codecId);
    if (!decoder) return false;

    this.decCtx = BigInt(FFI.avcodec.avcodec_alloc_context3(decoder));
    FFI.avcodec.avcodec_parameters_to_context(this.decCtx, inVideoCodecpar);
    if (FFI.avcodec.avcodec_open2(this.decCtx, decoder, 0n) !== 0) {
      return false;
    }

    this.pkt = BigInt(FFI.avcodec.av_packet_alloc());
    this.frame = BigInt(FFI.avutil.av_frame_alloc());
    this.rgbaFrame = BigInt(FFI.avutil.av_frame_alloc());

    Structs.AVFrame.setFormat(this.rgbaFrame, AV_PIX_FMT_RGBA);
    Structs.AVFrame.setWidth(this.rgbaFrame, this.targetW);
    Structs.AVFrame.setHeight(this.rgbaFrame, this.targetH);
    FFI.avutil.av_frame_get_buffer(this.rgbaFrame, 0);

    this.swsCtx = BigInt(
      FFI.swscale.sws_getContext(
        this.srcW,
        this.srcH,
        this.srcFmt,
        this.targetW,
        this.targetH,
        AV_PIX_FMT_RGBA,
        2,
        0n,
        0n,
        0n
      )
    );

    const rgbaPtr = Structs.AVFrame.getDataPointer(this.rgbaFrame, 0);
    const linesize = Structs.AVFrame.getLinesize(this.rgbaFrame, 0);
    const ab = toArrayBuffer(rgbaPtr as any, 0, linesize * this.targetH);
    this.uint8Clamped = new Uint8ClampedArray(ab, 0, this.targetW * this.targetH * 4);
    this.canvas = UniversalCanvasProvider.createCanvas(this.targetW, this.targetH);
    this.ctx = this.canvas.getContext('2d');
    this.imgData = this.ctx.createImageData
      ? this.ctx.createImageData(this.targetW, this.targetH)
      : { data: new Uint8ClampedArray(this.targetW * this.targetH * 4) };
    this.isOpened = true;
    return true;
  }

  /**
   * Reads next frame from video file. Loops back to start if end of video reached.
   */
  public async readNextFrame(): Promise<ICanvasInstance | null> {
    if (!this.isOpened) return null;

    while (true) {
      let readRet = FFI.avformat.av_read_frame(this.vInFmt, this.pkt);
      if (readRet < 0) {
        // Loop back to start
        FFI.avformat.av_seek_frame(this.vInFmt, -1, 0n, 1);
        FFI.avcodec.avcodec_flush_buffers(this.decCtx);
        readRet = FFI.avformat.av_read_frame(this.vInFmt, this.pkt);
        if (readRet < 0) {
          return this.canvas; // return last decoded frame
        }
      }

      const pktView = new DataView(safeArrayBuffer(this.pkt, 0, 64));
      if (pktView.getInt32(36, true) === 0) {
        if (FFI.avcodec.avcodec_send_packet(this.decCtx, this.pkt) === 0) {
          if (FFI.avcodec.avcodec_receive_frame(this.decCtx, this.frame) === 0) {
            const fPtr = BigInt(this.frame);
            const rgbaPtrBig = BigInt(this.rgbaFrame);
            FFI.swscale.sws_scale(
              this.swsCtx,
              fPtr,
              fPtr + 64n,
              0,
              this.srcH,
              rgbaPtrBig,
              rgbaPtrBig + 64n
            );

            this.imgData.data.set(this.uint8Clamped!);
            this.ctx!.putImageData(this.imgData, 0, 0);
            FFI.avutil.av_frame_unref(this.frame);
            FFI.avcodec.av_packet_unref(this.pkt);
            this.currentFrameIndex++;
            return this.canvas;
          }
        }
      }
      FFI.avcodec.av_packet_unref(this.pkt);
    }
  }

  public async getNextFrame(): Promise<DecodedVideoFrame | null> {
    const frame = await this.readNextFrame();
    if (!frame || !this.ctx) return null;
    return {
      width: this.targetW,
      height: this.targetH,
      canvas: this.canvas!,
      ctx: this.ctx!,
    };
  }

  public close(): void {
    if (!this.isOpened) return;
    if (this.rgbaFrame) {
      const pRgba = new BigUint64Array([this.rgbaFrame]);
      FFI.avutil.av_frame_free(ptr(pRgba.buffer));
    }
    if (this.swsCtx) {
      FFI.swscale.sws_freeContext(this.swsCtx);
    }
    if (this.decCtx) {
      const pDec = new BigUint64Array([this.decCtx]);
      FFI.avcodec.avcodec_free_context(ptr(pDec.buffer));
    }
    if (this.pkt) {
      const pPkt = new BigUint64Array([this.pkt]);
      FFI.avcodec.av_packet_free(ptr(pPkt.buffer));
    }
    if (this.frame) {
      const pFrame = new BigUint64Array([this.frame]);
      FFI.avutil.av_frame_free(ptr(pFrame.buffer));
    }
    if (this.vInFmt) {
      const pVIn = new BigUint64Array([this.vInFmt]);
      FFI.avformat.avformat_close_input(ptr(pVIn.buffer));
    }
    this.isOpened = false;
  }
}
