import { IVFXSimulatorStrategy } from './base';
import { RainSimulatorStrategy } from './strategies/rain-strategy';
import { SnowSimulatorStrategy } from './strategies/snow-strategy';
import { DustSimulatorStrategy } from './strategies/dust-strategy';
import { LeavesSimulatorStrategy } from './strategies/leaves-strategy';
import { FogSimulatorStrategy } from './strategies/fog-strategy';
import { FilmDamageSimulatorStrategy } from './strategies/film-damage-strategy';
import { EmbersSimulatorStrategy } from './strategies/embers-strategy';
import { FireSimulatorStrategy } from './strategies/fire-strategy';
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
      default:
        baseStrategy = new GenericVFXSimulatorStrategy(effectName);
        break;
    }

    return new SeamlessLoopDecorator(baseStrategy);
  }
}
