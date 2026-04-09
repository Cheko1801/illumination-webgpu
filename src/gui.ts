import type { SceneManager } from "./scene";
import type { SceneObject, RenderMode, LightType } from "./types";

/* ───────── Shared state ───────── */
export const guiState = {
  modelId: 0,
  ambient: 0.12, diffuse: 0.75, specular: 0.60, shininess: 32,
  lightX: 3, lightY: 4, lightZ: 3, autoRotLight: true,
  lightColor: "#ffffff",
  renderMode: "solid" as RenderMode,
  lightType: "point" as LightType,
  spotDirX: 0, spotDirY: -1, spotDirZ: 0,
  spotCutoff: 0.9, spotExp: 16,
};

export function hexToRgb(hex: string): [number,number,number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

function sl(id: string, label: string, min: number, max: number, step: number, val: number) {
  return `<div class="sl-row"><span class="sl-lbl">${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><span class="sl-val" id="${id}-val">${val}</span></div>`;
}

/* ───────── Init ───────── */
export function initGUI(
  scene: SceneManager,
  onLoadTexture: (obj: SceneObject, file: File) => void,
) {
  const gui = document.createElement("div");
  gui.id = "gui";
  gui.innerHTML = `
<div class="gui-panel left-panel" id="left-panel">
  <div class="gui-title">🎨 Scene Objects</div>
  <div class="gui-section">
    <div class="gui-label">Add Object</div>
    <div class="add-btns">
      <button id="addCube" class="btn-sm">+ Cube</button>
      <button id="addSphere" class="btn-sm">+ Sphere</button>
      <label class="btn-sm btn-file">+ OBJ<input type="file" id="objFile" accept=".obj" hidden></label>
    </div>
  </div>
  <div class="gui-section">
    <div class="gui-label">Objects</div>
    <div id="objList" class="obj-list"></div>
    <div class="add-btns" style="margin-top:6px">
      <button id="btnDeselect" class="btn-sm">Deselect</button>
      <button id="btnDelete" class="btn-sm btn-del">Delete</button>
    </div>
  </div>
  <div id="transformPanel" class="gui-section" style="display:none">
    <div class="gui-label">Transform</div>
    ${sl("posX","Pos X",-10,10,0.1,0)} ${sl("posY","Pos Y",-10,10,0.1,0)} ${sl("posZ","Pos Z",-10,10,0.1,0)}
    ${sl("rotX","Rot X",-3.14,3.14,0.05,0)} ${sl("rotY","Rot Y",-3.14,3.14,0.05,0)} ${sl("rotZ","Rot Z",-3.14,3.14,0.05,0)}
    ${sl("scX","Scale X",0.1,5,0.1,1)} ${sl("scY","Scale Y",0.1,5,0.1,1)} ${sl("scZ","Scale Z",0.1,5,0.1,1)}
    <div class="gui-label" style="margin-top:8px">Object Color</div>
    <div class="color-row"><span>Color</span><input type="color" id="objColor" value="#4a9eff"></div>
    <div class="gui-label" style="margin-top:8px">Texture</div>
    <label class="btn-sm btn-file" style="width:100%;text-align:center">Load Texture<input type="file" id="texFile" accept="image/*" hidden></label>
    <div id="texName" class="sl-lbl" style="margin-top:4px;font-style:italic">None</div>
  </div>
</div>

<div class="gui-panel right-panel">
  <div class="gui-title">⚡ Lighting & Render</div>
  <div class="gui-section">
    <div class="gui-label">Shading Model</div>
    <div class="model-btns">
      <button class="model-btn active" data-id="0">Flat</button>
      <button class="model-btn" data-id="1">Gouraud</button>
      <button class="model-btn" data-id="2">Phong</button>
      <button class="model-btn" data-id="3">Blinn-Phong</button>
    </div>
  </div>
  <div class="gui-section">
    <div class="gui-label">Render Mode</div>
    <div class="model-btns">
      <button class="rm-btn active" data-rm="solid">Solid</button>
      <button class="rm-btn" data-rm="wireframe">Wireframe</button>
      <button class="rm-btn" data-rm="uvdebug">UV Debug</button>
      <button class="rm-btn" data-rm="normals">Normals</button>
    </div>
  </div>
  <div class="gui-section">
    <div class="gui-label">Material</div>
    ${sl("ambient","Ka",0,1,0.01,guiState.ambient)}
    ${sl("diffuse","Kd",0,1,0.01,guiState.diffuse)}
    ${sl("specular","Ks",0,1,0.01,guiState.specular)}
    ${sl("shininess","Shin",1,256,1,guiState.shininess)}
  </div>
  <div class="gui-section">
    <div class="gui-label">Light Type</div>
    <div class="model-btns">
      <button class="lt-btn active" data-lt="point">Point</button>
      <button class="lt-btn" data-lt="directional">Directional</button>
      <button class="lt-btn" data-lt="spot">Spot</button>
    </div>
  </div>
  <div class="gui-section">
    <div class="gui-label">Light Position</div>
    ${sl("lightX","X",-8,8,0.1,guiState.lightX)}
    ${sl("lightY","Y",-8,8,0.1,guiState.lightY)}
    ${sl("lightZ","Z",-8,8,0.1,guiState.lightZ)}
    <label class="cb-row"><input type="checkbox" id="autoRot" checked> Auto-rotate</label>
  </div>
  <div id="spotPanel" class="gui-section" style="display:none">
    <div class="gui-label">Spot Direction</div>
    ${sl("spotDX","Dir X",-1,1,0.05,0)}
    ${sl("spotDY","Dir Y",-1,1,0.05,-1)}
    ${sl("spotDZ","Dir Z",-1,1,0.05,0)}
    ${sl("spotCut","Cutoff",0,1,0.01,0.9)}
    ${sl("spotE","Exponent",1,64,1,16)}
  </div>
  <div class="gui-section">
    <div class="gui-label">Colors</div>
    <div class="color-row"><span>Light</span><input type="color" id="lightColor" value="#ffffff"></div>
  </div>
  <div class="gui-hint">🖱 Drag = rotate • Scroll = zoom</div>
</div>`;
  document.body.appendChild(gui);

  /* ── Object list ── */
  const listEl = document.getElementById("objList")!;
  function refreshList() {
    listEl.innerHTML = "";
    for (const o of scene.objects) {
      const d = document.createElement("div");
      d.className = "obj-item" + (o.id === scene.selectedId ? " selected" : "");
      d.textContent = o.name;
      d.addEventListener("click", () => { scene.selectObject(o.id); refreshList(); syncTransform(); });
      listEl.appendChild(d);
    }
    const tp = document.getElementById("transformPanel")!;
    tp.style.display = scene.getSelected() ? "" : "none";
  }

  function syncTransform() {
    const s = scene.getSelected();
    if (!s) return;
    setSlider("posX", s.position[0]); setSlider("posY", s.position[1]); setSlider("posZ", s.position[2]);
    setSlider("rotX", s.rotation[0]); setSlider("rotY", s.rotation[1]); setSlider("rotZ", s.rotation[2]);
    setSlider("scX", s.scale[0]); setSlider("scY", s.scale[1]); setSlider("scZ", s.scale[2]);
    (document.getElementById("objColor") as HTMLInputElement).value = s.color;
    document.getElementById("texName")!.textContent = s.textureName || "None";
  }

  function setSlider(id: string, v: number) {
    const el = document.getElementById(id) as HTMLInputElement;
    el.value = String(v);
    document.getElementById(id + "-val")!.textContent = v.toFixed(2);
  }

  /* ── Add buttons ── */
  document.getElementById("addCube")!.addEventListener("click", () => { scene.addObject("cube", `Cube_${scene.objects.length}`); refreshList(); });
  document.getElementById("addSphere")!.addEventListener("click", () => { scene.addObject("sphere", `Sphere_${scene.objects.length}`); refreshList(); });
  document.getElementById("objFile")!.addEventListener("change", async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const txt = await f.text();
    scene.addObject("obj", f.name.replace(".obj", ""), txt);
    refreshList();
  });

  document.getElementById("btnDeselect")!.addEventListener("click", () => { scene.deselectAll(); refreshList(); });
  document.getElementById("btnDelete")!.addEventListener("click", () => {
    const s = scene.getSelected();
    if (s) { scene.removeObject(s.id); refreshList(); }
  });

  /* ── Transform sliders ── */
  const tSliders: [string, (o: SceneObject, v: number) => void][] = [
    ["posX", (o,v) => o.position[0]=v], ["posY", (o,v) => o.position[1]=v], ["posZ", (o,v) => o.position[2]=v],
    ["rotX", (o,v) => o.rotation[0]=v], ["rotY", (o,v) => o.rotation[1]=v], ["rotZ", (o,v) => o.rotation[2]=v],
    ["scX",  (o,v) => o.scale[0]=v],    ["scY",  (o,v) => o.scale[1]=v],    ["scZ",  (o,v) => o.scale[2]=v],
  ];
  for (const [id, apply] of tSliders) {
    const el = document.getElementById(id) as HTMLInputElement;
    el.addEventListener("input", () => {
      const s = scene.getSelected(); if (!s) return;
      const v = parseFloat(el.value);
      apply(s, v);
      document.getElementById(id + "-val")!.textContent = v.toFixed(2);
    });
  }

  (document.getElementById("objColor") as HTMLInputElement).addEventListener("input", e => {
    const s = scene.getSelected(); if (s) s.color = (e.target as HTMLInputElement).value;
  });

  document.getElementById("texFile")!.addEventListener("change", async e => {
    const f = (e.target as HTMLInputElement).files?.[0];
    const s = scene.getSelected();
    if (!f || !s) return;
    await onLoadTexture(s, f);
    document.getElementById("texName")!.textContent = s.textureName;
  });

  /* ── Shading models ── */
  document.querySelectorAll<HTMLButtonElement>(".model-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      guiState.modelId = Number(btn.dataset.id);
      document.querySelectorAll(".model-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  /* ── Render mode ── */
  document.querySelectorAll<HTMLButtonElement>(".rm-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      guiState.renderMode = btn.dataset.rm as RenderMode;
      document.querySelectorAll(".rm-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  /* ── Light type ── */
  document.querySelectorAll<HTMLButtonElement>(".lt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      guiState.lightType = btn.dataset.lt as LightType;
      document.querySelectorAll(".lt-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("spotPanel")!.style.display = guiState.lightType === "spot" ? "" : "none";
    });
  });

  /* ── Material / Light sliders ── */
  const gSliders: [string, keyof typeof guiState][] = [
    ["ambient","ambient"],["diffuse","diffuse"],["specular","specular"],["shininess","shininess"],
    ["lightX","lightX"],["lightY","lightY"],["lightZ","lightZ"],
    ["spotDX","spotDirX"],["spotDY","spotDirY"],["spotDZ","spotDirZ"],
    ["spotCut","spotCutoff"],["spotE","spotExp"],
  ];
  for (const [id, key] of gSliders) {
    const el = document.getElementById(id) as HTMLInputElement;
    if (!el) continue;
    el.addEventListener("input", () => {
      (guiState as any)[key] = parseFloat(el.value);
      document.getElementById(id + "-val")!.textContent = el.value;
    });
  }

  (document.getElementById("autoRot") as HTMLInputElement).addEventListener("change", e => { guiState.autoRotLight = (e.target as HTMLInputElement).checked; });
  (document.getElementById("lightColor") as HTMLInputElement).addEventListener("input", e => { guiState.lightColor = (e.target as HTMLInputElement).value; });

  refreshList();
}
