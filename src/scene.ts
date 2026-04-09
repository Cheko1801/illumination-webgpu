import type { SceneObject } from "./types";
import { generateCube, generateSphere, generateNormalLines } from "./geometry";
import { parseOBJ } from "./objLoader";

let nextId = 0;

export class SceneManager {
  objects: SceneObject[] = [];
  selectedId: number | null = null;

  addObject(
    geometryType: "cube" | "sphere" | "obj",
    name?: string,
    objData?: string
  ): SceneObject {
    let vertexData: Float32Array;
    if (geometryType === "cube") {
      vertexData = generateCube();
    } else if (geometryType === "sphere") {
      vertexData = generateSphere(48, 48);
    } else if (geometryType === "obj" && objData) {
      vertexData = parseOBJ(objData);
    } else {
      vertexData = generateCube();
    }

    const normalLineData = generateNormalLines(vertexData);

    // Auto-offset so new objects don't stack on top of each other
    const idx = this.objects.length;
    const spacing = 2.5;
    const cols = 4;
    const ox = (idx % cols) * spacing - ((cols - 1) * spacing) / 2;
    const oz = Math.floor(idx / cols) * spacing;

    const obj: SceneObject = {
      id: nextId++,
      name: name || `${geometryType}_${nextId - 1}`,
      geometryType,
      position: [ox, 0, oz],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: "#4a9eff",
      vertexData,
      vertexBuffer: null,
      vertexCount: vertexData.length / 8,
      normalLineData,
      normalLineBuffer: null,
      normalLineCount: normalLineData.length / 6,
      textureImage: null,
      gpuTexture: null,
      textureBindGroup: null,
      textureName: "",
      visible: true,
    };
    this.objects.push(obj);
    return obj;
  }

  removeObject(id: number): void {
    const idx = this.objects.findIndex(o => o.id === id);
    if (idx < 0) return;
    const obj = this.objects[idx];
    obj.vertexBuffer?.destroy();
    obj.normalLineBuffer?.destroy();
    obj.gpuTexture?.destroy();
    this.objects.splice(idx, 1);
    if (this.selectedId === id) this.selectedId = null;
  }

  selectObject(id: number): void {
    this.selectedId = id;
  }

  deselectAll(): void {
    this.selectedId = null;
  }

  getSelected(): SceneObject | null {
    if (this.selectedId === null) return null;
    return this.objects.find(o => o.id === this.selectedId) || null;
  }
}
