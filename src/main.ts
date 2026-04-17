/// <reference types="@webgpu/types" />
import "./style.css";
import shaderCode from "./shader.wgsl?raw";
import { ArcballCamera } from "./camera";
import { mat4 } from "./math";
import type { SceneObject, RenderMode, LightType } from "./types";
import { SceneManager } from "./scene";
import { initGUI, guiState } from "./gui";

/* ───────── WebGPU bootstrap ───────── */
if (!navigator.gpu) throw new Error("WebGPU not supported");
const canvas = document.querySelector("#gfx-main") as HTMLCanvasElement;
if (!canvas) throw new Error("Canvas #gfx-main not found");
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error("No GPU adapter");
const device = await adapter.requestDevice();
const ctx = canvas.getContext("webgpu")!;
const fmt = navigator.gpu.getPreferredCanvasFormat();
let depthTex: GPUTexture | null = null;
const camera = new ArcballCamera();

function resize() {
  canvas.width  = Math.max(1, Math.floor(innerWidth  * devicePixelRatio));
  canvas.height = Math.max(1, Math.floor(innerHeight * devicePixelRatio));
  camera.width = canvas.width;
  camera.height = canvas.height;
  ctx.configure({ device, format: fmt, alphaMode: "premultiplied" });
  depthTex?.destroy();
  depthTex = device.createTexture({
    size: [canvas.width, canvas.height], format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}
resize();
addEventListener("resize", resize);

/* ───────── Bind‑group layouts (explicit so both pipelines share group 0) ───── */
const uniformBGL = device.createBindGroupLayout({
  entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
});
const textureBGL = device.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
  ],
});

