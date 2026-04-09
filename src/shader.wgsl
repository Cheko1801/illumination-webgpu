// shader.wgsl — Full lighting + textures + wireframe + UV debug
//
// model_id: 0=Flat, 1=Gouraud, 2=Phong, 3=Blinn-Phong
// renderMode: 0=solid, 1=wireframe, 2=uv_debug
// lightType: 0=point, 1=directional, 2=spotlight

struct Uniforms {
  mvp        : mat4x4<f32>,
  model      : mat4x4<f32>,
  normalMat  : mat4x4<f32>,
  lightPos   : vec3<f32>,  _p0 : f32,
  lightColor : vec3<f32>,  _p1 : f32,
  ambient    : f32,
  diffuse    : f32,
  specular   : f32,
  shininess  : f32,
  camPos     : vec3<f32>,
  model_id   : u32,
  objectColor: vec3<f32>,
  time       : f32,
  renderMode : u32,
  lightType  : u32,
  useTexture : u32,
  selected   : u32,
  spotDir    : vec3<f32>,
  spotCutoff : f32,
  spotExp    : f32,
  _p2 : f32, _p3 : f32, _p4 : f32,
};

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(1) @binding(0) var texSampler : sampler;
@group(1) @binding(1) var texMap     : texture_2d<f32>;

// ── I/O structs ──
struct VSIn {
  @location(0) position : vec3<f32>,
  @location(1) normal   : vec3<f32>,
  @location(2) uv       : vec2<f32>,
  @builtin(vertex_index) vi : u32,
};

struct VSOut {
  @builtin(position) clipPos   : vec4<f32>,
  @location(0) worldPos        : vec3<f32>,
  @location(1) worldNormal     : vec3<f32>,
  @location(2) uv              : vec2<f32>,
  @location(3) gouraudColor    : vec3<f32>,
  @location(4) bary            : vec3<f32>,
};

// ── Light helpers ──
fn getLightDir(p: vec3<f32>) -> vec3<f32> {
  if u.lightType == 1u { return normalize(-u.spotDir); }
  return normalize(u.lightPos - p);
}

fn getAtten(L: vec3<f32>) -> f32 {
  if u.lightType == 2u {
    let d = normalize(u.spotDir);
    let c = dot(-L, d);
    if c < u.spotCutoff { return 0.0; }
    return pow(c, u.spotExp);
  }
  return 1.0;
}

// ── Flat shading (reference — fragment stage) ──
fn flatShading(fragWorldPos: vec3<f32>, baseColor: vec3<f32>) -> vec3<f32> {
  let dx    = dpdx(fragWorldPos);
  let dy    = dpdy(fragWorldPos);
  let faceN = normalize(cross(dx, dy));
  let L = getLightDir(fragWorldPos);
  let V = normalize(u.camPos - fragWorldPos);
  let atten = getAtten(L);
  let ambientC = u.ambient * u.lightColor;
  let NdotL    = max(dot(faceN, L), 0.0);
  let diffuseC = u.diffuse * NdotL * u.lightColor * atten;
  var specularC = vec3<f32>(0.0);
  if NdotL > 0.0 {
    let R = reflect(-L, faceN);
    specularC = u.specular * pow(max(dot(R, V), 0.0), u.shininess) * u.lightColor * atten;
  }
  return (ambientC + diffuseC + specularC) * baseColor;
}

// ── Gouraud shading (per vertex) ──
fn gouraudLighting(N: vec3<f32>, vertWorldPos: vec3<f32>) -> vec3<f32> {
  let L = getLightDir(vertWorldPos);
  let V = normalize(u.camPos - vertWorldPos);
  let atten = getAtten(L);
  let ambientC = u.ambient * u.lightColor;
  let NdotL    = max(dot(N, L), 0.0);
  let diffuseC = u.diffuse * NdotL * u.lightColor * atten;
  var specularC = vec3<f32>(0.0);
  if NdotL > 0.0 {
    let R = reflect(-L, N);
    specularC = u.specular * pow(max(dot(R, V), 0.0), u.shininess) * u.lightColor * atten;
  }
  return (ambientC + diffuseC + specularC) * u.objectColor;
}

