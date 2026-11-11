import { Component, Show, createSignal, onCleanup } from "solid-js";
import {
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Volume2,
} from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AudioRecorder } from "@/utils/audio-recorder";

export interface VoiceCloningModalProps {
  isOpen: boolean;
  engineId: string;
  onVoiceRegistered: (voiceId: string, voiceName: string) => void;
  onClose: () => void;
  client: any;
}

export const VoiceCloningModal: Component<VoiceCloningModalProps> = (props) => {
  const insecureNotice = AudioRecorder.getInsecureContextNotice();
  const [activeTab, setActiveTab] = createSignal<"mic" | "upload">(
    insecureNotice ? "upload" : "mic"
  );
  const [voiceName, setVoiceName] = createSignal("");
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordingSeconds, setRecordingSeconds] = createSignal(0);
  const [volumeLevel, setVolumeLevel] = createSignal(0);
  const [audioBlob, setAudioBlob] = createSignal<Blob | null>(null);
  const [audioDataUri, setAudioDataUri] = createSignal<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const recorder = new AudioRecorder();
  let timerInterval: number | null = null;
  let previewAudioEl: HTMLAudioElement | undefined;

  onCleanup(() => {
    if (timerInterval) clearInterval(timerInterval);
    recorder.cancel();
  });

  const handleStartRecording = async () => {
    setErrorMessage(null);
    setAudioBlob(null);
    setAudioDataUri(null);
    setRecordingSeconds(0);
    try {
      await recorder.start((vol) => setVolumeLevel(vol));
      setIsRecording(true);
      timerInterval = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 15) {
            void handleStopRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      setErrorMessage(`Microphone access error: ${err.message || String(err)}`);
    }
  };

  const handleStopRecording = async () => {
    if (!recorder.isRecording) return;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    try {
      const res = await recorder.stop();
      setIsRecording(false);
      setVolumeLevel(0);
      setAudioBlob(res.blob);
      setAudioDataUri(res.dataUri);
    } catch (err: any) {
      setIsRecording(false);
      setVolumeLevel(0);
      setErrorMessage(`Recording capture error: ${err.message || String(err)}`);
    }
  };

  const handleFileUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      setAudioBlob(file);
      setAudioDataUri(reader.result as string);
      if (!voiceName().trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-\s]/g, "");
        setVoiceName(cleanName);
      }
    };
    reader.onerror = () => setErrorMessage("Failed to read audio file.");
    reader.readAsDataURL(file);
  };

  const togglePreview = () => {
    const el = previewAudioEl;
    if (!el) return;
    if (isPlayingPreview()) {
      el.pause();
      setIsPlayingPreview(false);
    } else {
      el.play().then(() => setIsPlayingPreview(true)).catch(() => setIsPlayingPreview(false));
    }
  };

  const handleRegisterVoice = async () => {
    const name = voiceName().trim();
    if (!name) {
      setErrorMessage("Please enter a voice name.");
      return;
    }
    const dataUri = audioDataUri();
    if (!dataUri) {
      setErrorMessage("Please record or upload a reference audio sample first.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await props.client.registerModelVoice(props.engineId, {
        voice_name: name,
        ref_audio_b64: dataUri,
      });
      props.onVoiceRegistered(name, name);
      handleClose();
    } catch (err: any) {
      setErrorMessage(`Failed to register voice: ${err.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isRecording()) {
      recorder.cancel();
      setIsRecording(false);
    }
    if (timerInterval) clearInterval(timerInterval);
    setAudioBlob(null);
    setAudioDataUri(null);
    setVoiceName("");
    setErrorMessage(null);
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div class="relative w-full max-w-lg rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl text-card-foreground ring-1 ring-primary/20">
          {/* Header */}
          <div class="flex items-start justify-between border-b border-border pb-4">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary ring-1 ring-primary/40">
                <Sparkles class="h-6 w-6" />
              </div>
              <div>
                <h3 class="text-base font-bold text-foreground flex items-center gap-2">
                  Studio Voice Cloning & Calibration
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Record 5–10s of clean speech or upload reference audio for zero-shot synthesis
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting()}
              class="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          {/* Error Banner */}
          <Show when={errorMessage()}>
            <div class="mt-4 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-2">
              <div class="flex items-start gap-2">
                <AlertCircle class="h-4 w-4 shrink-0 mt-0.5" />
                <span class="flex-1 leading-relaxed">{errorMessage()}</span>
              </div>
              <Show when={activeTab() === "mic"}>
                <div class="flex items-center gap-2 pl-6">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setErrorMessage(null);
                      setActiveTab("upload");
                    }}
                    class="h-6 px-2 text-[11px] border-destructive/40 text-destructive hover:bg-destructive/20 font-semibold"
                  >
                    <Upload class="h-3 w-3 mr-1" /> Switch to File Upload Tab
                  </Button>
                </div>
              </Show>
            </div>
          </Show>

          {/* Tabs */}
          <div class="flex items-center gap-2 mt-4 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("mic")}
              class={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab() === "mic"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Mic class="h-3.5 w-3.5" />
              Microphone Capture
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              class={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab() === "upload"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Upload class="h-3.5 w-3.5" />
              Upload Audio File
            </button>
          </div>

          {/* Tab 1: Mic */}
          <Show when={activeTab() === "mic"}>
            <Show when={insecureNotice}>
              <div class="mt-4 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs space-y-2">
                <div class="flex items-center gap-2 font-bold text-amber-400">
                  <AlertCircle class="h-4 w-4 shrink-0" />
                  <span>Microphone Access Notice (Secure Context Required)</span>
                </div>
                <p class="leading-relaxed text-[11px]">
                  Web browsers strictly prohibit microphone access on non-localhost HTTP origins (current URL: <code class="px-1 py-0.5 rounded bg-black/40 font-mono text-amber-300">{typeof window !== 'undefined' ? window.location.origin : ''}</code>).
                </p>
                <div class="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("upload")}
                    class="h-7 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-200"
                  >
                    <Upload class="h-3.5 w-3.5 mr-1" /> Use File Upload Tab
                  </Button>
                  <Show when={typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'}>
                    <a
                      href={`http://localhost:${typeof window !== 'undefined' ? window.location.port || '5173' : '5173'}${typeof window !== 'undefined' ? window.location.pathname : ''}`}
                      class="text-xs text-primary underline font-mono hover:opacity-80 flex items-center gap-1"
                    >
                      Open via http://localhost:{typeof window !== 'undefined' ? window.location.port || '5173' : '5173'}
                    </a>
                  </Show>
                </div>
              </div>
            </Show>
            <div class="mt-4 flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-border bg-secondary/30 space-y-4">
              <div class="flex items-center gap-2 text-xs font-mono font-semibold">
                <Show
                  when={isRecording()}
                  fallback={<span class="text-muted-foreground">Ready to record (5–10 seconds recommended)</span>}
                >
                  <span class="h-2.5 w-2.5 rounded-full bg-destructive animate-ping" />
                  <span class="text-destructive font-bold">RECORDING... {recordingSeconds()}s / 15s</span>
                </Show>
              </div>

              {/* Volume VU Meter */}
              <div class="w-full h-3 rounded-full bg-secondary overflow-hidden border border-border">
                <div
                  class="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, volumeLevel() * 100)}%` }}
                />
              </div>

              <div class="flex items-center gap-3">
                <Show
                  when={isRecording()}
                  fallback={
                    <Button
                      size="sm"
                      onClick={() => void handleStartRecording()}
                      class="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                    >
                      <Mic class="h-4 w-4" /> Start Recording
                    </Button>
                  }
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleStopRecording()}
                    class="gap-2 border-destructive text-destructive hover:bg-destructive/10 font-semibold"
                  >
                    <Square class="h-4 w-4 fill-current" /> Stop Recording
                  </Button>
                </Show>
              </div>
            </div>
          </Show>

          {/* Tab 2: Upload */}
          <Show when={activeTab() === "upload"}>
            <div class="mt-4 flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-border bg-secondary/30 text-center">
              <Upload class="h-8 w-8 text-muted-foreground mb-2" />
              <p class="text-xs font-medium text-foreground">Drag & drop or select an audio reference sample</p>
              <p class="text-[11px] text-muted-foreground mt-0.5">Supports WAV, MP3, FLAC, OGG (16–48kHz)</p>
              <label class="mt-3 cursor-pointer">
                <Button size="sm" variant="outline" class="pointer-events-none">
                  Choose Audio File
                </Button>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  class="hidden"
                />
              </label>
            </div>
          </Show>

          {/* Audio Preview Strip */}
          <Show when={audioDataUri()}>
            <div class="mt-4 p-3 rounded-xl border border-border bg-surface flex items-center justify-between gap-3">
              <audio
                ref={(el) => {
                  previewAudioEl = el;
                }}
                src={audioDataUri() || ""}
                onEnded={() => setIsPlayingPreview(false)}
                class="hidden"
              />
              <div class="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={togglePreview}
                  class="h-8 w-8 p-0 rounded-full"
                >
                  <Show when={isPlayingPreview()} fallback={<Play class="h-3.5 w-3.5 fill-current" />}>
                    <Pause class="h-3.5 w-3.5 fill-current" />
                  </Show>
                </Button>
                <div class="space-y-0.5">
                  <p class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />
                    Audio Sample Ready
                  </p>
                  <p class="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Volume2 class="h-3 w-3" />
                    Reference waveform calibrated
                  </p>
                </div>
              </div>
            </div>
          </Show>

          {/* Voice Name Input */}
          <div class="mt-4 space-y-1.5">
            <label class="text-xs font-semibold text-foreground">Cloned Voice Name</label>
            <Input
              value={voiceName()}
              onInput={(e) => setVoiceName(e.currentTarget.value)}
              placeholder="e.g. Studio Pro Voice / Hai Dang Clone"
              class="h-9 text-xs"
            />
          </div>

          {/* Footer */}
          <div class="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
            <Button size="sm" variant="outline" onClick={handleClose} disabled={isSubmitting()}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleRegisterVoice()}
              disabled={isSubmitting() || !audioDataUri() || !voiceName().trim()}
              class="gap-1.5 font-semibold"
            >
              <Sparkles class="h-3.5 w-3.5" />
              {isSubmitting() ? "Registering..." : "Clone & Register Voice"}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};
