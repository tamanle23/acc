import { describe, it, expect, beforeEach } from 'bun:test';
import { UniversalOnnxRuntimeProvider } from '../packages/effect-engines/src/vision/UniversalOnnxRuntimeProvider';
import { loadUniversalTransformers } from '../packages/effect-engines/src/vision/utils';

describe('UniversalOnnxRuntimeProvider Clean Facade & Config Suite', () => {
  beforeEach(() => {
    UniversalOnnxRuntimeProvider.reset();
  });

  it('initializes with default webgpu device configuration', () => {
    const config = UniversalOnnxRuntimeProvider.getConfig();
    expect(config.device).toBe('webgpu');
    expect(config.allowLocalModels).toBe(true);
    expect(config.allowRemoteModels).toBe(true);
  });

  it('updates configuration dynamically via configure()', () => {
    UniversalOnnxRuntimeProvider.configure({
      device: 'wasm',
      dtype: 'q8',
      remoteHost: 'https://internal-mirror.hf.co',
      allowRemoteModels: false,
    });

    const config = UniversalOnnxRuntimeProvider.getConfig();
    expect(config.device).toBe('wasm');
    expect(config.dtype).toBe('q8');
    expect(config.remoteHost).toBe('https://internal-mirror.hf.co');
    expect(config.allowRemoteModels).toBe(false);
  });

  it('applies configuration options directly to env object', () => {
    const mockEnv: any = { backends: { onnx: {} } };
    UniversalOnnxRuntimeProvider.configure({
      cacheDir: '/tmp/test-hf-cache',
      remoteHost: 'https://hf-mirror.example.com',
      allowLocalModels: true,
      allowRemoteModels: false,
      device: 'wasm',
    });

    UniversalOnnxRuntimeProvider.applyConfigToEnv(mockEnv);
    expect(mockEnv.cacheDir).toBe('/tmp/test-hf-cache');
    expect(mockEnv.remoteHost).toBe('https://hf-mirror.example.com');
    expect(mockEnv.allowLocalModels).toBe(true);
    expect(mockEnv.allowRemoteModels).toBe(false);
    expect(mockEnv.backends.onnx.wasm).toBeDefined();
  });

  it('loads transformers module and reports status cleanly', async () => {
    const status = await UniversalOnnxRuntimeProvider.getStatus();
    expect(status.device).toBe('webgpu');
    expect(status.backend).toBe('transformers');
    expect(status.available).toBe(true);
    expect(status.transformersModule).toBeDefined();
  });

  it('loadUniversalTransformers accepts options override', async () => {
    const tf = await loadUniversalTransformers({ device: 'cpu' });
    expect(tf).toBeDefined();
    expect(UniversalOnnxRuntimeProvider.getConfig().device).toBe('cpu');
  });
});
