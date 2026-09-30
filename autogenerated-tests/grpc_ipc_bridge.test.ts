import { describe, it, expect, afterAll } from 'bun:test';
import { IPCFacade, GRPCAIStrategy, FallbackAIStrategy } from '@acc/core';

describe('gRPC IPC Subsystem & Python AI Daemon Suite', () => {
  it('Auto-bootstraps Python AI daemon and successfully receives ping from all 3 services', async () => {
    const facade = new IPCFacade(new GRPCAIStrategy('127.0.0.1:50051'));
    
    const results = await facade.pingAllServices('acc_health_test');
    
    expect(results.tts).toContain('TTS pong: acc_health_test');
    expect(results.vision).toContain('Vision pong: acc_health_test');
    expect(results.llm).toContain('LLM pong: acc_health_test');
  }, 15000);

  it('Strategy Pattern allows seamless fallback to in-process strategy when needed', async () => {
    const facade = new IPCFacade();
    facade.setStrategy(new FallbackAIStrategy());
    
    expect(facade.getStrategyName()).toBe('fallback');
    const pong = await facade.ping('offline_mode');
    expect(pong).toBe('Fallback in-process pong: offline_mode');
  });
});
