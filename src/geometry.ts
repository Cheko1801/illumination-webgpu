import type { Vec3 } from "./math";

// ── Vertex format: [x, y, z, nx, ny, nz, u, v] ── 8 floats per vertex

export function generateCube(): Float32Array {
  const faces: Array<{ n: Vec3; verts: number[][] }> = [
    { n: [0, 0, 1], verts: [[-1,-1,1,0,1],[1,-1,1,1,1],[1,1,1,1,0],[-1,-1,1,0,1],[1,1,1,1,0],[-1,1,1,0,0]] },
    { n: [0, 0,-1], verts: [[1,-1,-1,0,1],[-1,-1,-1,1,1],[-1,1,-1,1,0],[1,-1,-1,0,1],[-1,1,-1,1,0],[1,1,-1,0,0]] },
    { n: [-1, 0, 0], verts: [[-1,-1,-1,0,1],[-1,-1,1,1,1],[-1,1,1,1,0],[-1,-1,-1,0,1],[-1,1,1,1,0],[-1,1,-1,0,0]] },
    { n: [1, 0, 0], verts: [[1,-1,1,0,1],[1,-1,-1,1,1],[1,1,-1,1,0],[1,-1,1,0,1],[1,1,-1,1,0],[1,1,1,0,0]] },
    { n: [0, 1, 0], verts: [[-1,1,1,0,1],[1,1,1,1,1],[1,1,-1,1,0],[-1,1,1,0,1],[1,1,-1,1,0],[-1,1,-1,0,0]] },
    { n: [0,-1, 0], verts: [[-1,-1,-1,0,1],[1,-1,-1,1,1],[1,-1,1,1,0],[-1,-1,-1,0,1],[1,-1,1,1,0],[-1,-1,1,0,0]] },
  ];
  const data: number[] = [];
  for (const face of faces) {
    for (const v of face.verts) {
      data.push(v[0], v[1], v[2]);
      data.push(...face.n);
      data.push(v[3], v[4]);
    }
  }
  return new Float32Array(data);
}

export function generateSphere(stacks: number, slices: number): Float32Array {
  const data: number[] = [];
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      // Four corners of the quad
      const phi0 = Math.PI * i / stacks;
      const phi1 = Math.PI * (i + 1) / stacks;
      const theta0 = 2 * Math.PI * j / slices;
      const theta1 = 2 * Math.PI * (j + 1) / slices;

      const v00 = sphereVertex(phi0, theta0, i, j, stacks, slices);
      const v10 = sphereVertex(phi1, theta0, i + 1, j, stacks, slices);
      const v11 = sphereVertex(phi1, theta1, i + 1, j + 1, stacks, slices);
      const v01 = sphereVertex(phi0, theta1, i, j + 1, stacks, slices);

      // Triangle 1: v00, v10, v11
      data.push(...v00, ...v10, ...v11);
      // Triangle 2: v00, v11, v01
      data.push(...v00, ...v11, ...v01);
    }
  }
  return new Float32Array(data);
}

function sphereVertex(phi: number, theta: number, i: number, j: number, stacks: number, slices: number): number[] {
  const x = Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);
  const u = j / slices;
  const v = i / stacks;
  return [x, y, z, x, y, z, u, v]; // position = normal for unit sphere
}

/** Generate normal line geometry from triangle vertices.
 *  Output format: [x,y,z, r,g,b] per vertex, 2 vertices per face (line segment).
 */
export function generateNormalLines(vertices: Float32Array, lineLength = 0.15): Float32Array {
  const stride = 8;
  const triCount = vertices.length / stride / 3;
  const lines: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const base = t * 3 * stride;
    // Centroid
    const cx = (vertices[base] + vertices[base + stride] + vertices[base + 2 * stride]) / 3;
    const cy = (vertices[base + 1] + vertices[base + stride + 1] + vertices[base + 2 * stride + 1]) / 3;
    const cz = (vertices[base + 2] + vertices[base + stride + 2] + vertices[base + 2 * stride + 2]) / 3;
    // Face normal via cross product
    const ax = vertices[base + stride] - vertices[base];
    const ay = vertices[base + stride + 1] - vertices[base + 1];
    const az = vertices[base + stride + 2] - vertices[base + 2];
    const bx = vertices[base + 2 * stride] - vertices[base];
    const by = vertices[base + 2 * stride + 1] - vertices[base + 1];
    const bz = vertices[base + 2 * stride + 2] - vertices[base + 2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    // Line start (centroid) — yellow
    lines.push(cx, cy, cz, 1, 1, 0);
    // Line end (centroid + normal * length) — cyan
    lines.push(cx + nx * lineLength, cy + ny * lineLength, cz + nz * lineLength, 0, 1, 1);
  }
  return new Float32Array(lines);
}