/* ───────── Uniform buffer (320 bytes) ───────── */
const UNI_SIZE = 320;
const uniformBuffer = device.createBuffer({ size: UNI_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const uAB   = new ArrayBuffer(UNI_SIZE);
const uF    = new Float32Array(uAB);
const uU    = new Uint32Array(uAB);
const uniformBG = device.createBindGroup({ layout: uniformBGL, entries: [{ binding: 0, resource: { buffer: uniformBuffer } }] });

/* ───────── Shader module ───────── */
const shader = device.createShaderModule({ label: "main", code: shaderCode });

/* ───────── Main pipeline (triangles) ───────── */
const mainPipeline = device.createRenderPipeline({
  label: "main-tri", layout: device.createPipelineLayout({ bindGroupLayouts: [uniformBGL, textureBGL] }),
  vertex: {
    module: shader, entryPoint: "vs_main",
    buffers: [{ arrayStride: 32, attributes: [
      { shaderLocation: 0, offset: 0,  format: "float32x3" },
      { shaderLocation: 1, offset: 12, format: "float32x3" },
      { shaderLocation: 2, offset: 24, format: "float32x2" },
    ]}],
  },
  fragment: { module: shader, entryPoint: "fs_main", targets: [{ format: fmt }] },
  primitive: { topology: "triangle-list", cullMode: "back" },
  depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
});

/* ───────── Line pipeline (for normal viz) ───────── */
const linePipeline = device.createRenderPipeline({
  label: "lines", layout: device.createPipelineLayout({ bindGroupLayouts: [uniformBGL] }),
  vertex: {
    module: shader, entryPoint: "vs_lines",
    buffers: [{ arrayStride: 24, attributes: [
      { shaderLocation: 0, offset: 0,  format: "float32x3" },
      { shaderLocation: 1, offset: 12, format: "float32x3" },
    ]}],
  },
  fragment: { module: shader, entryPoint: "fs_lines", targets: [{ format: fmt }] },
  primitive: { topology: "line-list" },
  depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
});

/* ───────── Default 1×1 white texture ───────── */
const defaultTex = device.createTexture({ size: [1,1], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
device.queue.writeTexture({ texture: defaultTex }, new Uint8Array([255,255,255,255]), { bytesPerRow: 4 }, [1,1]);
const defaultSampler = device.createSampler({ minFilter: "linear", magFilter: "linear" });
const defaultTexBG = device.createBindGroup({ layout: textureBGL, entries: [
  { binding: 0, resource: defaultSampler },
  { binding: 1, resource: defaultTex.createView() },
]});

/* ───────── Scene ───────── */
const scene = new SceneManager();

function ensureGPUBuffers(obj: SceneObject) {
  if (!obj.vertexBuffer) {
    const b = device.createBuffer({ size: obj.vertexData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(b, 0, obj.vertexData as Float32Array<ArrayBuffer>);
    obj.vertexBuffer = b;
    obj.vertexCount = obj.vertexData.length / 8;
  }
  if (!obj.normalLineBuffer && obj.normalLineData && obj.normalLineData.length > 0) {
    const b = device.createBuffer({ size: obj.normalLineData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(b, 0, obj.normalLineData as Float32Array<ArrayBuffer>);
    obj.normalLineBuffer = b;
    obj.normalLineCount = obj.normalLineData.length / 6;
  }
}

/* ───────── Texture loading ───────── */
export async function loadTextureForObject(obj: SceneObject, file: File) {
  const bitmap = await createImageBitmap(file);
  const tex = device.createTexture({
    size: [bitmap.width, bitmap.height], format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: tex }, [bitmap.width, bitmap.height]);
  obj.gpuTexture?.destroy();
  obj.gpuTexture = tex;
  obj.textureName = file.name;
  obj.textureBindGroup = device.createBindGroup({ layout: textureBGL, entries: [
    { binding: 0, resource: defaultSampler },
    { binding: 1, resource: tex.createView() },
  ]});
}

/* ───────── Interaction ───────── */
let dragging = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener("mousedown", e => { 
  if (e.button === 0) {
    dragging = true; 
    lastX = e.clientX; 
    lastY = e.clientY; 
  }
});
addEventListener("mouseup", () => { dragging = false; });
canvas.addEventListener("mousemove", e => {
  if (!dragging) return;
  const sel = scene.getSelected();
  if (sel) {
    sel.rotation[1] += e.movementX * 0.01;
    sel.rotation[0] += e.movementY * 0.01;
  } else {
    camera.rotate(lastX, lastY, e.clientX, e.clientY);
  }
  lastX = e.clientX;
  lastY = e.clientY;
});
canvas.addEventListener("wheel", e => { e.preventDefault(); camera.zoom(e.deltaY); }, { passive: false });

/* ───────── Helpers ───────── */
function hexRgb(hex: string): [number,number,number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

function buildModelMatrix(obj: SceneObject): Float32Array {
  const T = mat4.translation(obj.position[0], obj.position[1], obj.position[2]);
  const Rx = mat4.rotationX(obj.rotation[0]);
  const Ry = mat4.rotationY(obj.rotation[1]);
  const Rz = mat4.rotationZ(obj.rotation[2]);
  const S = mat4.scaling(obj.scale[0], obj.scale[1], obj.scale[2]);
  return mat4.multiply(T, mat4.multiply(mat4.multiply(Ry, mat4.multiply(Rx, Rz)), S));
}

/* ───────── GUI init ───────── */
initGUI(scene, (obj, file) => loadTextureForObject(obj, file));

// Add a default cube so the scene isn't empty
scene.addObject("cube", "Cube");

/* ───────── Render loop ───────── */
const t0 = performance.now();
const renderModeMap: Record<RenderMode, number> = { solid: 0, wireframe: 1, uvdebug: 2, normals: 0 };
const lightTypeMap: Record<LightType, number> = { point: 0, directional: 1, spot: 2 };

function frame(now: number) {
  const t = (now - t0) / 1000;
  const aspect = canvas.width / canvas.height;
  const proj = mat4.perspective((60 * Math.PI) / 180, aspect, 0.1, 100);
  const view = camera.getViewMatrix();
  const camPos = camera.getPosition();

  let lx = guiState.lightX, ly = guiState.lightY, lz = guiState.lightZ;
  if (guiState.autoRotLight) { lx = Math.cos(t * 0.8) * 4.5; lz = Math.sin(t * 0.8) * 4.5; }

  const [lr, lg, lb] = hexRgb(guiState.lightColor);

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1 }, loadOp: "clear", storeOp: "store" }],
    depthStencilAttachment: { view: depthTex!.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" },
  });

  for (const obj of scene.objects) {
    if (!obj.visible) continue;
    ensureGPUBuffers(obj);
    if (!obj.vertexBuffer) continue;

    const model = buildModelMatrix(obj);
    const normM = mat4.normalMatrix(model);
    const mvp   = mat4.multiply(mat4.multiply(proj, view), model);
    const [or, og, ob] = hexRgb(obj.color);
    const isSel = obj.id === scene.selectedId ? 1 : 0;
    const rm = renderModeMap[guiState.renderMode];
    const lt = lightTypeMap[guiState.lightType];
    const hasTex = obj.textureBindGroup ? 1 : 0;

    uF.set(mvp, 0);
    uF.set(model, 16);
    uF.set(normM, 32);
    uF[48] = lx; uF[49] = ly; uF[50] = lz; uF[51] = 0;
    uF[52] = lr; uF[53] = lg; uF[54] = lb; uF[55] = 0;
    uF[56] = guiState.ambient; uF[57] = guiState.diffuse; uF[58] = guiState.specular; uF[59] = guiState.shininess;
    uF[60] = camPos[0]; uF[61] = camPos[1]; uF[62] = camPos[2];
    uU[63] = guiState.modelId;
    uF[64] = or; uF[65] = og; uF[66] = ob;
    uF[67] = t;
    uU[68] = rm; uU[69] = lt; uU[70] = hasTex; uU[71] = isSel;
    uF[72] = guiState.spotDirX; uF[73] = guiState.spotDirY; uF[74] = guiState.spotDirZ;
    uF[75] = guiState.spotCutoff;
    uF[76] = guiState.spotExp; uF[77] = 0; uF[78] = 0; uF[79] = 0;

    device.queue.writeBuffer(uniformBuffer, 0, uAB);

    pass.setPipeline(mainPipeline);
    pass.setBindGroup(0, uniformBG);
    pass.setBindGroup(1, obj.textureBindGroup || defaultTexBG);
    pass.setVertexBuffer(0, obj.vertexBuffer);
    pass.draw(obj.vertexCount);

    // Normal lines
    if (guiState.renderMode === "normals" && obj.normalLineBuffer) {
      // Re-write uniforms with renderMode=0 for lines (solid color)
      uU[68] = 0;
      device.queue.writeBuffer(uniformBuffer, 0, uAB);
      pass.setPipeline(linePipeline);
      pass.setBindGroup(0, uniformBG);
      pass.setVertexBuffer(0, obj.normalLineBuffer);
      pass.draw(obj.normalLineCount);
    }
  }

  pass.end();
  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
