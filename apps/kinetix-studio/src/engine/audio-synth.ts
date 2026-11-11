// ============================================================================
// WEB AUDIO API STUDIO-GRADE ANALOG SYNTHESIZER ENGINE (4-VOICE POLYPHONY)
// Supports both Real-Time AudioContext & Deterministic OfflineAudioContext
// ============================================================================

import type { AudioTelemetry } from '@/types/motion';

export type SynthPatternId =
  | 'techno-4-on-floor'
  | 'lofi-jazz-swing'
  | 'cinematic-ambient-drone'
  | 'breakbeat-syncopated'
  | 'ambient-pulse'
  | 'minimal-downtempo'
  // Extended 10-Sphere Curatorial Patterns
  | 'minimal-click-glitch'
  | 'constructivist-percussion'
  | 'orthogonal-rhythm-sync'
  | 'ambient-drone-swell'
  | 'couture-sub-glide'
  | 'chamber-harp-ambient'
  | 'brass-fanfare-pulse'
  | 'lyre-ancient-modal'
  | 'nouvelle-vague-beat'
  | 'dramatic-timpani-roll'
  | 'post-punk-bass-line'
  | 'psychedelic-rock-organ'
  | 'industrial-noise-kick'
  | 'punk-grunge-fuzz'
  | 'organic-ambient-sine'
  | 'zen-water-flute'
  | 'nordic-wood-pulse'
  | 'sub-bass-rumble'
  | 'sonar-ping-sub'
  | 'cosmic-moog-glide'
  | 'y2k-liquid-dnb'
  | 'aerospace-telemetry-ping'
  | 'techno-909-acid'
  | 'sine-sweep-drone'
  | 'vapor-synth-arpeggio';

export interface SynthPatternDef {
  id: SynthPatternId;
  name: string;
  desc: string;
}

export const SYNTH_PATTERNS: SynthPatternDef[] = [
  { id: 'techno-4-on-floor', name: 'Techno 4-on-Floor', desc: 'Driving 4/4 kick with off-beat hats and 303 bass' },
  { id: 'lofi-jazz-swing', name: 'Lo-Fi Jazz Swing', desc: 'Swung brushed snare, warm Rhodes chords and vinyl warmth' },
  { id: 'cinematic-ambient-drone', name: 'Cinematic Ambient Drone', desc: 'Expansive harmonic sine swells and meditative drone beds' },
  { id: 'breakbeat-syncopated', name: 'Breakbeat Syncopated', desc: 'Syncopated rhythm with rapid hats and punchy kicks' },
  { id: 'ambient-pulse', name: 'Ambient Pulse', desc: 'Soft sub-bass pulses with harmonic pads and gentle clicks' },
  { id: 'minimal-downtempo', name: 'Minimal Downtempo', desc: 'Sparse dub kicks, warm filtered chords and micro-hats' },
  { id: 'minimal-click-glitch', name: 'Swiss Minimal Clicks', desc: 'Precision micro-ticks and sine sub pulses' },
  { id: 'constructivist-percussion', name: 'Constructivist Percussion', desc: 'Clockwork mechanical typewriter clicks and syncopated industrial wood' },
  { id: 'orthogonal-rhythm-sync', name: 'Orthogonal Rhythm', desc: 'De Stijl mathematical grid metronome and acoustic pulses' },
  { id: 'ambient-drone-swell', name: 'Ambient Drone Swell', desc: 'Slow-burn harmonic swells and ethereal luxury air' },
  { id: 'couture-sub-glide', name: 'Couture Sub Glide', desc: 'Subdued deep bass glides with runway micro-percussion' },
  { id: 'chamber-harp-ambient', name: 'Chamber Harp Ambient', desc: 'Secessionist modal harp arpeggios and cello overtones' },
  { id: 'brass-fanfare-pulse', name: 'Art Deco Brass Pulse', desc: '1920s brass fanfare stabs and streamlined pulse' },
  { id: 'lyre-ancient-modal', name: 'Hellenic Modal Lyre', desc: 'Dorian ancient modal pluck arpeggios and stone temple resonance' },
  { id: 'nouvelle-vague-beat', name: 'Nouvelle Vague Beat', desc: '60s French cinematic pop drum kit and syncopated jazz bass' },
  { id: 'dramatic-timpani-roll', name: 'Dramatic Timpani Roll', desc: 'Hitchcockian orchestral timpani accents and suspenseful brass' },
  { id: 'post-punk-bass-line', name: 'Post-Punk Bass Line', desc: 'Driving Peter Saville 8th-note chorus bass and crisp gated snare' },
  { id: 'psychedelic-rock-organ', name: 'Psychedelic Rock Organ', desc: 'Warm rotary speaker organ swells and fuzz bass' },
  { id: 'industrial-noise-kick', name: 'Industrial Noise Kick', desc: 'Heavy saturated kick with risograph screenprint noise bursts' },
  { id: 'punk-grunge-fuzz', name: 'Punk Grunge Fuzz', desc: '152 BPM driving punk power chord bass and distorted snare' },
  { id: 'organic-ambient-sine', name: 'Organic Ambient Sine', desc: 'Gentle biophilic sine waves and harmonic garden rustle' },
  { id: 'zen-water-flute', name: 'Zen Water & Flute', desc: 'Meditative shakuhachi breath, singing bowl and water drops' },
  { id: 'nordic-wood-pulse', name: 'Nordic Wood Pulse', desc: 'Organic birch woodblock percussion and warm sub pulse' },
  { id: 'sub-bass-rumble', name: 'Brutalist Sub Rumble', desc: 'Heavy monolithic concrete low-end sub frequencies' },
  { id: 'sonar-ping-sub', name: 'Sonar Hydrophone Ping', desc: 'Deep ocean hydrophone pings and bathymetric resonance' },
  { id: 'cosmic-moog-glide', name: 'Afrofuturist Moog Glide', desc: 'Sun Ra portamento synth sweeps and cosmic talking drums' },
  { id: 'y2k-liquid-dnb', name: 'Y2K Liquid DnB', desc: '168 BPM chopped amen break and rolling 808 sub-bass' },
  { id: 'aerospace-telemetry-ping', name: 'Aerospace Telemetry Ping', desc: 'NASA Voyager radar sweeps and shortwave pulses' },
  { id: 'techno-909-acid', name: 'Techno 909 Acid', desc: 'Pounding 909 kick with screaming resonant 303 acid line' },
  { id: 'sine-sweep-drone', name: 'Op-Art Sine Sweep', desc: 'Optical frequency moiré sweep and perceptual binaural tones' },
  { id: 'vapor-synth-arpeggio', name: 'Vapor Synth Arpeggio', desc: '1984 DX7 synth arpeggios and vintage VHS tape compression' },
];

