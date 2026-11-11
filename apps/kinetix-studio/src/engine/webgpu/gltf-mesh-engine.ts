// ============================================================================
// KINETIX STUDIO v6.0 - 3D MESH & GLTF/GLB PARSER ENGINE (ECMA-429)
// Universal 3D mesh engine with binary GLB parser, geometric generators,
// and analytical 3D-to-2D perspective projection with depth-sorted shading.
// ============================================================================

import { SafeCanvas2D, type AnyCanvas2DContext } from '@/lib/safe-canvas-2d';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

export interface Mesh3D {
  readonly vertices: Float32Array; // Triples [x, y, z]
  readonly normals?: Float32Array;  // Triples [nx, ny, nz]
  readonly indices: Uint16Array | Uint32Array; // Triangles [i0, i1, i2]
}

export interface Render3DMeshOptions {
  readonly mesh: Mesh3D;
  readonly width: number;
  readonly height: number;
  readonly centerX?: number;
  readonly centerY?: number;
  readonly rotationX?: number; // radians
  readonly rotationY?: number; // radians
  readonly rotationZ?: number; // radians
  readonly scale?: number;
  readonly color?: string;
  readonly wireframe?: boolean;
  readonly fill?: boolean;
  readonly lightDirection?: [number, number, number];
}

/**
 * Creates a mathematically pure 3D icosahedron mesh (Golden Ratio phi).
 */
export function createIcosahedronMesh(radius = 100): Mesh3D {
  const phi = (1 + Math.sqrt(5)) / 2;
  const a = radius / Math.sqrt(1 + phi * phi);
  const b = a * phi;

  // 12 Vertices
  const rawVertices = [
    -a,  b,  0,
     a,  b,  0,
    -a, -b,  0,
     a, -b,  0,
     0, -a,  b,
     0,  a,  b,
     0, -a, -b,
     0,  a, -b,
     b,  0, -a,
     b,  0,  a,
    -b,  0, -a,
    -b,  0,  a,
  ];

  // 20 Triangular Faces
  const rawIndices = [
    0, 11, 5,   0, 5, 1,    0, 1, 7,    0, 7, 10,   0, 10, 11,
    1, 5, 9,    5, 11, 4,   11, 10, 2,  10, 7, 6,   7, 1, 8,
    3, 9, 4,    3, 4, 2,    3, 2, 6,    3, 6, 8,    3, 8, 9,
    4, 9, 5,    2, 4, 11,   6, 2, 10,   8, 6, 7,    9, 8, 1,
  ];

  return {
    vertices: new Float32Array(rawVertices),
    indices: new Uint16Array(rawIndices),
  };
}

/**
 * Creates a parametric 3D Torus Knot curve mesh (p=2, q=3).
 */
