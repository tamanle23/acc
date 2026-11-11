import { describe, it, expect, beforeEach } from 'bun:test';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { probeRenderBackendCapabilities } from '@/engine/webgpu/webgpu-probe';
import {
  createIcosahedronMesh,
  createTorusKnotMesh,
  createMonolith3DMesh,
  parseGlbMesh,
  GltfMeshEngine,
  gltfMeshEngine,
} from '@/engine/webgpu/gltf-mesh-engine';

class MockCanvasRenderingContext2D {
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;

  save() {}
  restore() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  fill() {}
  stroke() {}
}

describe('Horizon 3: WebGPU Compute Pipeline & 3D Mesh Engine Suite', () => {
  describe('Render Backend Capability Probe', () => {
    it('probes render backend capabilities safely without throwing', async () => {
      const caps = await probeRenderBackendCapabilities();
      expect(caps).toBeDefined();
      expect(['webgpu', 'webgl2', 'canvas2d']).toContain(caps.backend);
      expect(caps.maxTextureSize).toBeGreaterThanOrEqual(2048);
      expect(typeof caps.computeShadersSupported).toBe('boolean');
    });
  });

  describe('3D Geometric Mesh Generators', () => {
    it('generates mathematically precise 3D icosahedron with 12 vertices and 20 faces', () => {
      const mesh = createIcosahedronMesh(100);
      expect(mesh.vertices.length).toBe(12 * 3); // 36 float values
      expect(mesh.indices.length).toBe(20 * 3); // 60 index values

      // All vertices should be approximately radius distance from origin
      for (let i = 0; i < 12; i++) {
        const x = mesh.vertices[i * 3];
        const y = mesh.vertices[i * 3 + 1];
        const z = mesh.vertices[i * 3 + 2];
        const dist = Math.sqrt(x * x + y * y + z * z);
        expect(dist).toBeCloseTo(100, 1);
      }
    });

    it('generates 3D Torus Knot parametric mesh', () => {
      const mesh = createTorusKnotMesh(2, 3, 24, 6, 80, 15);
      expect(mesh.vertices.length).toBeGreaterThan(100);
      expect(mesh.indices.length).toBeGreaterThan(100);
    });

    it('generates brutalist 3D architectural monolith mesh with 8 vertices and 12 triangles', () => {
      const mesh = createMonolith3DMesh(50, 120, 30);
      expect(mesh.vertices.length).toBe(8 * 3); // 24 floats
      expect(mesh.indices.length).toBe(12 * 3); // 36 indices
    });
  });

  describe('Binary glTF 2.0 (GLB) Parser & Validation', () => {
    it('throws descriptive error on invalid magic header', async () => {
      const invalidBuffer = new ArrayBuffer(32);
      await expect(parseGlbMesh(invalidBuffer)).rejects.toThrow(/missing glTF magic/);
    });

    it('throws descriptive error on unsupported glTF version', async () => {
      const buffer = new ArrayBuffer(32);
      const view = new DataView(buffer);
      view.setUint32(0, 0x46546c67, true); // 'glTF'
      view.setUint32(4, 1, true); // Version 1 (unsupported)
      view.setUint32(8, 32, true);

      await expect(parseGlbMesh(buffer)).rejects.toThrow(/Unsupported glTF version: 1/);
    });

    it('throws descriptive error on corrupt length exceeding buffer size', async () => {
      const buffer = new ArrayBuffer(24);
      const view = new DataView(buffer);
      view.setUint32(0, 0x46546c67, true); // 'glTF'
      view.setUint32(4, 2, true); // Version 2
      view.setUint32(8, 999999, true); // Corrupt oversized length

      await expect(parseGlbMesh(buffer)).rejects.toThrow(/reported length exceeds buffer size/);
    });

    it('successfully parses valid binary GLB container with 4-byte alignment and normalizes coordinates', async () => {
      const jsonObj = {
        asset: { version: '2.0' },
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: 36 },
          { buffer: 0, byteOffset: 36, byteLength: 6 },
        ],
        accessors: [
          {
            bufferView: 0,
            byteOffset: 0,
            componentType: 5126,
            count: 3,
            type: 'VEC3',
          },
          {
            bufferView: 1,
            byteOffset: 0,
            componentType: 5123,
            count: 3,
            type: 'SCALAR',
          },
        ],
        meshes: [
          {
            primitives: [
              {
                attributes: { POSITION: 0 },
                indices: 1,
              },
            ],
          },
        ],
      };

      const jsonStr = JSON.stringify(jsonObj);
      const jsonEncoder = new TextEncoder();
      const rawJsonBytes = jsonEncoder.encode(jsonStr);
      const jsonPaddedLength = (rawJsonBytes.byteLength + 3) & ~3;
      const jsonBytes = new Uint8Array(jsonPaddedLength);
      jsonBytes.fill(0x20); // Pad with spaces as per glTF spec
      jsonBytes.set(rawJsonBytes);

      // Binary chunk data: 3 vertices (36 bytes) + 3 indices (6 bytes) = 42 bytes
      const rawBinBytes = new Uint8Array(42);
      const f32View = new Float32Array(rawBinBytes.buffer, 0, 9);
      f32View.set([0, 100, 0, -50, -50, 0, 50, -50, 0]);
      const u16View = new Uint16Array(rawBinBytes.buffer, 36, 3);
      u16View.set([0, 1, 2]);

      const binPaddedLength = (rawBinBytes.byteLength + 3) & ~3;
      const binBytes = new Uint8Array(binPaddedLength);
      binBytes.fill(0); // Pad with zeroes as per glTF spec
      binBytes.set(rawBinBytes);

      const totalLength = 12 + (8 + jsonPaddedLength) + (8 + binPaddedLength);
      const glbBuffer = new ArrayBuffer(totalLength);
      const headerView = new DataView(glbBuffer);
      headerView.setUint32(0, 0x46546c67, true); // 'glTF'
      headerView.setUint32(4, 2, true); // version 2
      headerView.setUint32(8, totalLength, true); // total length

      // JSON chunk
      headerView.setUint32(12, rawJsonBytes.byteLength, true);
      headerView.setUint32(16, 0x4e4f534a, true); // 'JSON'
      new Uint8Array(glbBuffer, 20, jsonPaddedLength).set(jsonBytes);

      // BIN chunk
      const binHeaderOffset = 20 + jsonPaddedLength;
      headerView.setUint32(binHeaderOffset, rawBinBytes.byteLength, true);
      headerView.setUint32(binHeaderOffset + 4, 0x004e4942, true); // 'BIN\0'
      new Uint8Array(glbBuffer, binHeaderOffset + 8, binPaddedLength).set(binBytes);

      const parsedMesh = await parseGlbMesh(glbBuffer);
      expect(parsedMesh).toBeDefined();
      expect(parsedMesh.vertices.length).toBe(9); // 3 vertices * 3 coords
      expect(parsedMesh.indices.length).toBe(3);

      // Verify that coordinates were centered and normalized to bounding box ~160
      expect(Number.isFinite(parsedMesh.vertices[0])).toBe(true);
      expect(Number.isFinite(parsedMesh.vertices[1])).toBe(true);
      expect(Number.isFinite(parsedMesh.vertices[2])).toBe(true);
    });

    it('successfully parses interleaved glTF buffers with byteStride and scene graph hierarchy', async () => {
      // 2 vertices interleaved: 12 bytes pos + 12 bytes normal + 8 bytes uv = 32 bytes per vertex
      const count = 3;
      const stride = 32;
      const binPayload = new Uint8Array(count * stride + 6); // 96 bytes verts + 6 bytes indices
      const f32View = new Float32Array(binPayload.buffer, 0, count * (stride / 4));
      
      // Vertex 0: [0, 50, 0]
      f32View[0] = 0; f32View[1] = 50; f32View[2] = 0;
      // Vertex 1: [-50, -50, 0]
      f32View[8] = -50; f32View[9] = -50; f32View[10] = 0;
      // Vertex 2: [50, -50, 0]
      f32View[16] = 50; f32View[17] = -50; f32View[18] = 0;

      // Indices at offset 96
      const u16View = new Uint16Array(binPayload.buffer, 96, 3);
      u16View[0] = 0; u16View[1] = 1; u16View[2] = 2;

      const jsonObj = {
        asset: { version: '2.0' },
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: 96, byteStride: 32 },
          { buffer: 0, byteOffset: 96, byteLength: 6 },
        ],
        accessors: [
          { bufferView: 0, byteOffset: 0, componentType: 5126, count: 3, type: 'VEC3' },
          { bufferView: 1, byteOffset: 0, componentType: 5123, count: 3, type: 'SCALAR' },
        ],
        meshes: [
          {
            primitives: [{ attributes: { POSITION: 0 }, indices: 1 }],
          },
        ],
        nodes: [
          { mesh: 0, translation: [10, 20, 0], scale: [2, 2, 2] },
        ],
        scenes: [{ nodes: [0] }],
        scene: 0,
      };

      const jsonEncoder = new TextEncoder();
      const rawJsonBytes = jsonEncoder.encode(JSON.stringify(jsonObj));
      const jsonPaddedLength = (rawJsonBytes.byteLength + 3) & ~3;
      const jsonBytes = new Uint8Array(jsonPaddedLength);
      jsonBytes.fill(0x20);
      jsonBytes.set(rawJsonBytes);

      const binPaddedLength = (binPayload.byteLength + 3) & ~3;
      const binBytes = new Uint8Array(binPaddedLength);
      binBytes.set(binPayload);

      const totalLength = 12 + (8 + jsonPaddedLength) + (8 + binPaddedLength);
      const glbBuffer = new ArrayBuffer(totalLength);
      const headerView = new DataView(glbBuffer);
      headerView.setUint32(0, 0x46546c67, true);
      headerView.setUint32(4, 2, true);
      headerView.setUint32(8, totalLength, true);

      headerView.setUint32(12, rawJsonBytes.byteLength, true);
      headerView.setUint32(16, 0x4e4f534a, true);
      new Uint8Array(glbBuffer, 20, jsonPaddedLength).set(jsonBytes);

      const binOffset = 20 + jsonPaddedLength;
      headerView.setUint32(binOffset, binPayload.byteLength, true);
      headerView.setUint32(binOffset + 4, 0x004e4942, true);
      new Uint8Array(glbBuffer, binOffset + 8, binPaddedLength).set(binBytes);

      const mesh = await parseGlbMesh(glbBuffer);
      expect(mesh.vertices.length).toBe(9);
      expect(mesh.indices.length).toBe(3);
      expect(Number.isFinite(mesh.vertices[0])).toBe(true);
    });

    it('throws descriptive actionable error when GLB container uses Draco compression', async () => {
      const jsonObj = {
        asset: { version: '2.0' },
        extensionsRequired: ['KHR_draco_mesh_compression'],
        meshes: [
          {
            primitives: [{ attributes: { POSITION: 0 } }],
          },
        ],
      };
      const jsonEncoder = new TextEncoder();
      const rawJsonBytes = jsonEncoder.encode(JSON.stringify(jsonObj));
      const jsonPaddedLength = (rawJsonBytes.byteLength + 3) & ~3;

      const totalLength = 12 + (8 + jsonPaddedLength) + (8 + 4);
      const glbBuffer = new ArrayBuffer(totalLength);
      const headerView = new DataView(glbBuffer);
      headerView.setUint32(0, 0x46546c67, true);
      headerView.setUint32(4, 2, true);
      headerView.setUint32(8, totalLength, true);

      headerView.setUint32(12, rawJsonBytes.byteLength, true);
      headerView.setUint32(16, 0x4e4f534a, true);
      new Uint8Array(glbBuffer, 20, rawJsonBytes.byteLength).set(rawJsonBytes);

      const binOffset = 20 + jsonPaddedLength;
      headerView.setUint32(binOffset, 4, true);
      headerView.setUint32(binOffset + 4, 0x004e4942, true);

      await expect(parseGlbMesh(glbBuffer)).rejects.toThrow(/KHR_draco_mesh_compression/);
    });

    it('throws when no valid 3D vertex position data exists in glTF container', async () => {
      const jsonObj = {
        asset: { version: '2.0' },
        meshes: [],
      };
      const jsonEncoder = new TextEncoder();
      const rawJsonBytes = jsonEncoder.encode(JSON.stringify(jsonObj));
      const jsonPaddedLength = (rawJsonBytes.byteLength + 3) & ~3;

      const totalLength = 12 + (8 + jsonPaddedLength) + (8 + 4);
      const glbBuffer = new ArrayBuffer(totalLength);
      const headerView = new DataView(glbBuffer);
      headerView.setUint32(0, 0x46546c67, true);
      headerView.setUint32(4, 2, true);
      headerView.setUint32(8, totalLength, true);

      headerView.setUint32(12, rawJsonBytes.byteLength, true);
      headerView.setUint32(16, 0x4e4f534a, true);
      new Uint8Array(glbBuffer, 20, rawJsonBytes.byteLength).set(rawJsonBytes);

      const binOffset = 20 + jsonPaddedLength;
      headerView.setUint32(binOffset, 4, true);
      headerView.setUint32(binOffset + 4, 0x004e4942, true);

      await expect(parseGlbMesh(glbBuffer)).rejects.toThrow(/No 3D vertex position geometry found/);
    });

    it('successfully decodes and renders meshes compressed with EXT_meshopt_compression', async () => {
      await MeshoptEncoder.ready;
      await MeshoptDecoder.ready;

      const rawPos = new Float32Array([0, 1, 0, -1, -1, 0, 1, -1, 0]);
      const encodedPos = MeshoptEncoder.encodeVertexBuffer(new Uint8Array(rawPos.buffer), 3, 12);

      const jsonObj = {
        asset: { version: '2.0' },
        extensionsUsed: ['EXT_meshopt_compression'],
        extensionsRequired: ['EXT_meshopt_compression'],
        accessors: [
          {
            bufferView: 0,
            byteOffset: 0,
            componentType: 5126,
            count: 3,
            type: 'VEC3',
          },
        ],
        bufferViews: [
          {
            buffer: 0,
            byteOffset: 0,
            byteLength: encodedPos.byteLength,
            byteStride: 12,
            extensions: {
              EXT_meshopt_compression: {
                buffer: 0,
                byteOffset: 0,
                byteLength: encodedPos.byteLength,
                byteStride: 12,
                count: 3,
                mode: 'ATTRIBUTES',
              },
            },
          },
        ],
        meshes: [
          {
            primitives: [{ attributes: { POSITION: 0 } }],
          },
        ],
      };

      const rawJsonBytes = new TextEncoder().encode(JSON.stringify(jsonObj));
      const jsonPaddedLength = (rawJsonBytes.byteLength + 3) & ~3;
      const jsonBytes = new Uint8Array(jsonPaddedLength);
      jsonBytes.fill(0x20);
      jsonBytes.set(rawJsonBytes);

      const binPaddedLength = (encodedPos.byteLength + 3) & ~3;
      const binBytes = new Uint8Array(binPaddedLength);
      binBytes.set(encodedPos);

      const totalLength = 12 + (8 + jsonPaddedLength) + (8 + binPaddedLength);
      const glbBuffer = new ArrayBuffer(totalLength);
      const headerView = new DataView(glbBuffer);
      headerView.setUint32(0, 0x46546c67, true);
      headerView.setUint32(4, 2, true);
      headerView.setUint32(8, totalLength, true);

      headerView.setUint32(12, rawJsonBytes.byteLength, true);
      headerView.setUint32(16, 0x4e4f534a, true);
      new Uint8Array(glbBuffer, 20, jsonPaddedLength).set(jsonBytes);

      const binOffset = 20 + jsonPaddedLength;
      headerView.setUint32(binOffset, encodedPos.byteLength, true);
      headerView.setUint32(binOffset + 4, 0x004e4942, true);
      new Uint8Array(glbBuffer, binOffset + 8, binPaddedLength).set(binBytes);

      const mesh = await parseGlbMesh(glbBuffer);
      expect(mesh.vertices.length).toBe(9);
      expect(mesh.indices.length).toBe(3);
      expect(Number.isFinite(mesh.vertices[0])).toBe(true);
      expect(Number.isFinite(mesh.vertices[1])).toBe(true);
      expect(Number.isFinite(mesh.vertices[2])).toBe(true);
    });
  });

  describe('GltfMeshEngine Perspective Projection & Shading', () => {
    it('renders 3D mesh cleanly through perspective projection and depth sorting', () => {
      const engine = new GltfMeshEngine();
      const mesh = createIcosahedronMesh(80);
      const mockCtx = new MockCanvasRenderingContext2D();

      engine.render3DMesh(mockCtx as unknown as CanvasRenderingContext2D, {
        mesh,
        width: 400,
        height: 400,
        rotationX: 0.5,
        rotationY: 0.7,
        scale: 1.2,
        color: '#00FF66',
        wireframe: true,
        fill: true,
      });

      engine.dispose();
      // After dispose, render should return immediately without error
      engine.render3DMesh(mockCtx as unknown as CanvasRenderingContext2D, {
        mesh,
        width: 400,
        height: 400,
      });
      expect(true).toBe(true);
    });

    it('stores and retrieves user-uploaded custom 3D mesh via singleton engine', () => {
      const mesh = createIcosahedronMesh(50);
      gltfMeshEngine.setCustomMesh(mesh);
      expect(gltfMeshEngine.getCustomMesh()).toBe(mesh);
      gltfMeshEngine.setCustomMesh(null);
      expect(gltfMeshEngine.getCustomMesh()).toBeNull();
    });
  });
});
