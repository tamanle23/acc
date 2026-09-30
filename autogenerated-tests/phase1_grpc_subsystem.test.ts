import { describe, it, expect, beforeAll } from 'bun:test';
import { loadProtoDefinition, getTTSServiceClient, getVisionServiceClient, getLLMServiceClient } from '@acc/proto';
import { IPCFacade, GRPCAIStrategy, FallbackAIStrategy } from '@acc/core';

describe('Phase 1: Protobuf Contracts & gRPC AI Subsystem Deep Test Suite', () => {
  const endpoint = '127.0.0.1:50051';
  let facade: IPCFacade;

  beforeAll(async () => {
    facade = new IPCFacade(new GRPCAIStrategy(endpoint));
    // Ensure daemon is active before running RPC method tests
    await facade.ping('init');
  });

  // ==========================================
  // 1. @acc/proto Dynamic Loader & Reflection
  // ==========================================
  describe('Protocol Buffers Loader & Client Generation', () => {
    it('successfully loads and parses common.proto', () => {
      const def = loadProtoDefinition('common.proto') as any;
      expect(def.acc).toBeDefined();
      expect(def.acc.v1).toBeDefined();
      expect(def.acc.v1.PingRequest).toBeDefined();
      expect(def.acc.v1.PingResponse).toBeDefined();
    });

    it('instantiates typed clients with all declared RPC methods', () => {
      const ttsClient = getTTSServiceClient(endpoint);
      expect(typeof ttsClient.Ping).toBe('function');
      expect(typeof ttsClient.Synthesize).toBe('function');
      expect(typeof ttsClient.SynthesizeStream).toBe('function');

      const visionClient = getVisionServiceClient(endpoint);
      expect(typeof visionClient.Ping).toBe('function');
      expect(typeof visionClient.EstimateDepth).toBe('function');
      expect(typeof visionClient.SegmentSubject).toBe('function');

      const llmClient = getLLMServiceClient(endpoint);
      expect(typeof llmClient.Ping).toBe('function');
      expect(typeof llmClient.GenerateStructuredJson).toBe('function');
    });
  });

  // ==========================================
  // 2. Direct gRPC Service RPC Execution
  // ==========================================
  describe('Python Backend gRPC Service Invocations', () => {
    it('executes TTSService.Synthesize and returns structured response', async () => {
      const ttsClient = getTTSServiceClient(endpoint);
      const res = await new Promise<any>((resolve, reject) => {
        ttsClient.Synthesize(
          { text: 'Hello from Bun unit test', voice_id: 'af_heart', speed: 1.0, model_strategy: 'kokoro' },
          (err: any, response: any) => {
            if (err) return reject(err);
            resolve(response);
          }
        );
      });

      expect(res).toBeDefined();
      expect(res.sample_rate).toBe(24000);
      expect(res.channels).toBe(1);
    });

    it('executes VisionService.EstimateDepth and returns depth metrics', async () => {
      const visionClient = getVisionServiceClient(endpoint);
      const mockImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header

      const res = await new Promise<any>((resolve, reject) => {
        visionClient.EstimateDepth({ image_data: mockImageBytes, model_size: 'small' }, (err: any, response: any) => {
          if (err) return reject(err);
          resolve(response);
        });
      });

      expect(res).toBeDefined();
      expect(res.min_depth).toBeDefined();
      expect(res.max_depth).toBeDefined();
    });

    it('executes VisionService.SegmentSubject and returns bounding box', async () => {
      const visionClient = getVisionServiceClient(endpoint);
      const mockImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      const res = await new Promise<any>((resolve, reject) => {
        visionClient.SegmentSubject({ image_data: mockImageBytes, mode: 'foreground' }, (err: any, response: any) => {
          if (err) return reject(err);
          resolve(response);
        });
      });

      expect(res).toBeDefined();
      expect(res.bounding_box).toBeDefined();
      expect(res.bounding_box.confidence).toBe(1.0);
    });

    it('executes LLMService.GenerateStructuredJson and returns valid JSON string', async () => {
      const llmClient = getLLMServiceClient(endpoint);
      const res = await new Promise<any>((resolve, reject) => {
        llmClient.GenerateStructuredJson(
          { prompt: 'Summarize news', json_schema: '{"type":"object"}', temperature: 0.2 },
          (err: any, response: any) => {
            if (err) return reject(err);
            resolve(response);
          }
        );
      });

      expect(res).toBeDefined();
      expect(res.json_output).toBe('{}');
    });
  });

  // ==========================================
  // 3. IPCFacade Resilience & Error Handling
  // ==========================================
  describe('IPCFacade Fault Isolation', () => {
    it('gracefully degrades to FallbackAIStrategy on connection error to non-existent endpoint', async () => {
      const deadFacade = new IPCFacade(new GRPCAIStrategy('127.0.0.1:59999')); // Non-existent port
      const pong = await deadFacade.ping('test_fallback');
      
      expect(pong).toContain('Fallback in-process pong: test_fallback');
      expect(deadFacade.getStrategyName()).toBe('fallback');
    });
  });
});