export function createTorusKnotMesh(
  p = 2,
  q = 3,
  tubularSegments = 48,
  radialSegments = 8,
  radius = 90,
  tubeRadius = 18
): Mesh3D {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const u = (i / tubularSegments) * Math.PI * 2 * p;
    const r = radius * (0.6 + 0.4 * Math.cos(q * (u / p)));
    const cx = r * Math.cos(u);
    const cy = r * Math.sin(u);
    const cz = radius * 0.4 * Math.sin(q * (u / p));

    // Tangent vector
    const du = 0.01;
    const uNext = u + du;
    const rNext = radius * (0.6 + 0.4 * Math.cos(q * (uNext / p)));
    const tx = rNext * Math.cos(uNext) - cx;
    const ty = rNext * Math.sin(uNext) - cy;
    const tz = radius * 0.4 * Math.sin(q * (uNext / p)) - cz;
    const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    const tNorm = [tx / tLen, ty / tLen, tz / tLen];

    // Normal & binormal
    const nx = -tNorm[1];
    const ny = tNorm[0];
    const nz = 0;
    const bx = tNorm[1] * nz - tNorm[2] * ny;
    const by = tNorm[2] * nx - tNorm[0] * nz;
    const bz = tNorm[0] * ny - tNorm[1] * nx;

    for (let j = 0; j < radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const cosV = Math.cos(v);
      const sinV = Math.sin(v);

      const vx = cx + tubeRadius * (nx * cosV + bx * sinV);
      const vy = cy + tubeRadius * (ny * cosV + by * sinV);
      const vz = cz + tubeRadius * (nz * cosV + bz * sinV);

      vertices.push(vx, vy, vz);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * radialSegments + j;
      const b = ((i + 1) % (tubularSegments + 1)) * radialSegments + j;
      const c = ((i + 1) % (tubularSegments + 1)) * radialSegments + ((j + 1) % radialSegments);
      const d = i * radialSegments + ((j + 1) % radialSegments);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}

/**
 * Creates a brutalist architectural 3D monolith mesh.
 */
export function createMonolith3DMesh(width = 60, height = 140, depth = 35): Mesh3D {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  // 8 cube vertices
  const rawVertices = [
    -hw, -hh, -hd,
     hw, -hh, -hd,
     hw,  hh, -hd,
    -hw,  hh, -hd,
    -hw, -hh,  hd,
     hw, -hh,  hd,
     hw,  hh,  hd,
    -hw,  hh,  hd,
  ];

  // 12 triangles (6 faces * 2)
  const rawIndices = [
    0, 1, 2,  0, 2, 3, // front
    1, 5, 6,  1, 6, 2, // right
    5, 4, 7,  5, 7, 6, // back
    4, 0, 3,  4, 3, 7, // left
    3, 2, 6,  3, 6, 7, // top
    4, 5, 1,  4, 1, 0, // bottom
  ];

  return {
    vertices: new Float32Array(rawVertices),
    indices: new Uint16Array(rawIndices),
  };
}

/**
 * Binary glTF 2.0 (GLB) parser.
 * Extracts vertex buffers and triangle indices from standard binary containers,
 * auto-centering and normalizing the model to standard studio stage dimensions.
 * Natively supports uncompressed glTF and Meshopt compression (EXT_meshopt_compression).
 */
export async function parseGlbMesh(arrayBuffer: ArrayBuffer): Promise<Mesh3D> {
  if (arrayBuffer.byteLength < 12) {
    throw new Error('Invalid binary GLB container: buffer too small (< 12 bytes).');
  }

  // Ensure WebAssembly MeshoptDecoder & MeshoptSimplifier are initialized
  await Promise.all([MeshoptDecoder.ready, MeshoptSimplifier.ready]);

  const view = new DataView(arrayBuffer);
  const magic = view.getUint32(0, true);

  // 0x46546C67 is ascii for 'glTF'
  if (magic !== 0x46546C67) {
    throw new Error('Invalid binary GLB container: missing glTF magic header.');
  }

  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Unsupported glTF version: ${version}, expected version 2.`);
  }

  const totalLength = view.getUint32(8, true);
  if (totalLength > arrayBuffer.byteLength) {
    throw new Error('Corrupt GLB file: reported length exceeds buffer size.');
  }

  // Iterate chunks conforming to 4-byte alignment rule
  let offset = 12;
  let jsonText = '';
  let binBuffer: ArrayBuffer | null = null;

  while (offset + 8 <= totalLength && offset + 8 <= arrayBuffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    const paddedLength = (chunkLength + 3) & ~3;

    if (dataOffset + chunkLength > arrayBuffer.byteLength) {
      break;
    }

    if (chunkType === 0x4E4F534A && !jsonText) {
      // Chunk 0: JSON Chunk (0x4E4F534A is 'JSON')
      const jsonBytes = new Uint8Array(arrayBuffer, dataOffset, chunkLength);
      jsonText = new TextDecoder('utf-8').decode(jsonBytes);
    } else if (
      (chunkType === 0x004E4942 ||
        chunkType === 0x204E4942 ||
        (chunkType & 0x00FFFFFF) === 0x004E4942) &&
      !binBuffer
    ) {
      // Chunk 1: Binary Buffer Chunk (0x004E4942 is 'BIN\0')
      // Slice from dataOffset to the end of the arrayBuffer to ensure no bufferView is truncated
      binBuffer = arrayBuffer.slice(dataOffset);
    }

    offset = dataOffset + paddedLength;
  }

  // Fallback: If binBuffer was not set by chunk header, but data exists after JSON chunk
  if (!binBuffer && offset < arrayBuffer.byteLength) {
    binBuffer = arrayBuffer.slice(offset);
  }

  if (!jsonText) {
    throw new Error('Invalid GLB structure: missing JSON metadata chunk.');
  }

  const gltf = JSON.parse(jsonText);

  // Check for unsupported compression extensions upfront with friendly actionable diagnostics
  const isDraco =
    Boolean(gltf.extensionsRequired?.includes('KHR_draco_mesh_compression')) ||
    Boolean(gltf.extensionsUsed?.includes('KHR_draco_mesh_compression')) ||
    Boolean(
      gltf.meshes?.some((m: any) =>
        m.primitives?.some((p: any) => p.extensions?.KHR_draco_mesh_compression)
      )
    );

  if (isDraco) {
    throw new Error(
      'GLB model uses Draco compression (KHR_draco_mesh_compression). In-browser Canvas2D requires uncompressed geometry. Please re-export from Blender with Draco compression unchecked, or download an uncompressed GLB.'
    );
  }

  // Populate buffers array (buffer 0 is binBuffer, followed by any data URI buffers)
  const buffers: ArrayBuffer[] = [];
  if (binBuffer) {
    buffers.push(binBuffer);
  }

  if (Array.isArray(gltf.buffers)) {
    for (let bIdx = 0; bIdx < gltf.buffers.length; bIdx++) {
      if (bIdx === 0 && binBuffer) continue;
      const b = gltf.buffers[bIdx];
      if (b?.uri && typeof b.uri === 'string' && b.uri.startsWith('data:')) {
        const base64Index = b.uri.indexOf('base64,');
        if (base64Index !== -1) {
          const base64 = b.uri.slice(base64Index + 7);
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          buffers[bIdx] = bytes.buffer;
        }
      }
    }
  }

  if (buffers.length === 0 || !buffers[0]) {
    throw new Error('Invalid GLB container: binary geometry buffer payload is missing.');
  }

  // Decoded BufferView cache for EXT_meshopt_compression / KHR_meshopt_compression
  const decodedBufferViews = new Map<number, { buffer: ArrayBuffer; stride: number }>();

  function getBufferViewData(bufferViewIdx: number): {
    buffer: ArrayBuffer;
    byteOffset: number;
    stride: number;
  } | null {
    if (decodedBufferViews.has(bufferViewIdx)) {
      const entry = decodedBufferViews.get(bufferViewIdx)!;
      return { buffer: entry.buffer, byteOffset: 0, stride: entry.stride };
    }

    const bufferView = gltf.bufferViews?.[bufferViewIdx];
    if (!bufferView) return null;

    const meshoptExt =
      bufferView.extensions?.EXT_meshopt_compression ||
      bufferView.extensions?.KHR_meshopt_compression;

    if (meshoptExt) {
      const compBuffer = buffers[meshoptExt.buffer || 0] || buffers[0];
      const compOffset = meshoptExt.byteOffset || 0;
      const compLength = meshoptExt.byteLength;
      const source = new Uint8Array(compBuffer, compOffset, compLength);
      const count = meshoptExt.count;
      const byteStride = meshoptExt.byteStride;
      const target = new Uint8Array(count * byteStride);

      MeshoptDecoder.decodeGltfBuffer(
        target,
        count,
        byteStride,
        source,
        meshoptExt.mode,
        meshoptExt.filter || 'NONE'
      );

      const entry = { buffer: target.buffer, stride: byteStride };
      decodedBufferViews.set(bufferViewIdx, entry);
      return { buffer: target.buffer, byteOffset: 0, stride: byteStride };
    }

    const rawBuffer = buffers[bufferView.buffer || 0] || buffers[0];
    return {
      buffer: rawBuffer,
      byteOffset: bufferView.byteOffset || 0,
      stride: bufferView.byteStride || 0,
    };
  }

  // Helper to extract POSITION attributes with componentType and byteStride support
  function extractPositions(posAccessorIdx: number): Float32Array | null {
    const accessor = gltf.accessors?.[posAccessorIdx];
    if (!accessor) {
      console.warn(`[GLB] Accessor ${posAccessorIdx} not found`);
      return null;
    }

    if (accessor.bufferView === undefined) {
      console.warn(`[GLB] Accessor ${posAccessorIdx} has undefined bufferView`);
      return null;
    }

    const bvData = getBufferViewData(accessor.bufferView);
    if (!bvData) {
      console.warn(`[GLB] BufferView ${accessor.bufferView} data could not be retrieved`);
      return null;
    }

    const targetBuffer = bvData.buffer;
    const targetView = new DataView(targetBuffer);

    const count = accessor.count || 0;
    if (count === 0) return null;

    const compType = accessor.componentType || 5126; // 5126 = FLOAT
    const compSize = compType === 5126 ? 4 : compType === 5122 || compType === 5123 ? 2 : 1;
    const elemSize = compSize * 3;
    const byteOffset = bvData.byteOffset + (accessor.byteOffset || 0);
    const stride = bvData.stride || elemSize;

    // Resilient bounds check: compute how many vertices can safely be read from targetBuffer
    const availableBytes = Math.max(0, targetBuffer.byteLength - byteOffset);
    const maxPossibleVerts = stride > 0 ? Math.floor((availableBytes - elemSize) / stride) + 1 : 0;
    const numVertsToRead = Math.max(0, Math.min(count, maxPossibleVerts));

    if (numVertsToRead === 0) {
      console.warn(
        `[GLB] Accessor ${posAccessorIdx} out of bounds: byteOffset=${byteOffset}, stride=${stride}, count=${count}, bufLen=${targetBuffer.byteLength}`
      );
      return null;
    }

    const verts = new Float32Array(numVertsToRead * 3);
    for (let i = 0; i < numVertsToRead; i++) {
      const ptr = byteOffset + i * stride;
      if (compType === 5126) {
        // FLOAT (4 bytes)
        verts[i * 3] = targetView.getFloat32(ptr, true);
        verts[i * 3 + 1] = targetView.getFloat32(ptr + 4, true);
        verts[i * 3 + 2] = targetView.getFloat32(ptr + 8, true);
      } else if (compType === 5122) {
        // SHORT (signed 16-bit)
        verts[i * 3] = targetView.getInt16(ptr, true);
        verts[i * 3 + 1] = targetView.getInt16(ptr + 2, true);
        verts[i * 3 + 2] = targetView.getInt16(ptr + 4, true);
      } else if (compType === 5123) {
        // UNSIGNED_SHORT (16-bit)
        verts[i * 3] = targetView.getUint16(ptr, true);
        verts[i * 3 + 1] = targetView.getUint16(ptr + 2, true);
        verts[i * 3 + 2] = targetView.getUint16(ptr + 4, true);
      } else if (compType === 5120) {
        // BYTE (signed 8-bit)
        verts[i * 3] = targetView.getInt8(ptr);
        verts[i * 3 + 1] = targetView.getInt8(ptr + 1);
        verts[i * 3 + 2] = targetView.getInt8(ptr + 2);
      } else if (compType === 5121) {
        // UNSIGNED_BYTE (8-bit)
        verts[i * 3] = targetView.getUint8(ptr);
        verts[i * 3 + 1] = targetView.getUint8(ptr + 1);
        verts[i * 3 + 2] = targetView.getUint8(ptr + 2);
      }
    }
    return verts;
  }

  // Helper to extract indices with componentType and primitive.mode support
  function extractIndices(
    indicesAccessorIdx: number | undefined,
    posCount: number,
    mode = 4
  ): Uint32Array {
    if (indicesAccessorIdx === undefined) {
      const raw = new Uint32Array(posCount);
      for (let i = 0; i < posCount; i++) raw[i] = i;
      return convertModeToTriangles(raw, mode);
    }

    const accessor = gltf.accessors?.[indicesAccessorIdx];
    if (!accessor || accessor.bufferView === undefined) {
      const raw = new Uint32Array(posCount);
      for (let i = 0; i < posCount; i++) raw[i] = i;
      return convertModeToTriangles(raw, mode);
    }

    const bvData = getBufferViewData(accessor.bufferView);
    if (!bvData) {
      const raw = new Uint32Array(posCount);
      for (let i = 0; i < posCount; i++) raw[i] = i;
      return convertModeToTriangles(raw, mode);
    }

    const count = accessor.count || 0;
    if (count === 0) {
      const raw = new Uint32Array(posCount);
      for (let i = 0; i < posCount; i++) raw[i] = i;
      return convertModeToTriangles(raw, mode);
    }

    const byteOffset = bvData.byteOffset + (accessor.byteOffset || 0);
    const compType = accessor.componentType;
    const targetBuffer = bvData.buffer;
    const targetView = new DataView(targetBuffer);
    const raw = new Uint32Array(count);

    for (let i = 0; i < count; i++) {
      let val = 0;
      if (compType === 5121) {
        if (byteOffset + i < targetBuffer.byteLength) {
          val = targetView.getUint8(byteOffset + i);
        }
      } else if (compType === 5123) {
        if (byteOffset + i * 2 + 2 <= targetBuffer.byteLength) {
          val = targetView.getUint16(byteOffset + i * 2, true);
        }
      } else if (compType === 5125) {
        if (byteOffset + i * 4 + 4 <= targetBuffer.byteLength) {
          val = targetView.getUint32(byteOffset + i * 4, true);
        }
      }
      raw[i] = val < posCount ? val : 0;
    }

    return convertModeToTriangles(raw, mode);
  }

  function convertModeToTriangles(raw: Uint32Array, mode: number): Uint32Array {
    if (mode === 5) {
      // TRIANGLE_STRIP
      const triCount = Math.max(0, raw.length - 2);
      const out = new Uint32Array(triCount * 3);
      for (let i = 0; i < triCount; i++) {
        if (i % 2 === 0) {
          out[i * 3] = raw[i];
          out[i * 3 + 1] = raw[i + 1];
          out[i * 3 + 2] = raw[i + 2];
        } else {
          out[i * 3] = raw[i + 1];
          out[i * 3 + 1] = raw[i];
          out[i * 3 + 2] = raw[i + 2];
        }
      }
      return out;
    }
    if (mode === 6) {
      // TRIANGLE_FAN
      const triCount = Math.max(0, raw.length - 2);
      const out = new Uint32Array(triCount * 3);
      for (let i = 0; i < triCount; i++) {
        out[i * 3] = raw[0];
        out[i * 3 + 1] = raw[i + 1];
        out[i * 3 + 2] = raw[i + 2];
      }
      return out;
    }
    return raw;
  }

  // Helper to construct 4x4 matrix from glTF node
  function getNodeLocalMatrix(node: any): Float32Array {
    if (Array.isArray(node.matrix) && node.matrix.length === 16) {
      return new Float32Array(node.matrix);
    }
    const t = node.translation || [0, 0, 0];
    const r = node.rotation || [0, 0, 0, 1];
    const s = node.scale || [1, 1, 1];

    const [x, y, z] = t;
    const [qx, qy, qz, qw] = r;
    const [sx, sy, sz] = s;

    const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
    const xx = qx * x2, xy = qx * y2, xz = qx * z2;
    const yy = qy * y2, yz = qy * z2, zz = qz * z2;
    const wx = qw * x2, wy = qw * y2, wz = qw * z2;

    const out = new Float32Array(16);
    out[0] = (1 - (yy + zz)) * sx;
    out[1] = (xy + wz) * sx;
    out[2] = (xz - wy) * sx;
    out[3] = 0;

    out[4] = (xy - wz) * sy;
    out[5] = (1 - (xx + zz)) * sy;
    out[6] = (yz + wx) * sy;
    out[7] = 0;

    out[8] = (xz + wy) * sz;
    out[9] = (yz - wx) * sz;
    out[10] = (1 - (xx + yy)) * sz;
    out[11] = 0;

    out[12] = x;
    out[13] = y;
    out[14] = z;
    out[15] = 1;

    return out;
  }

  function multiply4x4(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        out[col * 4 + row] =
          a[row] * b[col * 4] +
          a[4 + row] * b[col * 4 + 1] +
          a[8 + row] * b[col * 4 + 2] +
          a[12 + row] * b[col * 4 + 3];
      }
    }
    return out;
  }

  interface ExtractedPrimitive {
    vertices: Float32Array;
    indices: Uint32Array;
  }

  const collectedPrimitives: ExtractedPrimitive[] = [];

  // Traverse scene graph if nodes exist
  if (Array.isArray(gltf.nodes) && gltf.nodes.length > 0) {
    const visited = new Set<number>();

    function traverseNode(nodeIdx: number, parentMatrix: Float32Array) {
      if (visited.has(nodeIdx)) return;
      visited.add(nodeIdx);

      const node = gltf.nodes[nodeIdx];
      if (!node) return;
      const localMat = getNodeLocalMatrix(node);
      const worldMat = multiply4x4(parentMatrix, localMat);

      if (typeof node.mesh === 'number') {
        const meshObj = gltf.meshes?.[node.mesh];
        if (Array.isArray(meshObj?.primitives)) {
          for (const prim of meshObj.primitives) {
            const posIdx =
              prim.attributes?.POSITION ??
              prim.attributes?.position ??
              prim.attributes?.Position;
            if (posIdx !== undefined) {
              const rawVerts = extractPositions(posIdx);
              if (rawVerts && rawVerts.length > 0) {
                const numV = rawVerts.length / 3;
                const transformedVerts = new Float32Array(rawVerts.length);
                for (let v = 0; v < numV; v++) {
                  const vx = rawVerts[v * 3];
                  const vy = rawVerts[v * 3 + 1];
                  const vz = rawVerts[v * 3 + 2];
                  transformedVerts[v * 3] =
                    vx * worldMat[0] + vy * worldMat[4] + vz * worldMat[8] + worldMat[12];
                  transformedVerts[v * 3 + 1] =
                    vx * worldMat[1] + vy * worldMat[5] + vz * worldMat[9] + worldMat[13];
                  transformedVerts[v * 3 + 2] =
                    vx * worldMat[2] + vy * worldMat[6] + vz * worldMat[10] + worldMat[14];
                }
                const indices = extractIndices(prim.indices, numV, prim.mode ?? 4);
                collectedPrimitives.push({ vertices: transformedVerts, indices });
              }
            }
          }
        }
      }

      if (Array.isArray(node.children)) {
        for (const childIdx of node.children) {
          traverseNode(childIdx, worldMat);
        }
      }
    }

    const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const sceneRoots = gltf.scenes?.[gltf.scene ?? 0]?.nodes;
    const rootNodes: number[] =
      Array.isArray(sceneRoots) && sceneRoots.length > 0
        ? sceneRoots
        : gltf.nodes.map((_: any, i: number) => i);

    for (const rootIdx of rootNodes) {
      traverseNode(rootIdx, identity);
    }
  }

  // Fallback: If no primitives collected through nodes, directly extract from all meshes
  if (collectedPrimitives.length === 0 && Array.isArray(gltf.meshes)) {
    for (const meshObj of gltf.meshes) {
      if (Array.isArray(meshObj?.primitives)) {
        for (const prim of meshObj.primitives) {
          const posIdx =
            prim.attributes?.POSITION ??
            prim.attributes?.position ??
            prim.attributes?.Position;
          if (posIdx !== undefined) {
            const rawVerts = extractPositions(posIdx);
            if (rawVerts && rawVerts.length > 0) {
              const numV = rawVerts.length / 3;
              const indices = extractIndices(prim.indices, numV, prim.mode ?? 4);
              collectedPrimitives.push({ vertices: rawVerts, indices });
            }
          }
        }
      }
    }
  }

  if (collectedPrimitives.length === 0) {
    if (!Array.isArray(gltf.meshes) || gltf.meshes.length === 0) {
      throw new Error('No 3D vertex position geometry found in GLB container: container has 0 meshes.');
    }
    const detectedAttrs = gltf.meshes
      .flatMap((m: any) => m.primitives || [])
      .map((p: any) => Object.keys(p.attributes || {}).join(','))
      .filter(Boolean);
    throw new Error(
      `No 3D vertex position geometry found in GLB container.${
        detectedAttrs.length > 0 ? ` (Detected attributes: [${detectedAttrs.join(' | ')}])` : ''
      }`
    );
  }

  // If there are detailed primitives totaling > 100 vertices,
  // skip standalone 8-vertex 12-triangle bounding box collision hulls
  const totalVertCount = collectedPrimitives.reduce((sum, p) => sum + p.vertices.length / 3, 0);
  const activePrimitives =
    totalVertCount > 100
      ? collectedPrimitives.filter((p) => !(p.vertices.length === 24 && p.indices.length === 36))
      : collectedPrimitives;

  const primitivesToMerge = activePrimitives.length > 0 ? activePrimitives : collectedPrimitives;

  // Merge all primitives into unified Mesh3D
  let totalVertices = 0;
  let totalIndices = 0;
  for (const p of primitivesToMerge) {
    totalVertices += p.vertices.length;
    totalIndices += p.indices.length;
  }

  const mergedVertices = new Float32Array(totalVertices);
  const mergedIndices =
    totalVertices / 3 > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let vertOffset = 0;
  let idxOffset = 0;
  let baseVertex = 0;

  for (const p of primitivesToMerge) {
    mergedVertices.set(p.vertices, vertOffset);
    const pVertCount = p.vertices.length / 3;
    for (let i = 0; i < p.indices.length; i++) {
      mergedIndices[idxOffset + i] = p.indices[i] + baseVertex;
    }
    vertOffset += p.vertices.length;
    idxOffset += p.indices.length;
    baseVertex += pVertCount;
  }

  let vertices = mergedVertices;
  let indices: Uint16Array | Uint32Array = mergedIndices;

  // Auto-normalize and center the model to standard stage bounds (160 units span)
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const posCount = vertices.length / 3;

  for (let i = 0; i < posCount; i++) {
    const x = vertices[i * 3];
    const y = vertices[i * 3 + 1];
    const z = vertices[i * 3 + 2];
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  if (minX !== Infinity && maxX !== -Infinity) {
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    const maxSpan = Math.max(spanX, spanY, spanZ) || 1;

    // Fit model nicely into 160px bounding radius
    const targetScale = 160 / maxSpan;

    for (let i = 0; i < posCount; i++) {
      vertices[i * 3] = (vertices[i * 3] - centerX) * targetScale;
      // Invert Y: glTF has +Y up, 2D Canvas has +Y down
      vertices[i * 3 + 1] = -(vertices[i * 3 + 1] - centerY) * targetScale;
      vertices[i * 3 + 2] = (vertices[i * 3 + 2] - centerZ) * targetScale;
    }
  }

  // High-Fidelity Surface Simplification & Vertex Compaction (via MeshoptSimplifier)
  // Preserves 100% continuous solid topological manifold, silhouette, and facial/body features
  // while capping face count at 1,800 faces for rock-solid 60 FPS Canvas2D live playback.
  const numFaces = Math.floor(indices.length / 3);
  const MAX_FACES = 1800;
  if (numFaces > MAX_FACES) {
    const targetIndices = MAX_FACES * 3;
    const indices32 = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
    let [simplified] = MeshoptSimplifier.simplify(indices32, vertices, 3, targetIndices, 0.05);

    if (simplified.length === 0 || simplified.length > targetIndices * 1.5) {
      const [sloppy] = MeshoptSimplifier.simplifySloppy(
        indices32,
        vertices,
        3,
        null,
        targetIndices,
        0.1
      );
      if (sloppy.length > 0) {
        simplified = sloppy;
      }
    }

    if (simplified.length > 0) {
      // Remap and compact vertices to eliminate unused vertex overhead
      const remap = new Int32Array(vertices.length / 3).fill(-1);
      let newVertCount = 0;
      for (let i = 0; i < simplified.length; i++) {
        const oldIdx = simplified[i];
        if (oldIdx < remap.length && remap[oldIdx] === -1) {
          remap[oldIdx] = newVertCount++;
        }
      }

      const newIndices = new Uint32Array(simplified.length);
      for (let i = 0; i < simplified.length; i++) {
        const oldIdx = simplified[i];
        newIndices[i] = oldIdx < remap.length ? remap[oldIdx] : 0;
      }

      const newVertices = new Float32Array(newVertCount * 3);
      for (let oldIdx = 0; oldIdx < remap.length; oldIdx++) {
        const newIdx = remap[oldIdx];
        if (newIdx !== -1) {
          newVertices[newIdx * 3] = vertices[oldIdx * 3];
          newVertices[newIdx * 3 + 1] = vertices[oldIdx * 3 + 1];
          newVertices[newIdx * 3 + 2] = vertices[oldIdx * 3 + 2];
        }
      }

      vertices = newVertices;
      indices = newIndices;
    }
  }

  return { vertices, indices };
}

/**
 * 3D Mesh Engine rasterizing 3D geometry into 2D Canvas with perspective projection and depth-sorting.
 */
export class GltfMeshEngine {
  private disposed = false;
  private customMesh: Mesh3D | null = null;
  private readonly meshRegistry = new Map<string, Mesh3D>();

  // Zero-allocation reusable typed array buffers for 60+ FPS live Canvas2D rendering
  private bufferCapacity = 8192;
  private projX = new Float32Array(8192);
  private projY = new Float32Array(8192);
  private projZ = new Float32Array(8192);
  private rotX = new Float32Array(8192);
  private rotY = new Float32Array(8192);
  private rotZ = new Float32Array(8192);

  private visibleFaces = new Uint32Array(8192);
  private faceDepths = new Float32Array(8192);
  private faceShades = new Uint8Array(8192);
  private faceOrder = new Int32Array(8192);

  // Cached lighting shade palette to avoid runtime string allocations
  private cachedBaseColor = '';
  private baseR = 0;
  private baseG = 255;
  private baseB = 102;
  private shadePalette: string[] = new Array(16);

  private ensureCapacity(neededVerts: number, neededFaces: number): void {
    const required = Math.max(neededVerts, neededFaces);
    if (required > this.bufferCapacity) {
      this.bufferCapacity = Math.max(required * 2, 8192);
      this.projX = new Float32Array(this.bufferCapacity);
      this.projY = new Float32Array(this.bufferCapacity);
      this.projZ = new Float32Array(this.bufferCapacity);
      this.rotX = new Float32Array(this.bufferCapacity);
      this.rotY = new Float32Array(this.bufferCapacity);
      this.rotZ = new Float32Array(this.bufferCapacity);
      this.visibleFaces = new Uint32Array(this.bufferCapacity);
      this.faceDepths = new Float32Array(this.bufferCapacity);
      this.faceShades = new Uint8Array(this.bufferCapacity);
      this.faceOrder = new Int32Array(this.bufferCapacity);
    }
  }

  private updatePalette(color: string): void {
    if (this.cachedBaseColor === color) return;
    this.cachedBaseColor = color;

    let r = 0;
    let g = 255;
    let b = 102;
    if (typeof color === 'string' && color.startsWith('#')) {
      let hex = color.slice(1);
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const num = parseInt(hex, 16);
      if (!Number.isNaN(num)) {
        r = (num >> 16) & 255;
        g = (num >> 8) & 255;
        b = num & 255;
      }
    }
    this.baseR = r;
    this.baseG = g;
    this.baseB = b;

    for (let i = 0; i < 16; i++) {
      const intensity = 0.25 + (i / 15) * 0.75;
      const sr = Math.round(r * intensity);
      const sg = Math.round(g * intensity);
      const sb = Math.round(b * intensity);
      this.shadePalette[i] = `rgb(${sr},${sg},${sb})`;
    }
  }

  /**
   * Simplifies a mesh if it exceeds the 1,800 triangle budget for 60 FPS Canvas2D rendering.
   */
  private processMeshGeometry(mesh: Mesh3D): Mesh3D {
    const numFaces = (mesh.indices.length / 3) | 0;
    if (numFaces > 1800 && MeshoptSimplifier.supported) {
      try {
        const targetIndices = 1800 * 3;
        const indices32 =
          mesh.indices instanceof Uint32Array ? mesh.indices : new Uint32Array(mesh.indices);
        let [simplified] = MeshoptSimplifier.simplify(
          indices32,
          mesh.vertices,
          3,
          targetIndices,
          0.05
        );

        if (simplified.length === 0 || simplified.length > targetIndices * 1.5) {
          const [sloppy] = MeshoptSimplifier.simplifySloppy(
            indices32,
            mesh.vertices,
            3,
            null,
            targetIndices,
            0.1
          );
          if (sloppy.length > 0) simplified = sloppy;
        }

        if (simplified.length > 0) {
          const remap = new Int32Array(mesh.vertices.length / 3).fill(-1);
          let newVertCount = 0;
          for (let i = 0; i < simplified.length; i++) {
            const oldIdx = simplified[i];
            if (oldIdx < remap.length && remap[oldIdx] === -1) {
              remap[oldIdx] = newVertCount++;
            }
          }

          const newIndices = new Uint32Array(simplified.length);
          for (let i = 0; i < simplified.length; i++) {
            const oldIdx = simplified[i];
            newIndices[i] = oldIdx < remap.length ? remap[oldIdx] : 0;
          }

          const newVertices = new Float32Array(newVertCount * 3);
          for (let oldIdx = 0; oldIdx < remap.length; oldIdx++) {
            const newIdx = remap[oldIdx];
            if (newIdx !== -1) {
              newVertices[newIdx * 3] = mesh.vertices[oldIdx * 3];
              newVertices[newIdx * 3 + 1] = mesh.vertices[oldIdx * 3 + 1];
              newVertices[newIdx * 3 + 2] = mesh.vertices[oldIdx * 3 + 2];
            }
          }

          return { vertices: newVertices, indices: newIndices };
        }
      } catch (err) {
        console.warn('[GltfMeshEngine] Mesh simplification deferred:', err);
      }
    }
    return mesh;
  }

  /**
   * Registers a named 3D mesh into the engine registry.
   */
  public registerMesh(key: string, mesh: Mesh3D): void {
    const processed = this.processMeshGeometry(mesh);
    this.meshRegistry.set(key, processed);
    if (key === 'custom-glb') {
      this.customMesh = processed;
    }
  }

  /**
   * Registers a user-uploaded custom 3D mesh (e.g. from parsed GLB).
   * Automatically enforces 60 FPS face budget through topological simplification.
   */
  public setCustomMesh(mesh: Mesh3D | null): void {
    if (!mesh) {
      this.customMesh = null;
      this.meshRegistry.delete('custom-glb');
      return;
    }
    this.registerMesh('custom-glb', mesh);
  }

  /**
   * Retrieves a 3D mesh by key with automatic fallback to built-in geometric generators.
   */
  public getMesh(key?: string): Mesh3D | null {
    const k = key || 'custom-glb';
    if (this.meshRegistry.has(k)) {
      return this.meshRegistry.get(k)!;
    }
    if (k === '3d-torus-knot') {
      const m = createTorusKnotMesh(2, 3);
      this.meshRegistry.set(k, m);
      return m;
    }
    if (k === '3d-icosahedron') {
      const m = createIcosahedronMesh(64);
      this.meshRegistry.set(k, m);
      return m;
    }
    if (k === '3d-monolith' || k === '3d-monolith3d') {
      const m = createMonolith3DMesh(60, 140, 35);
      this.meshRegistry.set(k, m);
      return m;
    }
    return this.customMesh || createIcosahedronMesh(64);
  }

  /**
   * Lists all available 3D mesh identifiers in the registry.
   */
  public listRegisteredMeshes(): string[] {
    const keys = new Set<string>(['3d-torus-knot', '3d-icosahedron', '3d-monolith3d']);
    for (const k of this.meshRegistry.keys()) {
      keys.add(k);
    }
    if (this.customMesh) {
      keys.add('custom-glb');
    }
    return Array.from(keys);
  }

  /**
   * Retrieves the currently active user-uploaded custom 3D mesh.
   */
  public getCustomMesh(): Mesh3D | null {
    return this.customMesh;
  }

  /**
   * Renders a 3D mesh with Euler rotation, perspective projection, depth-sorting, and lighting.
   * Employs zero-allocation contiguous buffers, early backface culling, shade grouping,
   * and single-pass wireframe batching to ensure stable 60 FPS live Canvas2D playback.
   */
  public render3DMesh(
    targetCtx: AnyCanvas2DContext | SafeCanvas2D,
    options: Render3DMeshOptions
  ): void {
    if (this.disposed || !options.mesh) return;

    try {
      const {
        mesh,
        width,
        height,
        centerX,
        centerY,
        rotationX = 0,
        rotationY = 0,
        rotationZ = 0,
        scale = 1.0,
        color = '#00FF66',
        wireframe = true,
        fill = true,
        lightDirection = [0.577, 0.577, 0.577],
      } = options;

      const ctx: CanvasRenderingContext2D =
        targetCtx && typeof targetCtx === 'object' && 'raw' in targetCtx && (targetCtx as any).raw
          ? ((targetCtx as any).raw as CanvasRenderingContext2D)
          : (targetCtx as CanvasRenderingContext2D);

      const { vertices, indices } = mesh;
      const numVerts = (vertices.length / 3) | 0;
      const numFaces = (indices.length / 3) | 0;
      if (numVerts === 0 || numFaces === 0) return;

      this.ensureCapacity(numVerts, numFaces);
      this.updatePalette(color);

      const cx = centerX ?? width / 2;
      const cy = centerY ?? height / 2;
      const fov = 400;
      const fovDist = 500;

      // Rotation angles
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosZ = Math.cos(rotationZ);
      const sinZ = Math.sin(rotationZ);

      // Fast SoA Vertex Transformation (Zero Object Allocation)
      for (let i = 0; i < numVerts; i++) {
        const vx = vertices[i * 3] * scale;
        const vy = vertices[i * 3 + 1] * scale;
        const vz = vertices[i * 3 + 2] * scale;

        // Rotate Y
        const x1 = vx * cosY + vz * sinY;
        const y1 = vy;
        const z1 = -vx * sinY + vz * cosY;

        // Rotate X
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // Rotate Z
        const x3 = x2 * cosZ - y2 * sinZ;
        const y3 = x2 * sinZ + y2 * cosZ;
        const z3 = z2;

        this.rotX[i] = x3;
        this.rotY[i] = y3;
        this.rotZ[i] = z3;

        // Perspective projection
        const depth = z3 + fovDist;
        const factor = depth > 10 ? fov / depth : 1;
        this.projX[i] = cx + x3 * factor;
        this.projY[i] = cy + y3 * factor;
        this.projZ[i] = z3;
      }

      // Directional light unit vector
      const [rawLx, rawLy, rawLz] = lightDirection;
      const lLen = Math.hypot(rawLx, rawLy, rawLz) || 1;
      const lx = rawLx / lLen;
      const ly = rawLy / lLen;
      const lz = rawLz / lLen;

      // Back-Face Culling & Lighting Shade Pre-Calculation
      const MAX_RENDER_FACES = 2500;
      let visibleCount = 0;

      for (let f = 0; f < numFaces && visibleCount < MAX_RENDER_FACES; f++) {
        const i0 = indices[f * 3];
        const i1 = indices[f * 3 + 1];
        const i2 = indices[f * 3 + 2];

        const p0x = this.projX[i0];
        const p0y = this.projY[i0];
        const p1x = this.projX[i1];
        const p1y = this.projY[i1];
        const p2x = this.projX[i2];
        const p2y = this.projY[i2];

        const crossZ = (p1x - p0x) * (p2y - p0y) - (p1y - p0y) * (p2x - p0x);
        // Back-face cull clockwise faces when filled to cut rasterization work in half
        if (fill && crossZ <= 0) continue;

        // Surface normal in rotated 3D world space
        const e1x = this.rotX[i1] - this.rotX[i0];
        const e1y = this.rotY[i1] - this.rotY[i0];
        const e1z = this.rotZ[i1] - this.rotZ[i0];
        const e2x = this.rotX[i2] - this.rotX[i0];
        const e2y = this.rotY[i2] - this.rotY[i0];
        const e2z = this.rotZ[i2] - this.rotZ[i0];

        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;
        const nLen = Math.hypot(nx, ny, nz) || 1;

        const dot = Math.max(0, (nx / nLen) * lx + (ny / nLen) * ly + (nz / nLen) * lz);
        const shadeIdx = Math.min(15, (dot * 16) | 0);

        this.visibleFaces[visibleCount] = f;
        this.faceDepths[visibleCount] = (this.projZ[i0] + this.projZ[i1] + this.projZ[i2]) / 3;
        this.faceShades[visibleCount] = shadeIdx;
        this.faceOrder[visibleCount] = visibleCount;
        visibleCount++;
      }

      if (visibleCount === 0) return;

      // Fast Sort by Depth (Painter's Algorithm)
      const depths = this.faceDepths;
      const order = this.faceOrder.subarray(0, visibleCount);
      order.sort((a, b) => depths[a] - depths[b]);

      ctx.save();

      // Batched Solid Polygons: Group consecutive identical shades into single Canvas2D fill calls
      if (fill) {
        let currentShade = -1;
        let pathOpen = false;

        for (let i = 0; i < visibleCount; i++) {
          const entryIdx = order[i];
          const shade = this.faceShades[entryIdx];
          const f = this.visibleFaces[entryIdx];
          const i0 = indices[f * 3];
          const i1 = indices[f * 3 + 1];
          const i2 = indices[f * 3 + 2];

          if (shade !== currentShade) {
            if (pathOpen) {
              ctx.fill();
            }
            ctx.fillStyle = this.shadePalette[shade];
            ctx.beginPath();
            currentShade = shade;
            pathOpen = true;
          }

          ctx.moveTo(this.projX[i0], this.projY[i0]);
          ctx.lineTo(this.projX[i1], this.projY[i1]);
          ctx.lineTo(this.projX[i2], this.projY[i2]);
          ctx.closePath();
        }
        if (pathOpen) {
          ctx.fill();
        }
      }

      // Batched Wireframe: Draw ALL visible edges in a single path and 1 stroke call!
      if (wireframe) {
        if (fill) {
          // Subtle polygonal facet edge highlight
          ctx.strokeStyle = `rgba(${Math.round(this.baseR * 0.35)}, ${Math.round(this.baseG * 0.35)}, ${Math.round(this.baseB * 0.35)}, 0.35)`;
          ctx.lineWidth = 0.75;
        } else {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.0;
        }

        ctx.beginPath();
        for (let i = 0; i < visibleCount; i++) {
          const f = this.visibleFaces[order[i]];
          const i0 = indices[f * 3];
          const i1 = indices[f * 3 + 1];
          const i2 = indices[f * 3 + 2];

          ctx.moveTo(this.projX[i0], this.projY[i0]);
          ctx.lineTo(this.projX[i1], this.projY[i1]);
          ctx.lineTo(this.projX[i2], this.projY[i2]);
          ctx.closePath();
        }
        ctx.stroke();
      }

      ctx.restore();
    } catch (err) {
      console.warn('GltfMeshEngine 3D render caught error defensively:', err);
    }
  }

  public dispose(): void {
    this.disposed = true;
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}

export const gltfMeshEngine = new GltfMeshEngine();
