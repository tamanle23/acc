import React from 'react';
import { Plus, Volume2 } from 'lucide-react';
import { Button } from '../ui/button';
import type { ParamFieldDescriptor, IRSequence } from '@acc/ir';
import { ProceduralAudioSynthesizer } from '@acc/ir';
import { EasingCurveSelector } from '../EasingCurveSelector';
import { IRStateManager } from '../../lib/ir/irState';
import { useIRSelector, usePlayheadFrame } from '../../lib/ir/useStudioStore';
import {
  NumberControlStrategy,
  SwitchControlStrategy,
  SelectControlStrategy,
  ColorControlStrategy,
  StringControlStrategy,
  CurveControlStrategy,
} from './strategies/PrimitiveControlStrategies';
import { RegionsArrayControlStrategy } from './strategies/RegionsArrayControlStrategy';
import {
  MotionLifecycleControlStrategy,
  ShaderGroupControlStrategy,
  KaraokeGroupControlStrategy,
  VisionStrategyControlStrategy,
  LightVectorControlStrategy,
} from './strategies/CompositeGroupControlStrategies';

export interface ControlStrategyProps {
  descriptor: ParamFieldDescriptor;
  value: any;
  onChange: (newValue: any) => void;
  disabled?: boolean;
}

export {
  NumberControlStrategy,
  SwitchControlStrategy,
  SelectControlStrategy,
  ColorControlStrategy,
  StringControlStrategy,
  CurveControlStrategy,
  RegionsArrayControlStrategy,
  MotionLifecycleControlStrategy,
  ShaderGroupControlStrategy,
  KaraokeGroupControlStrategy,
  VisionStrategyControlStrategy,
  LightVectorControlStrategy,
  EasingCurveSelector,
  useIRSelector,
  usePlayheadFrame,
};

/**
 * Strategy 7b: CurveControlStrategyWithEasing
 * Inline wrapper ensuring <EasingCurveSelector is available directly in ModifierControlStrategies.
 */
export const InlineEasingCurvePreview: React.FC<{ value?: string; onChange: (ease: string) => void }> = ({
  value = 'power2.out',
  onChange,
}) => <EasingCurveSelector value={value} onChange={onChange} />;

/**
 * Strategy 11: SFXActionsControlStrategy
 * Renders Audition SFX and Add to Timeline action buttons with live Web Audio synthesis.
 */
export const SFXActionsControlStrategy: React.FC<ControlStrategyProps> = ({
  value,
  disabled = false,
}) => {
  const [isPlayingAudition, setIsPlayingAudition] = React.useState(false);

  const handleAuditionSFX = (synthType: string = 'whoosh', durationSec: number = 1.5) => {
    if (disabled) return;
    setIsPlayingAudition(true);
    let buf: Float32Array;
    switch (synthType) {
      case 'whoosh':
        buf = ProceduralAudioSynthesizer.synthWhoosh(0, durationSec);
        break;
      case 'impact':
        buf = ProceduralAudioSynthesizer.synthImpact(0, durationSec);
        break;
      case 'glitch':
        buf = ProceduralAudioSynthesizer.synthGlitch(0, durationSec);
        break;
      case 'riser':
        buf = ProceduralAudioSynthesizer.synthRiser(0, durationSec);
        break;
      case 'laser':
      default:
        buf = ProceduralAudioSynthesizer.synthLaserSFX(0, durationSec);
        break;
    }

    try {
      const win = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioCtx = window.AudioContext || win.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const audioBuf = ctx.createBuffer(1, buf.length, 44100);
        audioBuf.copyToChannel(buf as unknown as Float32Array<ArrayBuffer>, 0);
        const source = ctx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (e) {
      console.warn('Audio audition error:', e);
    }

    setTimeout(() => setIsPlayingAudition(false), Math.min(2000, durationSec * 1000));
  };

  const handleInsertProceduralSFX = (
    synthType: string = 'whoosh',
    durationSec: number = 1.5,
    duckingFactor: number = 0.75
  ) => {
    if (disabled) return;
    const startFrame = 0;
    const durationFrames = Math.round(durationSec * 30);
    const seq: IRSequence = {
      id: `seq-sfx-${synthType}-${Date.now()}`,
      name: `${synthType.toUpperCase()} SFX`,
      type: 'audio',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'sfx/procedural',
          target: 'audio',
          params: {
            synthType,
            durationSec,
            duckingFactor,
            label: synthType.toUpperCase(),
          },
        },
      ],
    };
    IRStateManager.getInstance().addSequence('track-audio', seq, {
      trackTypeFallback: 'audio',
      trackNameFallback: 'Master Audio Track',
    });
  };

  const currentType = value?.synthType || value?.sfxType || 'whoosh';
  const durationSec = value?.durationSec ?? 1.5;
  const ducking = value?.duckingFactor ?? 0.75;

  return (
    <div
      className={`pt-2 border-t border-glass-border flex items-center gap-2 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAuditionSFX(currentType, durationSec)}
        disabled={disabled || isPlayingAudition}
        className="flex-1 text-[11px] font-mono gap-1.5 cursor-pointer border-glass-border hover:border-accent-theme hover:text-accent-theme disabled:cursor-not-allowed"
      >
        <Volume2
          className={`w-3.5 h-3.5 ${
            isPlayingAudition ? 'text-accent-theme animate-pulse' : ''
          }`}
        />
        {isPlayingAudition ? 'Playing...' : 'Audition SFX'}
      </Button>

      <Button
        size="sm"
        variant="accent"
        disabled={disabled}
        onClick={() => handleInsertProceduralSFX(currentType, durationSec, ducking)}
        className="flex-1 text-[11px] font-mono gap-1.5 cursor-pointer disabled:cursor-not-allowed"
      >
        <Plus className="w-3.5 h-3.5" />
        Insert to Track
      </Button>
    </div>
  );
};

/**
 * Control Strategy Factory:
 * Resolves the appropriate UI control strategy component for any ParamFieldDescriptor.
 */
export function resolveParamControlStrategy(
  descriptor: ParamFieldDescriptor
): React.FC<ControlStrategyProps> {
  switch (descriptor.type) {
    case 'number':
      return NumberControlStrategy;
    case 'boolean':
      return SwitchControlStrategy;
    case 'select':
      return SelectControlStrategy;
    case 'color':
      return ColorControlStrategy;
    case 'curve':
      return CurveControlStrategy;
    case 'motion_lifecycle':
      return MotionLifecycleControlStrategy;
    case 'shader_group':
      return ShaderGroupControlStrategy;
    case 'karaoke_group':
      return KaraokeGroupControlStrategy;
    case 'sfx_actions':
      return SFXActionsControlStrategy;
    case 'regions_array':
      return RegionsArrayControlStrategy;
    case 'vision_depth_strategy':
    case 'vision_segmentation_strategy':
      return VisionStrategyControlStrategy;
    case 'light_vector':
      return LightVectorControlStrategy;
    case 'string':
    default:
      return StringControlStrategy;
  }
}
