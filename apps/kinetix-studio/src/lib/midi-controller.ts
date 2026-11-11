// ============================================================================
// KINETIX STUDIO - STUDIO-GRADE WEB MIDI CONTROLLER MANAGER (ECMA-429)
// Provides low-latency (<16ms) hardware MIDI mapping for live stage performance,
// VJ projection mapping, parameter binding, and synthesizer modulation.
// ============================================================================

export const MIDI_CC = {
  MOD_WHEEL: 1,
  BREATH: 2,
  VOLUME: 7,
  PAN: 10,
  EXPRESSION: 11,
  SLIDER_1: 16,
  SLIDER_2: 17,
  SLIDER_3: 18,
  SLIDER_4: 19,
  RESONANCE: 71,
  RELEASE_TIME: 72,
  ATTACK_TIME: 73,
  CUTOFF: 74,
} as const;

export interface MidiControlChangeEvent {
  readonly channel: number;
  readonly controller: number;
  readonly value: number; // 0 to 127
  readonly normalizedValue: number; // 0.0 to 1.0
  readonly timestamp: number;
  readonly deviceName: string;
}

export interface MidiNoteEvent {
  readonly type: 'noteOn' | 'noteOff';
  readonly channel: number;
  readonly note: number;
  readonly velocity: number;
  readonly normalizedVelocity: number;
  readonly timestamp: number;
  readonly deviceName: string;
}

export interface MidiDeviceInfo {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly state: string;
  readonly connection: string;
}

type ControlChangeSubscriber = (event: MidiControlChangeEvent) => void;
type NoteSubscriber = (event: MidiNoteEvent) => void;
type DeviceStateSubscriber = (devices: readonly MidiDeviceInfo[]) => void;

/**
 * Universal Web MIDI hardware manager with explicit resource disposal.
 */
export class WebMidiManager {
  private midiAccess: MIDIAccess | null = null;
  private readonly ccSubscribers = new Set<ControlChangeSubscriber>();
  private readonly noteSubscribers = new Set<NoteSubscriber>();
  private readonly stateSubscribers = new Set<DeviceStateSubscriber>();
  private isDisposed = false;

  /**
   * Checks whether the current browser or web runtime supports the W3C Web MIDI API.
   */
  public static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess === 'function'
    );
  }

  /**
   * Requests MIDI hardware access and registers input listeners.
   */
  public async initialize(): Promise<boolean> {
    if (!WebMidiManager.isSupported()) {
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.bindInputs();

      this.midiAccess.onstatechange = () => {
        if (this.isDisposed) return;
        this.bindInputs();
        this.notifyStateSubscribers();
      };

      return true;
    } catch (err) {
      console.warn('Web MIDI access request failed or rejected:', err);
      return false;
    }
  }

  private bindInputs(): void {
    if (!this.midiAccess || this.isDisposed) return;

    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = (event: MIDIMessageEvent) => {
        this.handleMidiMessage(input.name || 'MIDI Device', event);
      };
    }
  }

  private handleMidiMessage(deviceName: string, event: MIDIMessageEvent): void {
    if (this.isDisposed || !event.data || event.data.length < 2) return;

    const [statusByte, data1 = 0, data2 = 0] = event.data;
    const command = statusByte >> 4;
    const channel = (statusByte & 0x0f) + 1;
    const timestamp = event.timeStamp || (typeof performance !== 'undefined' ? performance.now() : 0);

    // 0x0B = Control Change
    if (command === 0x0b) {
      const ccEvent: MidiControlChangeEvent = {
        channel,
        controller: data1,
        value: data2,
        normalizedValue: data2 / 127.0,
        timestamp,
        deviceName,
      };
      for (const sub of this.ccSubscribers) {
        sub(ccEvent);
      }
      return;
    }

    // 0x09 = Note On (velocity 0 is equivalent to Note Off)
    if (command === 0x09) {
      const isNoteOff = data2 === 0;
      const noteEvent: MidiNoteEvent = {
        type: isNoteOff ? 'noteOff' : 'noteOn',
        channel,
        note: data1,
        velocity: data2,
        normalizedVelocity: data2 / 127.0,
        timestamp,
        deviceName,
      };
      for (const sub of this.noteSubscribers) {
        sub(noteEvent);
      }
      return;
    }

    // 0x08 = Note Off
    if (command === 0x08) {
      const noteEvent: MidiNoteEvent = {
        type: 'noteOff',
        channel,
        note: data1,
        velocity: data2,
        normalizedVelocity: data2 / 127.0,
        timestamp,
        deviceName,
      };
      for (const sub of this.noteSubscribers) {
        sub(noteEvent);
      }
    }
  }

  /**
   * Retrieves an array of all connected MIDI input devices.
   */
  public getInputs(): MidiDeviceInfo[] {
    if (!this.midiAccess) return [];
    const devices: MidiDeviceInfo[] = [];
    for (const input of this.midiAccess.inputs.values()) {
      devices.push({
        id: input.id,
        name: input.name || 'Unknown MIDI Controller',
        manufacturer: input.manufacturer || 'Generic',
        state: input.state,
        connection: input.connection,
      });
    }
    return devices;
  }

  /**
   * Subscribes to Control Change (knobs, sliders, mod wheel) events.
   * Returns an unsubscribe function.
   */
  public onControlChange(callback: ControlChangeSubscriber): () => void {
    this.ccSubscribers.add(callback);
    return () => {
      this.ccSubscribers.delete(callback);
    };
  }

  /**
   * Subscribes to Note On / Note Off events.
   * Returns an unsubscribe function.
   */
  public onNote(callback: NoteSubscriber): () => void {
    this.noteSubscribers.add(callback);
    return () => {
      this.noteSubscribers.delete(callback);
    };
  }

  /**
   * Subscribes to hardware connection/disconnection state changes.
   * Returns an unsubscribe function.
   */
  public onStateChange(callback: DeviceStateSubscriber): () => void {
    this.stateSubscribers.add(callback);
    return () => {
      this.stateSubscribers.delete(callback);
    };
  }

  private notifyStateSubscribers(): void {
    const devices = this.getInputs();
    for (const sub of this.stateSubscribers) {
      sub(devices);
    }
  }

  /**
   * Disconnects all listeners and unbinds hardware ports.
   */
  public disconnect(): void {
    if (this.midiAccess) {
      for (const input of this.midiAccess.inputs.values()) {
        input.onmidimessage = null;
      }
      this.midiAccess.onstatechange = null;
      this.midiAccess = null;
    }
    this.ccSubscribers.clear();
    this.noteSubscribers.clear();
    this.stateSubscribers.clear();
  }

  /**
   * Implements explicit resource management (Symbol.dispose).
   */
  public [Symbol.dispose](): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.disconnect();
  }
}
