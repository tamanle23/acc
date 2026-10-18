/**
 * UniversalAudioMixer (Backward-Compatibility Bridge):
 * Re-exports the canonical platform-independent UniversalAudioMixer and audio adapters from @acc/ir/client.
 */
export {
  UniversalAudioMixer,
  type AudioMixerClip,
  type AudioMixResult,
  type AudioTrackType,
  type IAudioSourceProvider,
  DecodedPcmSource,
  ProceduralSynthesizerSource,
} from '@acc/ir/client';
