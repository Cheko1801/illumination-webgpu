/**
 * Simple OBJ file parser.
 * Supports: v, vn, vt, f (triangles and quads, all index formats).
 * Returns Float32Array in [x,y,z, nx,ny,nz, u,v] stride-8 format.
 */
export function parseOBJ(text: string): Float32Array {
  const positions: number[][] = [];
  const normals: number[][] = [];
  const uvs: number[][] = [];
  const outVerts: number[] = [];

  const lines = text.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const cmd = parts[0];

    if (cmd === "v") {
      positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (cmd === "vn") {
      normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (cmd === "vt") {
      uvs.push([parseFloat(parts[1]), parseFloat(parts[2]) || 0]);
    } else if (cmd === "f") {
      const faceVerts: number[][] = [];
      for (let i = 1; i < parts.length; i++) {
        const indices = parts[i].split("/");
        const vi = parseInt(indices[0]) - 1;
        const ti = indices.length > 1 && indices[1] !== "" ? parseInt(indices[1]) - 1 : -1;
        const ni = indices.length > 2 && indices[2] !== "" ? parseInt(indices[2]) - 1 : -1;
        const pos = positions[vi] || [0, 0, 0];
        const uv = ti >= 0 && uvs[ti] ? uvs[ti] : [0, 0];
        const norm = ni >= 0 && normals[ni] ? normals[ni] : [0, 0, 0];
        faceVerts.push([...pos, ...norm, ...uv]);
      }
      // Triangulate (fan from first vertex)
      for (let i = 1; i < faceVerts.length - 1; i++) {
        outVerts.push(...faceVerts[0], ...faceVerts[i], ...faceVerts[i + 1]);
      }
    }
  }

  const result = new Float32Array(outVerts);

  // If no normals were provided, compute face normals
  if (normals.length === 0) {
    computeFaceNormals(result);
  }

  return result;
}

function computeFaceNormals(verts: Float32Array): void {
  const stride = 8;
  const triCount = verts.length / stride / 3;
  for (let t = 0; t < triCount; t++) {
    const b = t * 3 * stride;
    const ax = verts[b + stride] - verts[b];
    const ay = verts[b + stride + 1] - verts[b + 1];
    const az = verts[b + stride + 2] - verts[b + 2];
    const bx = verts[b + 2 * stride] - verts[b];
    const by = verts[b + 2 * stride + 1] - verts[b + 1];
    const bz = verts[b + 2 * stride + 2] - verts[b + 2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (let v = 0; v < 3; v++) {
      verts[b + v * stride + 3] = nx;
      verts[b + v * stride + 4] = ny;
      verts[b + v * stride + 5] = nz;
    }
  }
}
