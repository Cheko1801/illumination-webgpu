import type { Vec3 } from "./math";

export interface SceneObject {
  id: number;
  name: string;
  geometryType: "cube" | "sphere" | "obj";
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  vertexData: Float32Array;
  vertexBuffer: GPUBuffer | null;
  vertexCount: number;
  normalLineData: Float32Array | null;
  normalLineBuffer: GPUBuffer | null;
  normalLineCount: number;
  textureImage: HTMLImageElement | null;
  gpuTexture: GPUTexture | null;
  textureBindGroup: GPUBindGroup | null;
  textureName: string;
  visible: boolean;
}

export type RenderMode = "solid" | "wireframe" | "uvdebug" | "normals";
export type LightType = "point" | "directional" | "spot";
