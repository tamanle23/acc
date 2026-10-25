import { EffectGenerator } from './types';
import * as generators from './generators';

const registry = new Map<string, EffectGenerator>();

// Register all exported generators
Object.values(generators).forEach((generator) => {
  if (generator && generator.name && typeof generator.generate === 'function') {
    registry.set(generator.name.toLowerCase(), generator as EffectGenerator);
  }
});

export function getGenerator(name: string): EffectGenerator | undefined {
  return registry.get(name.toLowerCase());
}

export function listGenerators(): string[] {
  return Array.from(registry.keys());
}
