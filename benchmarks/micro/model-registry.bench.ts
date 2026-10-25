import { run, bench, group } from 'mitata';
import { ModelHandleRegistry } from '../../packages/core/src/AssetContext';

group('Flyweight ModelHandleRegistry Operations', () => {
  const registry = ModelHandleRegistry.getInstance();

  // Populate initial handles
  for (let i = 0; i < 50; i++) {
    registry.registerHandle(`model_handle_${i}`, {
      id: `model_handle_${i}`,
      weights: new Float32Array(1000),
      dispose: () => {},
    }, 128 + (i % 512));
  }

  bench('ModelHandleRegistry.getHandle Hit Lookup', () => {
    const handle = registry.getHandle('model_handle_25');
  });

  bench('ModelHandleRegistry.getTotalMemoryUsageMB Computation', () => {
    const totalMB = registry.getTotalMemoryUsageMB();
  });

  bench('ModelHandleRegistry Register/Evict LRU Cycle', async () => {
    const id = `dynamic_model_${Math.random()}`;
    registry.registerHandle(id, { dispose: () => {} }, 256);
    await registry.evictLowestPriorityHandle();
  });
});

if (import.meta.main) {
  run();
}
