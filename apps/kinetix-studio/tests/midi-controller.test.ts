import { describe, it, expect } from 'bun:test';
import {
  WebMidiManager,
  MIDI_CC,
  type MidiControlChangeEvent,
  type MidiNoteEvent,
} from '../src/lib/midi-controller';

describe('Studio-Grade Web MIDI Controller Manager Suite', () => {
  it('exposes standard studio MIDI CC controller mappings', () => {
    expect(MIDI_CC.MOD_WHEEL).toBe(1);
    expect(MIDI_CC.VOLUME).toBe(7);
    expect(MIDI_CC.PAN).toBe(10);
    expect(MIDI_CC.CUTOFF).toBe(74);
    expect(MIDI_CC.RESONANCE).toBe(71);
    expect(MIDI_CC.SLIDER_1).toBe(16);
  });

  it('safely queries environment support without crashing in non-browser runtimes', () => {
    const supported = WebMidiManager.isSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('manages subscriber lifecycle with clean unsubscribes', () => {
    const manager = new WebMidiManager();

    let ccCalls = 0;
    const unsubCc = manager.onControlChange((_e) => {
      ccCalls++;
    });

    let noteCalls = 0;
    const unsubNote = manager.onNote((_e) => {
      noteCalls++;
    });

    let stateCalls = 0;
    const unsubState = manager.onStateChange((_d) => {
      stateCalls++;
    });

    expect(typeof unsubCc).toBe('function');
    expect(typeof unsubNote).toBe('function');
    expect(typeof unsubState).toBe('function');

    unsubCc();
    unsubNote();
    unsubState();

    expect(ccCalls).toBe(0);
    expect(noteCalls).toBe(0);
    expect(stateCalls).toBe(0);

    manager.disconnect();
  });

  it('cleans up resources cleanly via explicit disposal Symbol.dispose', () => {
    const manager = new WebMidiManager();
    expect(() => {
      manager[Symbol.dispose]();
    }).not.toThrow();

    // Calling dispose a second time is idempotent
    expect(() => {
      manager[Symbol.dispose]();
    }).not.toThrow();
  });

  it('correctly simulates and decodes standard 3-byte MIDI messages', () => {
    const manager = new WebMidiManager();

    let receivedCc: MidiControlChangeEvent | null = null;
    manager.onControlChange((e) => {
      receivedCc = e;
    });

    let receivedNote: MidiNoteEvent | null = null;
    manager.onNote((e) => {
      receivedNote = e;
    });

    // Invoke private handleMidiMessage via prototype or simulated event
    const handleMessage = (manager as any).handleMidiMessage.bind(manager);

    // 1. Control Change message: Status 0xB0 (Channel 1 CC), CC 74 (Cutoff), Value 64 (50%)
    handleMessage('Test Controller', {
      data: new Uint8Array([0xb0, 74, 64]),
      timeStamp: 1234.5,
    });

    expect(receivedCc).not.toBeNull();
    expect(receivedCc!.channel).toBe(1);
    expect(receivedCc!.controller).toBe(74);
    expect(receivedCc!.value).toBe(64);
    expect(receivedCc!.normalizedValue).toBeCloseTo(64 / 127, 3);
    expect(receivedCc!.deviceName).toBe('Test Controller');

    // 2. Note On message: Status 0x90 (Channel 1 Note On), Note 60 (Middle C), Velocity 100
    handleMessage('Test Keyboard', {
      data: new Uint8Array([0x90, 60, 100]),
      timeStamp: 1250.0,
    });

    expect(receivedNote).not.toBeNull();
    expect(receivedNote!.type).toBe('noteOn');
    expect(receivedNote!.note).toBe(60);
    expect(receivedNote!.velocity).toBe(100);
    expect(receivedNote!.normalizedVelocity).toBeCloseTo(100 / 127, 3);

    // 3. Note On with Velocity 0 converts to Note Off
    handleMessage('Test Keyboard', {
      data: new Uint8Array([0x90, 60, 0]),
      timeStamp: 1260.0,
    });

    expect(receivedNote!.type).toBe('noteOff');
    expect(receivedNote!.velocity).toBe(0);

    // 4. Note Off message: Status 0x80
    handleMessage('Test Keyboard', {
      data: new Uint8Array([0x80, 64, 64]),
      timeStamp: 1270.0,
    });

    expect(receivedNote!.type).toBe('noteOff');
    expect(receivedNote!.note).toBe(64);

    manager.disconnect();
  });
});
