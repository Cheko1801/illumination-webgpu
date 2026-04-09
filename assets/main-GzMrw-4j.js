(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const l of i)if(l.type==="childList")for(const s of l.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function r(i){const l={};return i.integrity&&(l.integrity=i.integrity),i.referrerPolicy&&(l.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?l.credentials="include":i.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function n(i){if(i.ep)return;i.ep=!0;const l=r(i);fetch(i.href,l)}})();const at=`// shader.wgsl — Full lighting + textures + wireframe + UV debug
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
`,M={add(t,e){return[t[0]+e[0],t[1]+e[1],t[2]+e[2]]},sub(t,e){return[t[0]-e[0],t[1]-e[1],t[2]-e[2]]},scale(t,e){return[t[0]*e,t[1]*e,t[2]*e]},dot(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]},cross(t,e){return[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]]},normalize(t){const e=Math.hypot(t[0],t[1],t[2])||1;return[t[0]/e,t[1]/e,t[2]/e]}},x={identity(){const t=new Float32Array(16);return t[0]=1,t[5]=1,t[10]=1,t[15]=1,t},multiply(t,e){const r=new Float32Array(16);for(let n=0;n<4;n++)for(let i=0;i<4;i++)r[n*4+i]=t[0+i]*e[n*4+0]+t[4+i]*e[n*4+1]+t[8+i]*e[n*4+2]+t[12+i]*e[n*4+3];return r},transpose(t){const e=new Float32Array(16);for(let r=0;r<4;r++)for(let n=0;n<4;n++)e[n*4+r]=t[r*4+n];return e},invert(t){const e=new Float32Array(16),r=t[0],n=t[1],i=t[2],l=t[3],s=t[4],h=t[5],f=t[6],o=t[7],a=t[8],c=t[9],p=t[10],u=t[11],g=t[12],b=t[13],C=t[14],P=t[15],w=r*h-n*s,E=r*f-i*s,B=r*o-l*s,N=n*f-i*h,I=n*o-l*h,T=i*o-l*f,D=a*b-c*g,G=a*C-p*g,z=a*P-u*g,F=c*C-p*b,U=c*P-u*b,O=p*P-u*C;let L=w*O-E*U+B*F+N*z-I*G+T*D;return L?(L=1/L,e[0]=(h*O-f*U+o*F)*L,e[1]=(f*z-s*O-o*G)*L,e[2]=(s*U-h*z+o*D)*L,e[3]=(h*G-s*F-f*D)*L,e[4]=(i*U-n*O-l*F)*L,e[5]=(r*O-i*z+l*G)*L,e[6]=(n*z-r*U-l*D)*L,e[7]=(r*F-n*G+i*D)*L,e[8]=(b*T-C*I+P*N)*L,e[9]=(C*B-g*T-P*E)*L,e[10]=(g*I-b*B+P*w)*L,e[11]=(b*E-g*N-C*w)*L,e[12]=(p*I-c*T-u*N)*L,e[13]=(a*T-p*B+u*E)*L,e[14]=(c*B-a*I-u*w)*L,e[15]=(a*N-c*E+p*w)*L,e):x.identity()},normalMatrix(t){return x.transpose(x.invert(t))},translation(t,e,r){const n=x.identity();return n[12]=t,n[13]=e,n[14]=r,n},scaling(t,e,r){const n=x.identity();return n[0]=t,n[5]=e,n[10]=r,n},rotationX(t){const e=Math.cos(t),r=Math.sin(t),n=x.identity();return n[5]=e,n[6]=r,n[9]=-r,n[10]=e,n},rotationY(t){const e=Math.cos(t),r=Math.sin(t),n=x.identity();return n[0]=e,n[2]=-r,n[8]=r,n[10]=e,n},rotationZ(t){const e=Math.cos(t),r=Math.sin(t),n=x.identity();return n[0]=e,n[1]=r,n[4]=-r,n[5]=e,n},perspective(t,e,r,n){const i=1/Math.tan(t/2),l=new Float32Array(16);return l[0]=i/e,l[5]=i,l[10]=n/(r-n),l[11]=-1,l[14]=n*r/(r-n),l},lookAt(t,e,r){const n=M.normalize(M.sub(t,e)),i=M.normalize(M.cross(r,n)),l=M.cross(n,i),s=new Float32Array(16);return s[0]=i[0],s[4]=i[1],s[8]=i[2],s[12]=-M.dot(i,t),s[1]=l[0],s[5]=l[1],s[9]=l[2],s[13]=-M.dot(l,t),s[2]=n[0],s[6]=n[1],s[10]=n[2],s[14]=-M.dot(n,t),s[3]=0,s[7]=0,s[11]=0,s[15]=1,s}};class lt{rotX=.2;rotY=0;distance=5;target=[0,0,0];zoomMin=1.5;zoomMax=30;getPosition(){const e=Math.cos(this.rotX),r=Math.sin(this.rotX),n=Math.cos(this.rotY),i=Math.sin(this.rotY);return[this.target[0]+this.distance*e*i,this.target[1]+this.distance*r,this.target[2]+this.distance*e*n]}getViewMatrix(){const e=this.getPosition();return x.lookAt(e,this.target,[0,1,0])}rotate(e,r){this.rotY+=e*.008,this.rotX+=r*.008;const n=Math.PI/2-.01;this.rotX=Math.max(-n,Math.min(n,this.rotX))}zoom(e){this.distance*=1+e*.001,this.distance=Math.max(this.zoomMin,Math.min(this.zoomMax,this.distance))}}function k(){const t=[{n:[0,0,1],verts:[[-1,-1,1,0,1],[1,-1,1,1,1],[1,1,1,1,0],[-1,-1,1,0,1],[1,1,1,1,0],[-1,1,1,0,0]]},{n:[0,0,-1],verts:[[1,-1,-1,0,1],[-1,-1,-1,1,1],[-1,1,-1,1,0],[1,-1,-1,0,1],[-1,1,-1,1,0],[1,1,-1,0,0]]},{n:[-1,0,0],verts:[[-1,-1,-1,0,1],[-1,-1,1,1,1],[-1,1,1,1,0],[-1,-1,-1,0,1],[-1,1,1,1,0],[-1,1,-1,0,0]]},{n:[1,0,0],verts:[[1,-1,1,0,1],[1,-1,-1,1,1],[1,1,-1,1,0],[1,-1,1,0,1],[1,1,-1,1,0],[1,1,1,0,0]]},{n:[0,1,0],verts:[[-1,1,1,0,1],[1,1,1,1,1],[1,1,-1,1,0],[-1,1,1,0,1],[1,1,-1,1,0],[-1,1,-1,0,0]]},{n:[0,-1,0],verts:[[-1,-1,-1,0,1],[1,-1,-1,1,1],[1,-1,1,1,0],[-1,-1,-1,0,1],[1,-1,1,1,0],[-1,-1,1,0,0]]}],e=[];for(const r of t)for(const n of r.verts)e.push(n[0],n[1],n[2]),e.push(...r.n),e.push(n[3],n[4]);return new Float32Array(e)}function ct(t,e){const r=[];for(let n=0;n<t;n++)for(let i=0;i<e;i++){const l=Math.PI*n/t,s=Math.PI*(n+1)/t,h=2*Math.PI*i/e,f=2*Math.PI*(i+1)/e,o=X(l,h,n,i,t,e),a=X(s,h,n+1,i,t,e),c=X(s,f,n+1,i+1,t,e),p=X(l,f,n,i+1,t,e);r.push(...o,...a,...c),r.push(...o,...c,...p)}return new Float32Array(r)}function X(t,e,r,n,i,l){const s=Math.sin(t)*Math.cos(e),h=Math.cos(t),f=Math.sin(t)*Math.sin(e),o=n/l,a=r/i;return[s,h,f,s,h,f,o,a]}function ut(t,e=.15){const n=t.length/8/3,i=[];for(let l=0;l<n;l++){const s=l*3*8,h=(t[s]+t[s+8]+t[s+16])/3,f=(t[s+1]+t[s+8+1]+t[s+16+1])/3,o=(t[s+2]+t[s+8+2]+t[s+16+2])/3,a=t[s+8]-t[s],c=t[s+8+1]-t[s+1],p=t[s+8+2]-t[s+2],u=t[s+16]-t[s],g=t[s+16+1]-t[s+1],b=t[s+16+2]-t[s+2];let C=c*b-p*g,P=p*u-a*b,w=a*g-c*u;const E=Math.hypot(C,P,w)||1;C/=E,P/=E,w/=E,i.push(h,f,o,1,1,0),i.push(h+C*e,f+P*e,o+w*e,0,1,1)}return new Float32Array(i)}function dt(t){const e=[],r=[],n=[],i=[],l=t.split(`
`);for(const h of l){const f=h.trim();if(f===""||f.startsWith("#"))continue;const o=f.split(/\s+/),a=o[0];if(a==="v")e.push([parseFloat(o[1]),parseFloat(o[2]),parseFloat(o[3])]);else if(a==="vn")r.push([parseFloat(o[1]),parseFloat(o[2]),parseFloat(o[3])]);else if(a==="vt")n.push([parseFloat(o[1]),parseFloat(o[2])||0]);else if(a==="f"){const c=[];for(let p=1;p<o.length;p++){const u=o[p].split("/"),g=parseInt(u[0])-1,b=u.length>1&&u[1]!==""?parseInt(u[1])-1:-1,C=u.length>2&&u[2]!==""?parseInt(u[2])-1:-1,P=e[g]||[0,0,0],w=b>=0&&n[b]?n[b]:[0,0],E=C>=0&&r[C]?r[C]:[0,0,0];c.push([...P,...E,...w])}for(let p=1;p<c.length-1;p++)i.push(...c[0],...c[p],...c[p+1])}}const s=new Float32Array(i);return r.length===0&&ft(s),s}function ft(t){const r=t.length/8/3;for(let n=0;n<r;n++){const i=n*3*8,l=t[i+8]-t[i],s=t[i+8+1]-t[i+1],h=t[i+8+2]-t[i+2],f=t[i+16]-t[i],o=t[i+16+1]-t[i+1],a=t[i+16+2]-t[i+2];let c=s*a-h*o,p=h*f-l*a,u=l*o-s*f;const g=Math.hypot(c,p,u)||1;c/=g,p/=g,u/=g;for(let b=0;b<3;b++)t[i+b*8+3]=c,t[i+b*8+4]=p,t[i+b*8+5]=u}}let K=0;class pt{objects=[];selectedId=null;addObject(e,r,n){let i;e==="cube"?i=k():e==="sphere"?i=ct(48,48):e==="obj"&&n?i=dt(n):i=k();const l=ut(i),s=this.objects.length,h=2.5,f=4,o=s%f*h-(f-1)*h/2,a=Math.floor(s/f)*h,c={id:K++,name:r||`${e}_${K-1}`,geometryType:e,position:[o,0,a],rotation:[0,0,0],scale:[1,1,1],color:"#4a9eff",vertexData:i,vertexBuffer:null,vertexCount:i.length/8,normalLineData:l,normalLineBuffer:null,normalLineCount:l.length/6,textureImage:null,gpuTexture:null,textureBindGroup:null,textureName:"",visible:!0};return this.objects.push(c),c}removeObject(e){const r=this.objects.findIndex(i=>i.id===e);if(r<0)return;const n=this.objects[r];n.vertexBuffer?.destroy(),n.normalLineBuffer?.destroy(),n.gpuTexture?.destroy(),this.objects.splice(r,1),this.selectedId===e&&(this.selectedId=null)}selectObject(e){this.selectedId=e}deselectAll(){this.selectedId=null}getSelected(){return this.selectedId===null?null:this.objects.find(e=>e.id===this.selectedId)||null}}const d={modelId:0,ambient:.12,diffuse:.75,specular:.6,shininess:32,lightX:3,lightY:4,lightZ:3,autoRotLight:!0,lightColor:"#ffffff",renderMode:"solid",lightType:"point",spotDirX:0,spotDirY:-1,spotDirZ:0,spotCutoff:.9,spotExp:16};function y(t,e,r,n,i,l){return`<div class="sl-row"><span class="sl-lbl">${e}</span><input type="range" id="${t}" min="${r}" max="${n}" step="${i}" value="${l}"><span class="sl-val" id="${t}-val">${l}</span></div>`}function mt(t,e){const r=document.createElement("div");r.id="gui",r.innerHTML=`
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
    ${y("posX","Pos X",-10,10,.1,0)} ${y("posY","Pos Y",-10,10,.1,0)} ${y("posZ","Pos Z",-10,10,.1,0)}
    ${y("rotX","Rot X",-3.14,3.14,.05,0)} ${y("rotY","Rot Y",-3.14,3.14,.05,0)} ${y("rotZ","Rot Z",-3.14,3.14,.05,0)}
    ${y("scX","Scale X",.1,5,.1,1)} ${y("scY","Scale Y",.1,5,.1,1)} ${y("scZ","Scale Z",.1,5,.1,1)}
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
    ${y("ambient","Ka",0,1,.01,d.ambient)}
    ${y("diffuse","Kd",0,1,.01,d.diffuse)}
    ${y("specular","Ks",0,1,.01,d.specular)}
    ${y("shininess","Shin",1,256,1,d.shininess)}
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
    ${y("lightX","X",-8,8,.1,d.lightX)}
    ${y("lightY","Y",-8,8,.1,d.lightY)}
    ${y("lightZ","Z",-8,8,.1,d.lightZ)}
    <label class="cb-row"><input type="checkbox" id="autoRot" checked> Auto-rotate</label>
  </div>
  <div id="spotPanel" class="gui-section" style="display:none">
    <div class="gui-label">Spot Direction</div>
    ${y("spotDX","Dir X",-1,1,.05,0)}
    ${y("spotDY","Dir Y",-1,1,.05,-1)}
    ${y("spotDZ","Dir Z",-1,1,.05,0)}
    ${y("spotCut","Cutoff",0,1,.01,.9)}
    ${y("spotE","Exponent",1,64,1,16)}
  </div>
  <div class="gui-section">
    <div class="gui-label">Colors</div>
    <div class="color-row"><span>Light</span><input type="color" id="lightColor" value="#ffffff"></div>
  </div>
  <div class="gui-hint">🖱 Drag = rotate • Scroll = zoom</div>
</div>`,document.body.appendChild(r);const n=document.getElementById("objList");function i(){n.innerHTML="";for(const a of t.objects){const c=document.createElement("div");c.className="obj-item"+(a.id===t.selectedId?" selected":""),c.textContent=a.name,c.addEventListener("click",()=>{t.selectObject(a.id),i(),l()}),n.appendChild(c)}const o=document.getElementById("transformPanel");o.style.display=t.getSelected()?"":"none"}function l(){const o=t.getSelected();o&&(s("posX",o.position[0]),s("posY",o.position[1]),s("posZ",o.position[2]),s("rotX",o.rotation[0]),s("rotY",o.rotation[1]),s("rotZ",o.rotation[2]),s("scX",o.scale[0]),s("scY",o.scale[1]),s("scZ",o.scale[2]),document.getElementById("objColor").value=o.color,document.getElementById("texName").textContent=o.textureName||"None")}function s(o,a){const c=document.getElementById(o);c.value=String(a),document.getElementById(o+"-val").textContent=a.toFixed(2)}document.getElementById("addCube").addEventListener("click",()=>{t.addObject("cube",`Cube_${t.objects.length}`),i()}),document.getElementById("addSphere").addEventListener("click",()=>{t.addObject("sphere",`Sphere_${t.objects.length}`),i()}),document.getElementById("objFile").addEventListener("change",async o=>{const a=o.target.files?.[0];if(!a)return;const c=await a.text();t.addObject("obj",a.name.replace(".obj",""),c),i()}),document.getElementById("btnDeselect").addEventListener("click",()=>{t.deselectAll(),i()}),document.getElementById("btnDelete").addEventListener("click",()=>{const o=t.getSelected();o&&(t.removeObject(o.id),i())});const h=[["posX",(o,a)=>o.position[0]=a],["posY",(o,a)=>o.position[1]=a],["posZ",(o,a)=>o.position[2]=a],["rotX",(o,a)=>o.rotation[0]=a],["rotY",(o,a)=>o.rotation[1]=a],["rotZ",(o,a)=>o.rotation[2]=a],["scX",(o,a)=>o.scale[0]=a],["scY",(o,a)=>o.scale[1]=a],["scZ",(o,a)=>o.scale[2]=a]];for(const[o,a]of h){const c=document.getElementById(o);c.addEventListener("input",()=>{const p=t.getSelected();if(!p)return;const u=parseFloat(c.value);a(p,u),document.getElementById(o+"-val").textContent=u.toFixed(2)})}document.getElementById("objColor").addEventListener("input",o=>{const a=t.getSelected();a&&(a.color=o.target.value)}),document.getElementById("texFile").addEventListener("change",async o=>{const a=o.target.files?.[0],c=t.getSelected();!a||!c||(await e(c,a),document.getElementById("texName").textContent=c.textureName)}),document.querySelectorAll(".model-btn").forEach(o=>{o.addEventListener("click",()=>{d.modelId=Number(o.dataset.id),document.querySelectorAll(".model-btn").forEach(a=>a.classList.remove("active")),o.classList.add("active")})}),document.querySelectorAll(".rm-btn").forEach(o=>{o.addEventListener("click",()=>{d.renderMode=o.dataset.rm,document.querySelectorAll(".rm-btn").forEach(a=>a.classList.remove("active")),o.classList.add("active")})}),document.querySelectorAll(".lt-btn").forEach(o=>{o.addEventListener("click",()=>{d.lightType=o.dataset.lt,document.querySelectorAll(".lt-btn").forEach(a=>a.classList.remove("active")),o.classList.add("active"),document.getElementById("spotPanel").style.display=d.lightType==="spot"?"":"none"})});const f=[["ambient","ambient"],["diffuse","diffuse"],["specular","specular"],["shininess","shininess"],["lightX","lightX"],["lightY","lightY"],["lightZ","lightZ"],["spotDX","spotDirX"],["spotDY","spotDirY"],["spotDZ","spotDirZ"],["spotCut","spotCutoff"],["spotE","spotExp"]];for(const[o,a]of f){const c=document.getElementById(o);c&&c.addEventListener("input",()=>{d[a]=parseFloat(c.value),document.getElementById(o+"-val").textContent=c.value})}document.getElementById("autoRot").addEventListener("change",o=>{d.autoRotLight=o.target.checked}),document.getElementById("lightColor").addEventListener("input",o=>{d.lightColor=o.target.value}),i()}if(!navigator.gpu)throw new Error("WebGPU not supported");const S=document.querySelector("#gfx-main");if(!S)throw new Error("Canvas #gfx-main not found");const tt=await navigator.gpu.requestAdapter();if(!tt)throw new Error("No GPU adapter");const v=await tt.requestDevice(),et=S.getContext("webgpu"),j=navigator.gpu.getPreferredCanvasFormat();let $=null;function nt(){S.width=Math.max(1,Math.floor(innerWidth*devicePixelRatio)),S.height=Math.max(1,Math.floor(innerHeight*devicePixelRatio)),et.configure({device:v,format:j,alphaMode:"premultiplied"}),$?.destroy(),$=v.createTexture({size:[S.width,S.height],format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT})}nt();addEventListener("resize",nt);const W=v.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),q=v.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{}}]}),ot=320,Z=v.createBuffer({size:ot,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),R=new ArrayBuffer(ot),m=new Float32Array(R),A=new Uint32Array(R),J=v.createBindGroup({layout:W,entries:[{binding:0,resource:{buffer:Z}}]}),Y=v.createShaderModule({label:"main",code:at}),gt=v.createRenderPipeline({label:"main-tri",layout:v.createPipelineLayout({bindGroupLayouts:[W,q]}),vertex:{module:Y,entryPoint:"vs_main",buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}]},fragment:{module:Y,entryPoint:"fs_main",targets:[{format:j}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"}}),ht=v.createRenderPipeline({label:"lines",layout:v.createPipelineLayout({bindGroupLayouts:[W]}),vertex:{module:Y,entryPoint:"vs_lines",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}]},fragment:{module:Y,entryPoint:"fs_lines",targets:[{format:j}]},primitive:{topology:"line-list"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"}}),it=v.createTexture({size:[1,1],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});v.queue.writeTexture({texture:it},new Uint8Array([255,255,255,255]),{bytesPerRow:4},[1,1]);const rt=v.createSampler({minFilter:"linear",magFilter:"linear"}),vt=v.createBindGroup({layout:q,entries:[{binding:0,resource:rt},{binding:1,resource:it.createView()}]}),V=new pt;function bt(t){if(!t.vertexBuffer){const e=v.createBuffer({size:t.vertexData.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});v.queue.writeBuffer(e,0,t.vertexData),t.vertexBuffer=e,t.vertexCount=t.vertexData.length/8}if(!t.normalLineBuffer&&t.normalLineData&&t.normalLineData.length>0){const e=v.createBuffer({size:t.normalLineData.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});v.queue.writeBuffer(e,0,t.normalLineData),t.normalLineBuffer=e,t.normalLineCount=t.normalLineData.length/6}}async function xt(t,e){const r=await createImageBitmap(e),n=v.createTexture({size:[r.width,r.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});v.queue.copyExternalImageToTexture({source:r},{texture:n},[r.width,r.height]),t.gpuTexture?.destroy(),t.gpuTexture=n,t.textureName=e.name,t.textureBindGroup=v.createBindGroup({layout:q,entries:[{binding:0,resource:rt},{binding:1,resource:n.createView()}]})}const _=new lt;let H=!1;S.addEventListener("mousedown",t=>{t.button===0&&(H=!0)});addEventListener("mouseup",()=>{H=!1});S.addEventListener("mousemove",t=>{if(!H)return;const e=V.getSelected();e?(e.rotation[1]+=t.movementX*.01,e.rotation[0]+=t.movementY*.01):_.rotate(t.movementX,t.movementY)});S.addEventListener("wheel",t=>{t.preventDefault(),_.zoom(t.deltaY)},{passive:!1});function Q(t){const e=parseInt(t.slice(1),16);return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]}function yt(t){const e=x.translation(t.position[0],t.position[1],t.position[2]),r=x.rotationX(t.rotation[0]),n=x.rotationY(t.rotation[1]),i=x.rotationZ(t.rotation[2]),l=x.scaling(t.scale[0],t.scale[1],t.scale[2]);return x.multiply(e,x.multiply(x.multiply(n,x.multiply(r,i)),l))}mt(V,(t,e)=>xt(t,e));V.addObject("cube","Cube");const Lt=performance.now(),Ct={solid:0,wireframe:1,uvdebug:2,normals:0},Pt={point:0,directional:1,spot:2};function st(t){const e=(t-Lt)/1e3,r=S.width/S.height,n=x.perspective(60*Math.PI/180,r,.1,100),i=_.getViewMatrix(),l=_.getPosition();let s=d.lightX,h=d.lightY,f=d.lightZ;d.autoRotLight&&(s=Math.cos(e*.8)*4.5,f=Math.sin(e*.8)*4.5);const[o,a,c]=Q(d.lightColor),p=v.createCommandEncoder(),u=p.beginRenderPass({colorAttachments:[{view:et.getCurrentTexture().createView(),clearValue:{r:.05,g:.05,b:.08,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:$.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});for(const g of V.objects){if(!g.visible||(bt(g),!g.vertexBuffer))continue;const b=yt(g),C=x.normalMatrix(b),P=x.multiply(x.multiply(n,i),b),[w,E,B]=Q(g.color),N=g.id===V.selectedId?1:0,I=Ct[d.renderMode],T=Pt[d.lightType],D=g.textureBindGroup?1:0;m.set(P,0),m.set(b,16),m.set(C,32),m[48]=s,m[49]=h,m[50]=f,m[51]=0,m[52]=o,m[53]=a,m[54]=c,m[55]=0,m[56]=d.ambient,m[57]=d.diffuse,m[58]=d.specular,m[59]=d.shininess,m[60]=l[0],m[61]=l[1],m[62]=l[2],A[63]=d.modelId,m[64]=w,m[65]=E,m[66]=B,m[67]=e,A[68]=I,A[69]=T,A[70]=D,A[71]=N,m[72]=d.spotDirX,m[73]=d.spotDirY,m[74]=d.spotDirZ,m[75]=d.spotCutoff,m[76]=d.spotExp,m[77]=0,m[78]=0,m[79]=0,v.queue.writeBuffer(Z,0,R),u.setPipeline(gt),u.setBindGroup(0,J),u.setBindGroup(1,g.textureBindGroup||vt),u.setVertexBuffer(0,g.vertexBuffer),u.draw(g.vertexCount),d.renderMode==="normals"&&g.normalLineBuffer&&(A[68]=0,v.queue.writeBuffer(Z,0,R),u.setPipeline(ht),u.setBindGroup(0,J),u.setVertexBuffer(0,g.normalLineBuffer),u.draw(g.normalLineCount))}u.end(),v.queue.submit([p.finish()]),requestAnimationFrame(st)}requestAnimationFrame(st);