// ── Phong shading (per fragment) ──
fn phongLighting(N: vec3<f32>, fragWorldPos: vec3<f32>, baseColor: vec3<f32>) -> vec3<f32> {
  let L = getLightDir(fragWorldPos);
  let V = normalize(u.camPos - fragWorldPos);
  let atten = getAtten(L);
  let ambientC = u.ambient * u.lightColor;
  let NdotL    = max(dot(N, L), 0.0);
  let diffuseC = u.diffuse * NdotL * u.lightColor * atten;
  var specularC = vec3<f32>(0.0);
  if NdotL > 0.0 {
    let R = reflect(-L, N);
    specularC = u.specular * pow(max(dot(R, V), 0.0), u.shininess) * u.lightColor * atten;
  }
  return (ambientC + diffuseC + specularC) * baseColor;
}

// ── Blinn-Phong shading (per fragment) ──
fn blinnPhongLighting(N: vec3<f32>, fragWorldPos: vec3<f32>, baseColor: vec3<f32>) -> vec3<f32> {
  let L = getLightDir(fragWorldPos);
  let V = normalize(u.camPos - fragWorldPos);
  let atten = getAtten(L);
  let ambientC = u.ambient * u.lightColor;
  let NdotL    = max(dot(N, L), 0.0);
  let diffuseC = u.diffuse * NdotL * u.lightColor * atten;
  var specularC = vec3<f32>(0.0);
  if NdotL > 0.0 {
    let H = normalize(L + V);
    specularC = u.specular * pow(max(dot(N, H), 0.0), u.shininess) * u.lightColor * atten;
  }
  return (ambientC + diffuseC + specularC) * baseColor;
}

// ── Vertex shader ──
@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  let worldPos4    = u.model    * vec4<f32>(input.position, 1.0);
  let worldNormal4 = u.normalMat * vec4<f32>(input.normal, 0.0);
  out.clipPos     = u.mvp * vec4<f32>(input.position, 1.0);
  out.worldPos    = worldPos4.xyz;
  out.worldNormal = normalize(worldNormal4.xyz);
  out.uv          = input.uv;

  // Barycentric coords for wireframe
  let bi = input.vi % 3u;
  if bi == 0u      { out.bary = vec3<f32>(1.0, 0.0, 0.0); }
  else if bi == 1u { out.bary = vec3<f32>(0.0, 1.0, 0.0); }
  else             { out.bary = vec3<f32>(0.0, 0.0, 1.0); }

  if u.model_id == 1u {
    out.gouraudColor = gouraudLighting(out.worldNormal, out.worldPos);
  } else {
    out.gouraudColor = vec3<f32>(0.0);
  }
  return out;
}

// ── Fragment shader ──
@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  // ── Wireframe mode ──
  if u.renderMode == 1u {
    let d  = min(min(input.bary.x, input.bary.y), input.bary.z);
    let fw = fwidth(d);
    let edge = 1.0 - smoothstep(fw * 0.5, fw * 1.5, d);
    let bg   = vec3<f32>(0.06, 0.06, 0.1);
    let wire = vec3<f32>(0.3, 0.75, 1.0);
    return vec4<f32>(mix(bg, wire, edge), 1.0);
  }

  // ── UV debug mode ──
  if u.renderMode == 2u {
    let t = (input.uv.x + input.uv.y) * 0.5;
    let c = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), t);
    return vec4<f32>(c, 1.0);
  }

  // ── Solid lighting ──
  var baseColor = u.objectColor;
  if u.useTexture == 1u {
    baseColor = textureSample(texMap, texSampler, input.uv).rgb;
  }

  var color: vec3<f32>;
  let N = normalize(input.worldNormal);
  switch u.model_id {
    case 0u: { color = flatShading(input.worldPos, baseColor); }
    case 1u: {
      color = input.gouraudColor;
      if u.useTexture == 1u {
        color = color * textureSample(texMap, texSampler, input.uv).rgb;
      }
    }
    case 2u: { color = phongLighting(N, input.worldPos, baseColor); }
    default: { color = blinnPhongLighting(N, input.worldPos, baseColor); }
  }

  // Selection highlight
  if u.selected == 1u {
    color = color + vec3<f32>(0.06, 0.12, 0.25);
  }

  return vec4<f32>(color, 1.0);
}

// ────────────────────────────────────────────────────
// Line pipeline (for normal visualization)
// ────────────────────────────────────────────────────
struct LineVSIn {
  @location(0) position : vec3<f32>,
  @location(1) color    : vec3<f32>,
};
struct LineVSOut {
  @builtin(position) clipPos : vec4<f32>,
  @location(0) color         : vec3<f32>,
};

@vertex
fn vs_lines(input: LineVSIn) -> LineVSOut {
  var out: LineVSOut;
  out.clipPos = u.mvp * vec4<f32>(input.position, 1.0);
  out.color   = input.color;
  return out;
}

@fragment
fn fs_lines(input: LineVSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color, 1.0);
}
