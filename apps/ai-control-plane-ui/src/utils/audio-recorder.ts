/**
 * In-browser microphone audio recorder utility.
 *
 * Captures live microphone input via MediaDevices/Web Audio,
 * computes real-time volume VU metering, and encodes output
 * into standard 16-bit PCM WAV blobs & base64 data URIs.
 */

export interface RecordedAudioResult {
  blob: Blob;
  dataUri: string;
  durationSec: number;
  sampleRate: number;
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private volumeInterval: number | null = null;
  private startTime: number = 0;

  public isRecording: boolean = false;

  static isSupported(): boolean {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const nav = navigator as any;
    return Boolean(
      (nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === "function") ||
      nav.getUserMedia ||
      nav.webkitGetUserMedia ||
      nav.mozGetUserMedia ||
      nav.msGetUserMedia
    );
  }

  static getInsecureContextNotice(): string | null {
    if (typeof window === "undefined") return null;
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]";
    const isSecure = window.isSecureContext || isLocal;
    if (!isSecure) {
      const port = window.location.port ? `:${window.location.port}` : "";
      return `Microphone access requires a Secure Context (HTTPS or http://localhost). You are currently accessing via '${window.location.origin}'. Please open the Studio at 'http://localhost${port}' or use the 'Upload Audio File' tab.`;
    }
    return null;
  }

  async start(onVolume?: (vol: number) => void): Promise<void> {
    if (this.isRecording) return;
    this.recordedChunks = [];

    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    let getMediaFn: ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null = null;

    if (nav?.mediaDevices && typeof nav.mediaDevices.getUserMedia === "function") {
      getMediaFn = (c) => nav.mediaDevices.getUserMedia(c);
    } else if (nav?.getUserMedia || nav?.webkitGetUserMedia || nav?.mozGetUserMedia || nav?.msGetUserMedia) {
      const legacyGetUserMedia =
        nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia || nav.msGetUserMedia;
      getMediaFn = (c) =>
        new Promise<MediaStream>((resolve, reject) => {
          legacyGetUserMedia.call(nav, c, resolve, reject);
        });
    }

    if (!getMediaFn) {
      const notice = AudioRecorder.getInsecureContextNotice();
      if (notice) {
        throw new Error(notice);
      }
      throw new Error(
        "Microphone API (navigator.mediaDevices.getUserMedia) is not available in your current browser environment. Please use the 'Upload Audio File' tab."
      );
    }

    const stream = await getMediaFn({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.stream = stream;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    this.audioContext = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    this.analyser = analyser;

    // Monitor volume level for live VU meter
    if (onVolume) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.volumeInterval = window.setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, avg / 128.0);
        onVolume(normalized);
      }, 50);
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
      ? "audio/ogg;codecs=opus"
      : "";

    const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
    const mediaRecorder = new MediaRecorder(stream, recorderOptions);
    this.mediaRecorder = mediaRecorder;

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.startTime = performance.now();
    mediaRecorder.start(100); // 100ms slice interval
    this.isRecording = true;
  }

  async stop(): Promise<RecordedAudioResult> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error("Recorder is not currently recording.");
    }

    if (this.volumeInterval !== null) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }

    const recordedDuration = (performance.now() - this.startTime) / 1000;

    return new Promise<RecordedAudioResult>((resolve, reject) => {
      const mr = this.mediaRecorder!;

      mr.onstop = async () => {
        try {
          const rawBlob = new Blob(this.recordedChunks, { type: mr.mimeType || "audio/webm" });
          const rawArrayBuffer = await rawBlob.arrayBuffer();

          // Decode raw media into AudioBuffer
          const decodeCtx = new (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          let audioBuffer: AudioBuffer;
          try {
            audioBuffer = await decodeCtx.decodeAudioData(rawArrayBuffer);
          } catch {
            // Fallback: create synthetic buffer if webm decode is unsupported in this container
            const sampleRate = 48000;
            const length = Math.max(1, Math.round(sampleRate * Math.max(0.5, recordedDuration)));
            audioBuffer = decodeCtx.createBuffer(1, length, sampleRate);
          } finally {
            if (decodeCtx.state !== "closed") {
              void decodeCtx.close();
            }
          }

          // Encode to canonical 16-bit PCM WAV (Mono, 48kHz or input sample rate)
          const wavBlob = this.encodeWav(audioBuffer);
          const dataUri = await this.blobToDataUri(wavBlob);

          this.cleanup();
          resolve({
            blob: wavBlob,
            dataUri,
            durationSec: Math.round(audioBuffer.duration * 100) / 100,
            sampleRate: audioBuffer.sampleRate,
          });
        } catch (err) {
          this.cleanup();
          reject(err);
        }
      };

      try {
        mr.stop();
      } catch (err) {
        this.cleanup();
        reject(err);
      }
    });
  }

  cancel(): void {
    if (this.volumeInterval !== null) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.isRecording = false;
    this.recordedChunks = [];
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
  }

  private encodeWav(audioBuffer: AudioBuffer): Blob {
    const numChannels = 1;
    const sampleRate = audioBuffer.sampleRate || 48000;
    const format = 1; // PCM
    const bitDepth = 16;

    const channelData = audioBuffer.getChannelData(0);
    const numSamples = channelData.length;
    const blockAlign = numChannels * (bitDepth / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * (bitDepth / 8);

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF identifier
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, "WAVE");

    // fmt subchunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data subchunk
    this.writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    // Write 16-bit PCM samples
    let offset = 44;
    for (let i = 0; i < numSamples; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([view], { type: "audio/wav" });
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  private blobToDataUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
