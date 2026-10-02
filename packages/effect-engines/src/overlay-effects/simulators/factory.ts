import { IVFXSimulatorStrategy } from './base';
import { RainSimulatorStrategy } from './strategies/rain-strategy';
import { SnowSimulatorStrategy } from './strategies/snow-strategy';
import { DustSimulatorStrategy } from './strategies/dust-strategy';
import { LeavesSimulatorStrategy } from './strategies/leaves-strategy';
import { FogSimulatorStrategy } from './strategies/fog-strategy';
import { FilmDamageSimulatorStrategy } from './strategies/film-damage-strategy';
import { EmbersSimulatorStrategy } from './strategies/embers-strategy';
import { FireSimulatorStrategy } from './strategies/fire-strategy';
import { BubblesSimulatorStrategy } from './strategies/bubbles-strategy';
import { ConfettiSimulatorStrategy } from './strategies/confetti-strategy';
import { FloatingHeartsSimulatorStrategy } from './strategies/floating-hearts-strategy';
import { LightningSimulatorStrategy } from './strategies/lightning-strategy';
import { RainOnGlassSimulatorStrategy } from './strategies/rain-on-glass-strategy';
import { DigitalGlitchSimulatorStrategy } from './strategies/digital-glitch-strategy';
import { CameraUISimulatorStrategy } from './strategies/camera-ui-strategy';
import { VHSSimulatorStrategy } from './strategies/vhs-strategy';
import { MatrixRainSimulatorStrategy } from './strategies/matrix-rain-strategy';
import { SpeedLinesSimulatorStrategy } from './strategies/speed-lines-strategy';
import { SciFiHUDSimulatorStrategy } from './strategies/sci-fi-hud-strategy';
import { GodRaysSimulatorStrategy } from './strategies/god-rays-strategy';
import { GrungeTextureSimulatorStrategy } from './strategies/grunge-texture-strategy';
import { LensFlareSimulatorStrategy } from './strategies/lens-flare-strategy';
import { LightLeakSimulatorStrategy } from './strategies/light-leak-strategy';
import { AudioSpectrumSimulatorStrategy } from './strategies/audio-spectrum-strategy';
import { BokehSimulatorStrategy } from './strategies/bokeh-strategy';
import { StarfieldSimulatorStrategy } from './strategies/starfield-strategy';
import { GenericVFXSimulatorStrategy } from './strategies/generic-vfx-strategy';
import { SeamlessLoopDecorator } from '../decorators/seamless-loop';

export class VFXSimulatorFactory {
  static createSimulator(effectName: string, variantName: string): IVFXSimulatorStrategy {
    let baseStrategy: IVFXSimulatorStrategy;

    switch (effectName.toLowerCase()) {
      case 'rain':
        baseStrategy = new RainSimulatorStrategy();
        break;
      case 'snow':
        baseStrategy = new SnowSimulatorStrategy();
        break;
      case 'dust':
        baseStrategy = new DustSimulatorStrategy();
        break;
      case 'leaves':
        baseStrategy = new LeavesSimulatorStrategy();
        break;
      case 'fog':
      case 'smoke':
        baseStrategy = new FogSimulatorStrategy();
        break;
      case 'film_damage':
        baseStrategy = new FilmDamageSimulatorStrategy();
        break;
      case 'embers':
        baseStrategy = new EmbersSimulatorStrategy();
        break;
      case 'fire':
        baseStrategy = new FireSimulatorStrategy();
        break;
      case 'bubbles':
        baseStrategy = new BubblesSimulatorStrategy();
        break;
      case 'confetti':
        baseStrategy = new ConfettiSimulatorStrategy();
        break;
      case 'floating_hearts':
        baseStrategy = new FloatingHeartsSimulatorStrategy();
        break;
      case 'lightning':
        baseStrategy = new LightningSimulatorStrategy();
        break;
      case 'rain_on_glass':
        baseStrategy = new RainOnGlassSimulatorStrategy();
        break;
      case 'digital_glitch':
        baseStrategy = new DigitalGlitchSimulatorStrategy();
        break;
      case 'camera_ui':
        baseStrategy = new CameraUISimulatorStrategy();
        break;
      case 'vhs':
        baseStrategy = new VHSSimulatorStrategy();
        break;
      case 'matrix_rain':
        baseStrategy = new MatrixRainSimulatorStrategy();
        break;
      case 'speed_lines':
        baseStrategy = new SpeedLinesSimulatorStrategy();
        break;
      case 'sci_fi_hud':
        baseStrategy = new SciFiHUDSimulatorStrategy();
        break;
      case 'god_rays':
        baseStrategy = new GodRaysSimulatorStrategy();
        break;
      case 'grunge_texture':
        baseStrategy = new GrungeTextureSimulatorStrategy();
        break;
      case 'lens_flare':
        baseStrategy = new LensFlareSimulatorStrategy();
        break;
      case 'light_leak':
        baseStrategy = new LightLeakSimulatorStrategy();
        break;
      case 'audio_spectrum':
        baseStrategy = new AudioSpectrumSimulatorStrategy();
        break;
      case 'bokeh':
        baseStrategy = new BokehSimulatorStrategy();
        break;
      case 'starfield':
        baseStrategy = new StarfieldSimulatorStrategy();
        break;
      default:
        baseStrategy = new GenericVFXSimulatorStrategy(effectName);
        break;
    }

    return new SeamlessLoopDecorator(baseStrategy);
  }
}
