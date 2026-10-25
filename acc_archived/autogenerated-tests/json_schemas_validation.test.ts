import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('JSON Schema Validation Suite', () => {
  const schemaDir = path.resolve(__dirname, '../schema');

  it('should parse story-config.schema.json without syntax errors', () => {
    const raw = fs.readFileSync(path.join(schemaDir, 'story-config.schema.json'), 'utf-8');
    const schema = JSON.parse(raw);
    expect(schema.$schema).toBeDefined();
    expect(schema.title).toBeDefined();
    expect(schema.properties.settings).toBeDefined();
    expect(schema.properties.scenes).toBeDefined();
  });

  it('should parse video-ir.schema.json without syntax errors', () => {
    const raw = fs.readFileSync(path.join(schemaDir, 'video-ir.schema.json'), 'utf-8');
    const schema = JSON.parse(raw);
    expect(schema.$schema).toBeDefined();
    expect(schema.title).toBe('Universal Video IR Document Schema');
    expect(schema.required).toContain('version');
    expect(schema.required).toContain('meta');
    expect(schema.required).toContain('tracks');
    expect(schema.definitions.IRTrack).toBeDefined();
    expect(schema.definitions.IRSequence).toBeDefined();
    expect(schema.definitions.ModifierNode).toBeDefined();
  });

  it('should parse pipeline-ir.schema.json without syntax errors', () => {
    const raw = fs.readFileSync(path.join(schemaDir, 'pipeline-ir.schema.json'), 'utf-8');
    const schema = JSON.parse(raw);
    expect(schema.$schema).toBeDefined();
    expect(schema.title).toBe('Universal Pipeline Intermediate Representation (PipelineIR) Schema');
    expect(schema.required).toContain('schemaVersion');
    expect(schema.required).toContain('pipelineId');
    expect(schema.required).toContain('chunks');
    expect(schema.definitions.ContentChunk).toBeDefined();
    expect(schema.definitions.AudioComposition).toBeDefined();
  });

  it('should parse omnichannel-config.schema.json without syntax errors', () => {
    const raw = fs.readFileSync(path.join(schemaDir, 'omnichannel-config.schema.json'), 'utf-8');
    const schema = JSON.parse(raw);
    expect(schema.$schema).toBeDefined();
    expect(schema.title).toBe('Omnichannel Director Configuration Schema');
    expect(schema.required).toContain('title');
    expect(schema.required).toContain('pipelineId');
    expect(schema.required).toContain('canonicalPipeline');
    expect(schema.required).toContain('suggestedModalities');
    expect(schema.definitions.FineGrainedVideoDirectorConfig).toBeDefined();
  });

  it('should validate sample-story and sample projects against schemas structure', () => {
    const sampleStoryRaw = fs.readFileSync(path.resolve(__dirname, '../sample-story/story-config.json'), 'utf-8');
    const sampleStory = JSON.parse(sampleStoryRaw);
    expect(sampleStory.name).toBeDefined();
    expect(sampleStory.settings).toBeDefined();
    expect(Array.isArray(sampleStory.scenes)).toBe(true);

    const samplesDir = path.resolve(__dirname, '../samples');
    if (fs.existsSync(samplesDir)) {
      const dirs = fs.readdirSync(samplesDir).filter((d) => fs.statSync(path.join(samplesDir, d)).isDirectory());
      for (const dir of dirs) {
        const pipelineIRPath = path.join(samplesDir, dir, 'pipeline-ir.json');
        const omnichannelPath = path.join(samplesDir, dir, 'omnichannel-config.json');
        if (fs.existsSync(pipelineIRPath)) {
          const pIr = JSON.parse(fs.readFileSync(pipelineIRPath, 'utf-8'));
          expect(['3.0.0', '3.1.0']).toContain(pIr.schemaVersion);
          expect(pIr.pipelineId).toBeDefined();
          expect(Array.isArray(pIr.chunks)).toBe(true);
        }
        if (fs.existsSync(omnichannelPath)) {
          const omni = JSON.parse(fs.readFileSync(omnichannelPath, 'utf-8'));
          expect(omni.title).toBeDefined();
          expect(omni.pipelineId).toBeDefined();
          expect(omni.canonicalPipeline).toBeDefined();
          expect(Array.isArray(omni.suggestedModalities)).toBe(true);
        }
      }
    }
  });
});