export interface VoiceMuteMap {
  kick: boolean;
  bass: boolean;
  hat: boolean;
  pad: boolean;
}

export interface SynthConfig {
  masterVolume: number;
  filterCutoff: number;
  filterResonance: number;
  pattern: SynthPatternId;
  mutes: VoiceMuteMap;
}

export interface RenderAudioTrackOfflineOptions {
  bpm: number;
  durationSec: number;
  sampleRate?: number;
  pattern?: SynthPatternId;
  volume?: number;
  cutoff?: number;
  resonance?: number;
  mutes?: Partial<VoiceMuteMap>;
}

export class AnalogAudioSynth {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private beatStep = 0;
  private pattern: SynthPatternId = 'techno-4-on-floor';
  private mutes: VoiceMuteMap = {
    kick: false,
    bass: false,
    hat: false,
    pad: false,
  };
  private masterVolume = 0.7;
  private filterCutoff = 4200;
  private filterResonance = 3.5;
  private isUserGestureUnlocked = false;
  private isResuming = false;

  /**
   * Explicitly resumes the Web Audio AudioContext upon user gesture.
   */
  public async resume(): Promise<boolean> {
    this.isUserGestureUnlocked = true;
    if (typeof window === 'undefined') return false;
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        return true;
      } catch {
        return false;
      }
    }
    return ctx?.state === 'running';
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioCtx();
        this.setupMasterBus(this.audioCtx);
        this.createNoiseBuffer(this.audioCtx);
      } catch {
        return null;
      }
    }

    // Only attempt resume if unlocked via user gesture, preventing repetitive autoplay policy warnings
    if (this.audioCtx.state === 'suspended' && this.isUserGestureUnlocked && !this.isResuming) {
      this.isResuming = true;
      this.audioCtx
        .resume()
        .then(() => {
          this.isResuming = false;
        })
        .catch(() => {
          this.isResuming = false;
        });
    }

    return this.audioCtx;
  }

  private setupMasterBus(ctx: AudioContext): void {
    // 1. Analyser Node for Real-Time FFT Spectrum Analysis
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 64;
    this.analyserNode.smoothingTimeConstant = 0.75;
    this.analyserNode.minDecibels = -85;
    this.analyserNode.maxDecibels = -10;

    // 2. Master Resonant Lowpass Filter
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(this.filterCutoff, ctx.currentTime);
    this.filterNode.Q.setValueAtTime(this.filterResonance, ctx.currentTime);

    // 3. Master Gain Bus
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, ctx.currentTime);

    // Chain: Input -> Filter -> Master Gain -> Analyser -> Destination
    this.filterNode.connect(this.masterGain);
    this.masterGain.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);
  }

  private createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
    // Generate 0.5s of stereo white noise for percussion & hats
    const bufferSize = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  // --------------------------------------------------------------------------
  // POLYPHONIC VOICES (PARAMETRIC OVER BaseAudioContext)
  // --------------------------------------------------------------------------

  /**
   * Voice 1: 909 Punchy Sub-Bass Kick
   */
  private triggerKick(ctx: BaseAudioContext, now: number, targetBus: AudioNode): void {
    if (this.mutes.kick) return;

    // Sub-bass sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    // Transient click for punch
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(320, now);
    clickOsc.frequency.exponentialRampToValueAtTime(50, now + 0.025);
    clickGain.gain.setValueAtTime(0.2, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(targetBus);
    clickOsc.connect(clickGain);
    clickGain.connect(targetBus);

    osc.start(now);
    osc.stop(now + 0.19);
    clickOsc.start(now);
    clickOsc.stop(now + 0.035);
  }

  /**
   * Voice 2: 303 Resonant Acid Bassline (Sawtooth + Envelope Filter)
   */
  private triggerAcidBass(
    ctx: BaseAudioContext,
    now: number,
    noteFreq: number,
    accent: boolean,
    targetBus: AudioNode
  ): void {
    if (this.mutes.bass) return;

    const osc = ctx.createOscillator();
    const voiceFilter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(noteFreq, now);

    // 303 Resonant Filter Envelope
    voiceFilter.type = 'lowpass';
    voiceFilter.Q.setValueAtTime(accent ? 9.5 : 5.5, now);
    const startCutoff = accent ? 2800 : 1200;
    const endCutoff = accent ? 220 : 140;
    voiceFilter.frequency.setValueAtTime(startCutoff, now);
    voiceFilter.frequency.exponentialRampToValueAtTime(endCutoff, now + 0.14);

    const amp = accent ? 0.22 : 0.14;
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(voiceFilter);
    voiceFilter.connect(gain);
    gain.connect(targetBus);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Voice 3: Percussive Hi-Hat / Shaker (White Noise + Bandpass)
   */
  private triggerHiHat(
    ctx: BaseAudioContext,
    now: number,
    isOpen: boolean,
    targetBus: AudioNode,
    noiseBuf: AudioBuffer | null
  ): void {
    if (this.mutes.hat || !noiseBuf) return;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(8500, now);
    bandpass.Q.setValueAtTime(2.2, now);

    const gain = ctx.createGain();
    const decay = isOpen ? 0.14 : 0.045;
    gain.gain.setValueAtTime(isOpen ? 0.16 : 0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(targetBus);

    noise.start(now);
    noise.stop(now + decay + 0.01);
  }

  /**
   * Voice 4: Ambient Drone / Chord Pad (Detuned Dual Oscillators)
   */
  private triggerPad(
    ctx: BaseAudioContext,
    now: number,
    rootFreq: number,
    targetBus: AudioNode
  ): void {
    if (this.mutes.pad) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(rootFreq, now);
    // Subtle detune for lush cinematic width
    osc2.frequency.setValueAtTime(rootFreq * 1.502, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(targetBus);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.58);
    osc2.stop(now + 0.58);
  }

  /**
   * Voice 5: Brushed Noise Snare for Lo-Fi / Jazz
   */
  private triggerBrushedSnare(
    ctx: BaseAudioContext,
    now: number,
    targetBus: AudioNode,
    noiseBuf: AudioBuffer | null
  ): void {
    if (this.mutes.hat || !noiseBuf) return;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(targetBus);

    noise.start(now);
    noise.stop(now + 0.25);
  }

  /**
   * Voice 6: Lo-Fi Rhodes / Electric Piano Chords
   */
  private triggerRhodesChord(
    ctx: BaseAudioContext,
    now: number,
    chordIndex: number,
    targetBus: AudioNode
  ): void {
    if (this.mutes.pad) return;

    // Harmonic jazz progressions: Dm9, G13, Cmaj9, Am9
    const progressions = [
      [146.83, 174.61, 220.0, 261.63, 329.63], // Dm9
      [98.0, 174.61, 246.94, 329.63],          // G13
      [130.81, 164.81, 196.0, 246.94, 293.66], // Cmaj9
      [110.0, 164.81, 220.0, 261.63, 329.63],  // Am9
    ];
    const freqs = progressions[chordIndex % progressions.length] || progressions[0]!;

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const vel = 0.06 / Math.sqrt(freqs.length);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vel, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(gain);
      gain.connect(targetBus);

      osc.start(now);
      osc.stop(now + 0.88);
    });
  }

  /**
   * Voice 7: Cinematic Ambient Drone Harmonic Swell
   */
  private triggerAmbientDroneSwell(
    ctx: BaseAudioContext,
    now: number,
    rootFreq: number,
    targetBus: AudioNode
  ): void {
    if (this.mutes.pad) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc3.type = 'sine';

    osc1.frequency.setValueAtTime(rootFreq, now);
    osc2.frequency.setValueAtTime(rootFreq * 1.503, now); // Detuned 5th
    osc3.frequency.setValueAtTime(rootFreq * 2.001, now); // Octave

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.linearRampToValueAtTime(1400, now + 0.9);
    filter.frequency.linearRampToValueAtTime(550, now + 1.8);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.95);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);
    gain.connect(targetBus);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + 2.0);
    osc2.stop(now + 2.0);
    osc3.stop(now + 2.0);
  }

  // --------------------------------------------------------------------------
  // DETERMINISTIC STEP SCHEDULING (SHARED BY LIVE & OFFLINE)
  // --------------------------------------------------------------------------

  private scheduleStepOnContext(
    ctx: BaseAudioContext,
    step: number,
    time: number,
    bpmVal: number,
    targetBus: AudioNode,
    noiseBuf: AudioBuffer | null
  ): void {
    const acidScale = [55, 65.4, 73.4, 82.4, 98, 110, 130.8, 146.8];

    switch (this.pattern) {
      case 'techno-4-on-floor': {
        // 4-on-the-floor Kick every 4 steps
        if (step % 4 === 0) {
          this.triggerKick(ctx, time, targetBus);
        }
        // Off-beat open hat on steps 2, 6, 10, 14; closed hat on others
        if (step % 4 === 2) {
          this.triggerHiHat(ctx, time, true, targetBus, noiseBuf);
        } else if (step % 2 === 1) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        // 303 Acid line syncopated
        if (step % 2 === 0 || step === 7 || step === 15) {
          const note = acidScale[step % acidScale.length]! * (bpmVal > 132 ? 2 : 1);
          const isAccented = step === 0 || step === 6 || step === 10;
          this.triggerAcidBass(ctx, time, note, isAccented, targetBus);
        }
        // Warm pad sweep every bar (16 steps)
        if (step === 0) {
          this.triggerPad(ctx, time, 55, targetBus);
        }
        break;
      }

      case 'lofi-jazz-swing': {
        // Soft acoustic kick on 0 and 8
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        // Brushed snare on 4 and 12 (backbeat)
        if (step === 4 || step === 12) {
          this.triggerBrushedSnare(ctx, time, targetBus, noiseBuf);
        }
        // Soft closed hats on swing 16ths
        if (step % 2 === 1 || step === 2 || step === 10) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        // Warm Rhodes chords on 0 and 8
        if (step === 0) {
          this.triggerRhodesChord(ctx, time, 0, targetBus);
        } else if (step === 8) {
          this.triggerRhodesChord(ctx, time, 1, targetBus);
        }
        // Subdued upright bass
        if (step === 0 || step === 6 || step === 10 || step === 14) {
          const bassNote = [73.4, 65.4, 98.0, 82.4][(step / 4) | 0] || 73.4;
          this.triggerAcidBass(ctx, time, bassNote, false, targetBus);
        }
        break;
      }

      case 'cinematic-ambient-drone': {
        // Expansive harmonic sine drone swells on step 0 and 8
        if (step === 0) {
          this.triggerAmbientDroneSwell(ctx, time, 65.41, targetBus); // C2
        } else if (step === 8) {
          this.triggerAmbientDroneSwell(ctx, time, 73.42, targetBus); // D2
        }
        // Soft sub-harmonic grounding pulse
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        // Distant gentle pad harmonic
        if (step === 4 || step === 12) {
          this.triggerPad(ctx, time, 130.81, targetBus);
        }
        break;
      }

      case 'breakbeat-syncopated': {
        if (step === 0 || step === 6 || step === 10) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step % 2 === 1 || step === 4 || step === 12) {
          this.triggerHiHat(ctx, time, step === 4 || step === 12, targetBus, noiseBuf);
        }
        if (step === 2 || step === 7 || step === 11 || step === 14) {
          const note = acidScale[(step * 2) % acidScale.length]!;
          this.triggerAcidBass(ctx, time, note, step === 2 || step === 11, targetBus);
        }
        if (step === 0 || step === 8) {
          this.triggerPad(ctx, time, 65.4, targetBus);
        }
        break;
      }

      case 'ambient-pulse': {
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step === 4 || step === 12) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        if (step === 0 || step === 8) {
          this.triggerPad(ctx, time, step === 0 ? 55 : 49, targetBus);
        }
        if (step === 4 || step === 12) {
          this.triggerAcidBass(ctx, time, 110, false, targetBus);
        }
        break;
      }

      case 'minimal-downtempo': {
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step % 4 === 2) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        if (step === 3 || step === 7 || step === 11) {
          const note = acidScale[step % acidScale.length]!;
          this.triggerAcidBass(ctx, time, note, step === 3, targetBus);
        }
        if (step === 0) {
          this.triggerPad(ctx, time, 73.4, targetBus);
        }
        break;
      }

      case 'minimal-click-glitch': {
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step % 2 === 1) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        break;
      }

      case 'constructivist-percussion': {
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step === 4 || step === 12) {
          this.triggerBrushedSnare(ctx, time, targetBus, noiseBuf);
        }
        if (step % 2 === 1 || step === 6 || step === 14) {
          this.triggerHiHat(ctx, time, step % 4 === 2, targetBus, noiseBuf);
        }
        break;
      }

      case 'orthogonal-rhythm-sync': {
        if (step % 4 === 0) {
          this.triggerKick(ctx, time, targetBus);
          this.triggerAcidBass(ctx, time, 110, false, targetBus);
        }
        if (step % 4 === 2) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        break;
      }

      case 'ambient-drone-swell':
      case 'couture-sub-glide': {
        if (step === 0) {
          this.triggerAmbientDroneSwell(ctx, time, 55, targetBus);
          this.triggerKick(ctx, time, targetBus);
        } else if (step === 8) {
          this.triggerAmbientDroneSwell(ctx, time, 73.4, targetBus);
        }
        break;
      }

      case 'chamber-harp-ambient':
      case 'lyre-ancient-modal': {
        if (step === 0 || step === 4 || step === 8 || step === 12) {
          this.triggerRhodesChord(ctx, time, (step / 4) % 2, targetBus);
        }
        if (step === 0) {
          this.triggerPad(ctx, time, 65.4, targetBus);
        }
        break;
      }

      case 'brass-fanfare-pulse': {
        if (step % 4 === 0) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step === 0 || step === 3 || step === 6 || step === 8 || step === 11 || step === 14) {
          const note = acidScale[step % acidScale.length]! * 1.5;
          this.triggerAcidBass(ctx, time, note, true, targetBus);
        }
        break;
      }

      case 'nouvelle-vague-beat': {
        if (step % 4 === 0) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step % 4 === 2) {
          this.triggerHiHat(ctx, time, true, targetBus, noiseBuf);
        } else if (step % 2 === 1) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        if (step === 0 || step === 6 || step === 10) {
          this.triggerAcidBass(ctx, time, 82.4, false, targetBus);
        }
        break;
      }

      case 'dramatic-timpani-roll': {
        if (step === 0 || step === 4 || step === 8 || step === 10 || step === 12) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step === 0) {
          this.triggerAmbientDroneSwell(ctx, time, 49.0, targetBus);
        }
        break;
      }

      case 'post-punk-bass-line': {
        if (step % 2 === 0) {
          const bassNote = acidScale[(step / 2) % acidScale.length]!;
          this.triggerAcidBass(ctx, time, bassNote, step === 0 || step === 8, targetBus);
        }
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step === 4 || step === 12) {
          this.triggerBrushedSnare(ctx, time, targetBus, noiseBuf);
        }
        if (step % 2 === 1) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        break;
      }

      case 'psychedelic-rock-organ': {
        if (step === 0) {
          this.triggerPad(ctx, time, 65.4, targetBus);
          this.triggerKick(ctx, time, targetBus);
        } else if (step === 8) {
          this.triggerPad(ctx, time, 73.4, targetBus);
        }
        if (step === 0 || step === 3 || step === 6 || step === 10 || step === 14) {
          const note = acidScale[step % acidScale.length]!;
          this.triggerAcidBass(ctx, time, note, step === 0, targetBus);
        }
        break;
      }

      case 'industrial-noise-kick': {
        if (step % 4 === 0) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step === 4 || step === 12) {
          this.triggerBrushedSnare(ctx, time, targetBus, noiseBuf);
        }
        if (step % 2 === 1) {
          this.triggerHiHat(ctx, time, true, targetBus, noiseBuf);
        }
        break;
      }

      case 'punk-grunge-fuzz': {
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step === 4 || step === 12) {
          this.triggerBrushedSnare(ctx, time, targetBus, noiseBuf);
        }
        if (step % 2 === 0) {
          this.triggerAcidBass(ctx, time, 98.0, step === 0 || step === 8, targetBus);
        }
        break;
      }

      case 'organic-ambient-sine':
      case 'zen-water-flute': {
        if (step === 0) {
          this.triggerPad(ctx, time, 55, targetBus);
        }
        if (step === 8) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        break;
      }

      case 'nordic-wood-pulse': {
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step % 4 === 2) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        if (step === 4 || step === 12) {
          this.triggerAcidBass(ctx, time, 73.4, false, targetBus);
        }
        break;
      }

      case 'sub-bass-rumble': {
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
          this.triggerAcidBass(ctx, time, 41.2, true, targetBus);
        }
        break;
      }

      case 'sonar-ping-sub':
      case 'aerospace-telemetry-ping': {
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step % 4 === 0) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        break;
      }

      case 'cosmic-moog-glide': {
        if (step === 0 || step === 6 || step === 10) {
          const note = acidScale[step % acidScale.length]! * 1.5;
          this.triggerAcidBass(ctx, time, note, step === 0, targetBus);
        }
        if (step === 0) {
          this.triggerPad(ctx, time, 55, targetBus);
        }
        break;
      }

      case 'y2k-liquid-dnb': {
        if (step === 0 || step === 6 || step === 10) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step === 4 || step === 12) {
          this.triggerBrushedSnare(ctx, time, targetBus, noiseBuf);
        }
        if (step % 2 === 1) {
          this.triggerHiHat(ctx, time, step === 2 || step === 14, targetBus, noiseBuf);
        }
        if (step % 4 === 0) {
          this.triggerAcidBass(ctx, time, 49.0, true, targetBus);
        }
        break;
      }

      case 'techno-909-acid': {
        if (step % 4 === 0) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step % 4 === 2) {
          this.triggerHiHat(ctx, time, true, targetBus, noiseBuf);
        } else if (step % 2 === 1) {
          this.triggerHiHat(ctx, time, false, targetBus, noiseBuf);
        }
        if (step % 2 === 0 || step === 7 || step === 15) {
          const note = acidScale[step % acidScale.length]! * (bpmVal > 132 ? 2 : 1);
          this.triggerAcidBass(ctx, time, note, step === 0 || step === 6 || step === 10, targetBus);
        }
        break;
      }

      case 'sine-sweep-drone': {
        if (step === 0) {
          this.triggerAmbientDroneSwell(ctx, time, 82.4, targetBus);
        } else if (step === 8) {
          this.triggerAmbientDroneSwell(ctx, time, 110.0, targetBus);
        }
        break;
      }

      case 'vapor-synth-arpeggio': {
        if (step % 2 === 0) {
          const note = acidScale[(step * 3) % acidScale.length]! * 2;
          this.triggerAcidBass(ctx, time, note, step === 0 || step === 8, targetBus);
        }
        if (step === 0 || step === 8) {
          this.triggerKick(ctx, time, targetBus);
        }
        if (step === 4 || step === 12) {
          this.triggerBrushedSnare(ctx, time, targetBus, noiseBuf);
        }
        if (step === 0) {
          this.triggerPad(ctx, time, 65.4, targetBus);
        }
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // LIVE PLAYBACK INTERFACE
  // --------------------------------------------------------------------------

  public triggerStep(stepIndex: number, bpmVal: number, time?: number): void {
    try {
      // Avoid calling getAudioContext if suspended without user gesture
      if (this.audioCtx && this.audioCtx.state === 'suspended' && !this.isUserGestureUnlocked) {
        return;
      }
      const ctx = this.getAudioContext();
      if (!ctx || ctx.state === 'suspended' || !this.filterNode) return;
      let now = time ?? ctx.currentTime;
      const step = ((stepIndex % 16) + 16) % 16;
      if (this.pattern === 'lofi-jazz-swing' && step % 2 === 1) {
        const sixteenthSec = 60 / Math.max(40, bpmVal) / 4;
        now += sixteenthSec * 0.33;
      }
      this.scheduleStepOnContext(ctx, step, now, bpmVal, this.filterNode, this.noiseBuffer);
    } catch {
      // Ignore autoplay lock
    }
  }

  public triggerBeat(bpmVal: number): void {
    this.isUserGestureUnlocked = true;
    this.resume().catch(() => {});
    const step = this.beatStep;
    this.beatStep = (step + 1) % 16;
    this.triggerStep(step, bpmVal);
  }

  // --------------------------------------------------------------------------
  // OFFLINE DETERMINISTIC AUDIO TRACK RENDERER (SAMPLE-ACCURATE)
  // --------------------------------------------------------------------------

  public async renderAudioTrackOffline(
    options: RenderAudioTrackOfflineOptions
  ): Promise<AudioBuffer> {
    const {
      bpm,
      durationSec,
      sampleRate = 44100,
      pattern = this.pattern,
      volume = this.masterVolume,
      cutoff = this.filterCutoff,
      resonance = this.filterResonance,
      mutes,
    } = options;
    const totalSamples = Math.max(1, Math.floor(sampleRate * durationSec));

    const globalScope =
      typeof globalThis !== 'undefined'
        ? globalThis
        : typeof window !== 'undefined'
        ? window
        : typeof self !== 'undefined'
        ? self
        : {};

    const OfflineCtxClass =
      (globalScope as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext ||
      (globalScope as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext ||
      null;

    if (!OfflineCtxClass) {
      // Node / test environment mock
      return {
        length: totalSamples,
        duration: durationSec,
        numberOfChannels: 2,
        sampleRate,
        getChannelData: () => new Float32Array(totalSamples),
        copyFromChannel: () => {},
        copyToChannel: () => {},
      } as unknown as AudioBuffer;
    }

    const prevPattern = this.pattern;
    const prevVolume = this.masterVolume;
    const prevCutoff = this.filterCutoff;
    const prevResonance = this.filterResonance;
    const prevMutes = { ...this.mutes };

    try {
      this.pattern = pattern;
      this.masterVolume = volume;
      this.filterCutoff = cutoff;
      this.filterResonance = resonance;
      if (mutes) {
        this.mutes = { ...this.mutes, ...mutes };
      }

      const offlineCtx = new OfflineCtxClass(2, totalSamples, sampleRate);

      // Master filter and gain on offline context
      const offlineFilter = offlineCtx.createBiquadFilter();
      offlineFilter.type = 'lowpass';
      offlineFilter.frequency.setValueAtTime(this.filterCutoff, 0);
      offlineFilter.Q.setValueAtTime(this.filterResonance, 0);

      const offlineGain = offlineCtx.createGain();
      offlineGain.gain.setValueAtTime(this.masterVolume, 0);

      offlineFilter.connect(offlineGain);
      offlineGain.connect(offlineCtx.destination);

      // Create noise buffer for offline context
      const noiseLen = Math.floor(sampleRate * 0.5);
      const noiseBuffer = offlineCtx.createBuffer(1, noiseLen, sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }

      // Schedule each step deterministically
      const stepDuration = (60 / bpm) / 4;
      let stepTime = 0;
      let stepIndex = 0;

      while (stepTime < durationSec) {
        let actualTime = stepTime;
        if (this.pattern === 'lofi-jazz-swing' && stepIndex % 2 === 1) {
          actualTime += stepDuration * 0.33;
        }
        this.scheduleStepOnContext(
          offlineCtx,
          stepIndex % 16,
          actualTime,
          bpm,
          offlineFilter,
          noiseBuffer
        );
        stepTime += stepDuration;
        stepIndex++;
      }

      return await offlineCtx.startRendering();
    } finally {
      this.pattern = prevPattern;
      this.masterVolume = prevVolume;
      this.filterCutoff = prevCutoff;
      this.filterResonance = prevResonance;
      this.mutes = prevMutes;
    }
  }

  // --------------------------------------------------------------------------
  // REAL-TIME FFT & SPECTRUM API
  // --------------------------------------------------------------------------

  public getByteFrequencyData(targetArray: Uint8Array): void {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(targetArray as unknown as Uint8Array<ArrayBuffer>);
    } else {
      targetArray.fill(0);
    }
  }

  public getByteTimeDomainData(targetArray: Uint8Array): void {
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(targetArray as unknown as Uint8Array<ArrayBuffer>);
    } else {
      targetArray.fill(128);
    }
  }

  public getAudioLevel(): number {
    if (!this.analyserNode) return 0;
    const buffer = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(buffer as unknown as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i]!;
    }
    return sum / (buffer.length * 255);
  }

  public getAudioTelemetry(fallbackPulse = 1): AudioTelemetry {
    if (!this.analyserNode) {
      return {
        level: 0,
        bass: 0,
        mid: 0,
        high: 0,
        beatPulse: fallbackPulse,
      };
    }
    const binCount = this.analyserNode.frequencyBinCount;
    const buffer = new Uint8Array(binCount);
    this.analyserNode.getByteFrequencyData(buffer as unknown as Uint8Array<ArrayBuffer>);

    const bEnd = Math.max(1, Math.floor(binCount * 0.15));
    const mEnd = Math.max(bEnd + 1, Math.floor(binCount * 0.6));

    let bSum = 0;
    for (let i = 0; i < bEnd; i++) bSum += buffer[i]!;
    const bass = bSum / (bEnd * 255);

    let mSum = 0;
    for (let i = bEnd; i < mEnd; i++) mSum += buffer[i]!;
    const mid = mSum / ((mEnd - bEnd) * 255);

    let hSum = 0;
    for (let i = mEnd; i < binCount; i++) hSum += buffer[i]!;
    const high = hSum / ((binCount - mEnd) * 255);

    let totalSum = 0;
    for (let i = 0; i < binCount; i++) totalSum += buffer[i]!;
    const level = totalSum / (binCount * 255);

    return {
      level,
      bass,
      mid,
      high,
      beatPulse: fallbackPulse,
    };
  }

  // --------------------------------------------------------------------------
  // CONTROLS & RECONFIGURATIONS
  // --------------------------------------------------------------------------

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioCtx.currentTime);
    }
  }

  public setFilter(cutoff: number, resonance: number): void {
    this.filterCutoff = Math.max(100, Math.min(16000, cutoff));
    this.filterResonance = Math.max(0.1, Math.min(20, resonance));
    if (this.filterNode && this.audioCtx) {
      this.filterNode.frequency.setValueAtTime(this.filterCutoff, this.audioCtx.currentTime);
      this.filterNode.Q.setValueAtTime(this.filterResonance, this.audioCtx.currentTime);
    }
  }

  public setVoiceMutes(patch: Partial<VoiceMuteMap>): void {
    this.mutes = { ...this.mutes, ...patch };
  }

  public setPattern(pattern: SynthPatternId): void {
    this.pattern = pattern;
    this.beatStep = 0;
  }

  public getPattern(): SynthPatternId {
    return this.pattern;
  }

  public getVoiceMutes(): VoiceMuteMap {
    return { ...this.mutes };
  }

  public isAvailable(): boolean {
    return Boolean(this.audioCtx);
  }

  public reset(): void {
    this.beatStep = 0;
  }

  public dispose(): void {
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.masterGain = null;
      this.filterNode = null;
      this.analyserNode = null;
      this.noiseBuffer = null;
    }
  }
}
