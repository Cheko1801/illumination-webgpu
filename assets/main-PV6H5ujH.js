(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const l of i)if(l.type==="childList")for(const r of l.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&n(r)}).observe(document,{childList:!0,subtree:!0});function s(i){const l={};return i.integrity&&(l.integrity=i.integrity),i.referrerPolicy&&(l.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?l.credentials="include":i.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function n(i){if(i.ep)return;i.ep=!0;const l=s(i);fetch(i.href,l)}})();const ut=`// shader.wgsl — Full lighting + textures + wireframe + UV debug
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
`,M={add(t,e){return[t[0]+e[0],t[1]+e[1],t[2]+e[2]]},sub(t,e){return[t[0]-e[0],t[1]-e[1],t[2]-e[2]]},scale(t,e){return[t[0]*e,t[1]*e,t[2]*e]},dot(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]},cross(t,e){return[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]]},normalize(t){const e=Math.hypot(t[0],t[1],t[2])||1;return[t[0]/e,t[1]/e,t[2]/e]}},y={identity(){const t=new Float32Array(16);return t[0]=1,t[5]=1,t[10]=1,t[15]=1,t},multiply(t,e){const s=new Float32Array(16);for(let n=0;n<4;n++)for(let i=0;i<4;i++)s[n*4+i]=t[0+i]*e[n*4+0]+t[4+i]*e[n*4+1]+t[8+i]*e[n*4+2]+t[12+i]*e[n*4+3];return s},transpose(t){const e=new Float32Array(16);for(let s=0;s<4;s++)for(let n=0;n<4;n++)e[n*4+s]=t[s*4+n];return e},invert(t){const e=new Float32Array(16),s=t[0],n=t[1],i=t[2],l=t[3],r=t[4],u=t[5],d=t[6],o=t[7],a=t[8],c=t[9],p=t[10],f=t[11],m=t[12],v=t[13],C=t[14],x=t[15],P=s*u-n*r,E=s*d-i*r,B=s*o-l*r,T=n*d-i*u,N=n*o-l*u,z=i*o-l*d,I=a*v-c*m,G=a*C-p*m,U=a*x-f*m,O=c*C-p*v,R=c*x-f*v,V=p*x-f*C;let w=P*V-E*R+B*O+T*U-N*G+z*I;return w?(w=1/w,e[0]=(u*V-d*R+o*O)*w,e[1]=(d*U-r*V-o*G)*w,e[2]=(r*R-u*U+o*I)*w,e[3]=(u*G-r*O-d*I)*w,e[4]=(i*R-n*V-l*O)*w,e[5]=(s*V-i*U+l*G)*w,e[6]=(n*U-s*R-l*I)*w,e[7]=(s*O-n*G+i*I)*w,e[8]=(v*z-C*N+x*T)*w,e[9]=(C*B-m*z-x*E)*w,e[10]=(m*N-v*B+x*P)*w,e[11]=(v*E-m*T-C*P)*w,e[12]=(p*N-c*z-f*T)*w,e[13]=(a*z-p*B+f*E)*w,e[14]=(c*B-a*N-f*P)*w,e[15]=(a*T-c*E+p*P)*w,e):y.identity()},normalMatrix(t){return y.transpose(y.invert(t))},translation(t,e,s){const n=y.identity();return n[12]=t,n[13]=e,n[14]=s,n},scaling(t,e,s){const n=y.identity();return n[0]=t,n[5]=e,n[10]=s,n},rotationX(t){const e=Math.cos(t),s=Math.sin(t),n=y.identity();return n[5]=e,n[6]=s,n[9]=-s,n[10]=e,n},rotationY(t){const e=Math.cos(t),s=Math.sin(t),n=y.identity();return n[0]=e,n[2]=-s,n[8]=s,n[10]=e,n},rotationZ(t){const e=Math.cos(t),s=Math.sin(t),n=y.identity();return n[0]=e,n[1]=s,n[4]=-s,n[5]=e,n},perspective(t,e,s,n){const i=1/Math.tan(t/2),l=new Float32Array(16);return l[0]=i/e,l[5]=i,l[10]=n/(s-n),l[11]=-1,l[14]=n*s/(s-n),l},lookAt(t,e,s){const n=M.normalize(M.sub(t,e)),i=M.normalize(M.cross(s,n)),l=M.cross(n,i),r=new Float32Array(16);return r[0]=i[0],r[4]=i[1],r[8]=i[2],r[12]=-M.dot(i,t),r[1]=l[0],r[5]=l[1],r[9]=l[2],r[13]=-M.dot(l,t),r[2]=n[0],r[6]=n[1],r[10]=n[2],r[14]=-M.dot(n,t),r[3]=0,r[7]=0,r[11]=0,r[15]=1,r}},D={identity(){return new Float32Array([0,0,0,1])},multiply(t,e){const s=t[0],n=t[1],i=t[2],l=t[3],r=e[0],u=e[1],d=e[2],o=e[3];return new Float32Array([s*o+l*r+n*d-i*u,n*o+l*u+i*r-s*d,i*o+l*d+s*u-n*r,l*o-s*r-n*u-i*d])},setAxisAngle(t,e){const s=e*.5,n=Math.sin(s);return new Float32Array([t[0]*n,t[1]*n,t[2]*n,Math.cos(s)])},normalize(t){let e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2]+t[3]*t[3];return e>0?(e=1/Math.sqrt(e),new Float32Array([t[0]*e,t[1]*e,t[2]*e,t[3]*e])):D.identity()},toMat4(t){const e=t[0],s=t[1],n=t[2],i=t[3],l=e+e,r=s+s,u=n+n,d=e*l,o=e*r,a=e*u,c=s*r,p=s*u,f=n*u,m=i*l,v=i*r,C=i*u,x=y.identity();return x[0]=1-(c+f),x[4]=o-C,x[8]=a+v,x[1]=o+C,x[5]=1-(d+f),x[9]=p-m,x[2]=a-v,x[6]=p+m,x[10]=1-(d+c),x}};class dt{rotation=D.identity();distance=5;target=[0,0,0];zoomMin=1.5;zoomMax=30;width=800;height=600;mapToSphere(e,s){const n=Math.min(this.width,this.height)*.5,i=this.width*.5,l=this.height*.5;let r=(e-i)/n,u=-(s-l)/n;const d=r*r+u*u;let o;if(d<=1)o=Math.sqrt(1-d);else{const a=Math.sqrt(d);r/=a,u/=a,o=0}return[r,u,o]}rotate(e,s,n,i){const l=this.mapToSphere(e,s),r=this.mapToSphere(n,i),u=M.cross(l,r);if(Math.hypot(u[0],u[1],u[2])<1e-8)return;const o=Math.max(-1,Math.min(1,M.dot(l,r))),a=Math.acos(o),c=M.normalize(u),p=D.setAxisAngle(c,a);this.rotation=D.normalize(D.multiply(p,this.rotation))}getPosition(){return this.calculateTransform().pos}calculateTransform(){const e=D.toMat4(this.rotation),s=e[8]*this.distance+this.target[0],n=e[9]*this.distance+this.target[1],i=e[10]*this.distance+this.target[2],l=e[4],r=e[5],u=e[6];return{pos:[s,n,i],up:[l,r,u]}}getViewMatrix(){const e=this.calculateTransform();return y.lookAt(e.pos,this.target,e.up)}zoom(e){this.distance*=1+e*.001,this.distance=Math.max(this.zoomMin,Math.min(this.zoomMax,this.distance))}}function Q(){const t=[{n:[0,0,1],verts:[[-1,-1,1,0,1],[1,-1,1,1,1],[1,1,1,1,0],[-1,-1,1,0,1],[1,1,1,1,0],[-1,1,1,0,0]]},{n:[0,0,-1],verts:[[1,-1,-1,0,1],[-1,-1,-1,1,1],[-1,1,-1,1,0],[1,-1,-1,0,1],[-1,1,-1,1,0],[1,1,-1,0,0]]},{n:[-1,0,0],verts:[[-1,-1,-1,0,1],[-1,-1,1,1,1],[-1,1,1,1,0],[-1,-1,-1,0,1],[-1,1,1,1,0],[-1,1,-1,0,0]]},{n:[1,0,0],verts:[[1,-1,1,0,1],[1,-1,-1,1,1],[1,1,-1,1,0],[1,-1,1,0,1],[1,1,-1,1,0],[1,1,1,0,0]]},{n:[0,1,0],verts:[[-1,1,1,0,1],[1,1,1,1,1],[1,1,-1,1,0],[-1,1,1,0,1],[1,1,-1,1,0],[-1,1,-1,0,0]]},{n:[0,-1,0],verts:[[-1,-1,-1,0,1],[1,-1,-1,1,1],[1,-1,1,1,0],[-1,-1,-1,0,1],[1,-1,1,1,0],[-1,-1,1,0,0]]}],e=[];for(const s of t)for(const n of s.verts)e.push(n[0],n[1],n[2]),e.push(...s.n),e.push(n[3],n[4]);return new Float32Array(e)}function ft(t,e){const s=[];for(let n=0;n<t;n++)for(let i=0;i<e;i++){const l=Math.PI*n/t,r=Math.PI*(n+1)/t,u=2*Math.PI*i/e,d=2*Math.PI*(i+1)/e,o=X(l,u,n,i,t,e),a=X(r,u,n+1,i,t,e),c=X(r,d,n+1,i+1,t,e),p=X(l,d,n,i+1,t,e);s.push(...o,...c,...a),s.push(...o,...p,...c)}return new Float32Array(s)}function X(t,e,s,n,i,l){const r=Math.sin(t)*Math.cos(e),u=Math.cos(t),d=Math.sin(t)*Math.sin(e),o=n/l,a=s/i;return[r,u,d,r,u,d,o,a]}function pt(t,e=.15){const n=t.length/8/3,i=[];for(let l=0;l<n;l++){const r=l*3*8,u=(t[r]+t[r+8]+t[r+16])/3,d=(t[r+1]+t[r+8+1]+t[r+16+1])/3,o=(t[r+2]+t[r+8+2]+t[r+16+2])/3,a=t[r+8]-t[r],c=t[r+8+1]-t[r+1],p=t[r+8+2]-t[r+2],f=t[r+16]-t[r],m=t[r+16+1]-t[r+1],v=t[r+16+2]-t[r+2];let C=c*v-p*m,x=p*f-a*v,P=a*m-c*f;const E=Math.hypot(C,x,P)||1;C/=E,x/=E,P/=E,i.push(u,d,o,1,1,0),i.push(u+C*e,d+x*e,o+P*e,0,1,1)}return new Float32Array(i)}function mt(t){const e=[],s=[],n=[],i=[],l=t.split(`
`);for(const u of l){const d=u.trim();if(d===""||d.startsWith("#"))continue;const o=d.split(/\s+/),a=o[0];if(a==="v")e.push([parseFloat(o[1]),parseFloat(o[2]),parseFloat(o[3])]);else if(a==="vn")s.push([parseFloat(o[1]),parseFloat(o[2]),parseFloat(o[3])]);else if(a==="vt")n.push([parseFloat(o[1]),parseFloat(o[2])||0]);else if(a==="f"){const c=[];for(let p=1;p<o.length;p++){const f=o[p].split("/"),m=parseInt(f[0])-1,v=f.length>1&&f[1]!==""?parseInt(f[1])-1:-1,C=f.length>2&&f[2]!==""?parseInt(f[2])-1:-1,x=e[m]||[0,0,0],P=v>=0&&n[v]?n[v]:[0,0],E=C>=0&&s[C]?s[C]:[0,0,0];c.push([...x,...E,...P])}for(let p=1;p<c.length-1;p++)i.push(...c[0],...c[p],...c[p+1])}}const r=new Float32Array(i);return s.length===0&&gt(r),r}function gt(t){const s=t.length/8/3;for(let n=0;n<s;n++){const i=n*3*8,l=t[i+8]-t[i],r=t[i+8+1]-t[i+1],u=t[i+8+2]-t[i+2],d=t[i+16]-t[i],o=t[i+16+1]-t[i+1],a=t[i+16+2]-t[i+2];let c=r*a-u*o,p=u*d-l*a,f=l*o-r*d;const m=Math.hypot(c,p,f)||1;c/=m,p/=m,f/=m;for(let v=0;v<3;v++)t[i+v*8+3]=c,t[i+v*8+4]=p,t[i+v*8+5]=f}}let tt=0;class ht{objects=[];selectedId=null;addObject(e,s,n){let i;e==="cube"?i=Q():e==="sphere"?i=ft(48,48):e==="obj"&&n?i=mt(n):i=Q();const l=pt(i),r=this.objects.length,u=2.5,d=4,o=r%d*u-(d-1)*u/2,a=Math.floor(r/d)*u,c={id:tt++,name:s||`${e}_${tt-1}`,geometryType:e,position:[o,0,a],rotation:[0,0,0],scale:[1,1,1],color:"#4a9eff",vertexData:i,vertexBuffer:null,vertexCount:i.length/8,normalLineData:l,normalLineBuffer:null,normalLineCount:l.length/6,textureImage:null,gpuTexture:null,textureBindGroup:null,textureName:"",visible:!0};return this.objects.push(c),c}removeObject(e){const s=this.objects.findIndex(i=>i.id===e);if(s<0)return;const n=this.objects[s];n.vertexBuffer?.destroy(),n.normalLineBuffer?.destroy(),n.gpuTexture?.destroy(),this.objects.splice(s,1),this.selectedId===e&&(this.selectedId=null)}selectObject(e){this.selectedId=e}deselectAll(){this.selectedId=null}getSelected(){return this.selectedId===null?null:this.objects.find(e=>e.id===this.selectedId)||null}}const g={modelId:0,ambient:.12,diffuse:.75,specular:.6,shininess:32,lightX:3,lightY:4,lightZ:3,autoRotLight:!0,lightColor:"#ffffff",renderMode:"solid",lightType:"point",spotDirX:0,spotDirY:-1,spotDirZ:0,spotCutoff:.9,spotExp:16};function L(t,e,s,n,i,l){return`<div class="sl-row"><span class="sl-lbl">${e}</span><input type="range" id="${t}" min="${s}" max="${n}" step="${i}" value="${l}"><span class="sl-val" id="${t}-val">${l}</span></div>`}function vt(t,e){const s=document.createElement("div");s.id="gui",s.innerHTML=`
<div class="gui-panel left-panel" id="left-panel">
  <div class="gui-title">🎨 Scene Objects</div>
  <div class="gui-section">
    <div class="gui-label">Add Object</div>
    <div class="add-btns">
      <button id="addCube" class="btn-sm">+ Cube</button>
      <button id="addSphere" class="btn-sm">+ Sphere</button>
      <button id="addTeapot" class="btn-sm">+ Taza</button>
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
    ${L("posX","Pos X",-10,10,.1,0)} ${L("posY","Pos Y",-10,10,.1,0)} ${L("posZ","Pos Z",-10,10,.1,0)}
    ${L("rotX","Rot X",-3.14,3.14,.05,0)} ${L("rotY","Rot Y",-3.14,3.14,.05,0)} ${L("rotZ","Rot Z",-3.14,3.14,.05,0)}
    ${L("scX","Scale X",.1,5,.1,1)} ${L("scY","Scale Y",.1,5,.1,1)} ${L("scZ","Scale Z",.1,5,.1,1)}
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
    ${L("ambient","Ka",0,1,.01,g.ambient)}
    ${L("diffuse","Kd",0,1,.01,g.diffuse)}
    ${L("specular","Ks",0,1,.01,g.specular)}
    ${L("shininess","Shin",1,256,1,g.shininess)}
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
    ${L("lightX","X",-8,8,.1,g.lightX)}
    ${L("lightY","Y",-8,8,.1,g.lightY)}
    ${L("lightZ","Z",-8,8,.1,g.lightZ)}
    <label class="cb-row"><input type="checkbox" id="autoRot" checked> Auto-rotate</label>
  </div>
  <div id="spotPanel" class="gui-section" style="display:none">
    <div class="gui-label">Spot Direction</div>
    ${L("spotDX","Dir X",-1,1,.05,0)}
    ${L("spotDY","Dir Y",-1,1,.05,-1)}
    ${L("spotDZ","Dir Z",-1,1,.05,0)}
    ${L("spotCut","Cutoff",0,1,.01,.9)}
    ${L("spotE","Exponent",1,64,1,16)}
  </div>
  <div class="gui-section">
    <div class="gui-label">Colors</div>
    <div class="color-row"><span>Light</span><input type="color" id="lightColor" value="#ffffff"></div>
  </div>
  <div class="gui-hint">🖱 Drag = rotate • Scroll = zoom</div>
</div>`,document.body.appendChild(s);const n=document.getElementById("objList");function i(){n.innerHTML="";for(const a of t.objects){const c=document.createElement("div");c.className="obj-item"+(a.id===t.selectedId?" selected":""),c.textContent=a.name,c.addEventListener("click",()=>{t.selectObject(a.id),i(),l()}),n.appendChild(c)}const o=document.getElementById("transformPanel");o.style.display=t.getSelected()?"":"none"}function l(){const o=t.getSelected();o&&(r("posX",o.position[0]),r("posY",o.position[1]),r("posZ",o.position[2]),r("rotX",o.rotation[0]),r("rotY",o.rotation[1]),r("rotZ",o.rotation[2]),r("scX",o.scale[0]),r("scY",o.scale[1]),r("scZ",o.scale[2]),document.getElementById("objColor").value=o.color,document.getElementById("texName").textContent=o.textureName||"None")}function r(o,a){const c=document.getElementById(o);c.value=String(a),document.getElementById(o+"-val").textContent=a.toFixed(2)}document.getElementById("addCube").addEventListener("click",()=>{t.addObject("cube",`Cube_${t.objects.length}`),i()}),document.getElementById("addSphere").addEventListener("click",()=>{t.addObject("sphere",`Sphere_${t.objects.length}`),i()}),document.getElementById("addTeapot").addEventListener("click",async()=>{try{const o=await fetch("data/teapot.obj");if(!o.ok)throw new Error("No se pudo cargar la taza");const a=await o.text();t.addObject("obj",`Taza_${t.objects.length}`,a),i()}catch(o){alert("Error al cargar la taza. Asegúrate de mover la carpeta 'data' adentro de la carpeta 'public' (public/data/teapot.obj)"),console.error(o)}}),document.getElementById("objFile").addEventListener("change",async o=>{const a=o.target.files?.[0];if(!a)return;const c=await a.text();t.addObject("obj",a.name.replace(".obj",""),c),i()}),document.getElementById("btnDeselect").addEventListener("click",()=>{t.deselectAll(),i()}),document.getElementById("btnDelete").addEventListener("click",()=>{const o=t.getSelected();o&&(t.removeObject(o.id),i())});const u=[["posX",(o,a)=>o.position[0]=a],["posY",(o,a)=>o.position[1]=a],["posZ",(o,a)=>o.position[2]=a],["rotX",(o,a)=>o.rotation[0]=a],["rotY",(o,a)=>o.rotation[1]=a],["rotZ",(o,a)=>o.rotation[2]=a],["scX",(o,a)=>o.scale[0]=a],["scY",(o,a)=>o.scale[1]=a],["scZ",(o,a)=>o.scale[2]=a]];for(const[o,a]of u){const c=document.getElementById(o);c.addEventListener("input",()=>{const p=t.getSelected();if(!p)return;const f=parseFloat(c.value);a(p,f),document.getElementById(o+"-val").textContent=f.toFixed(2)})}document.getElementById("objColor").addEventListener("input",o=>{const a=t.getSelected();a&&(a.color=o.target.value)}),document.getElementById("texFile").addEventListener("change",async o=>{const a=o.target.files?.[0],c=t.getSelected();!a||!c||(await e(c,a),document.getElementById("texName").textContent=c.textureName)}),document.querySelectorAll(".model-btn").forEach(o=>{o.addEventListener("click",()=>{g.modelId=Number(o.dataset.id),document.querySelectorAll(".model-btn").forEach(a=>a.classList.remove("active")),o.classList.add("active")})}),document.querySelectorAll(".rm-btn").forEach(o=>{o.addEventListener("click",()=>{g.renderMode=o.dataset.rm,document.querySelectorAll(".rm-btn").forEach(a=>a.classList.remove("active")),o.classList.add("active")})}),document.querySelectorAll(".lt-btn").forEach(o=>{o.addEventListener("click",()=>{g.lightType=o.dataset.lt,document.querySelectorAll(".lt-btn").forEach(a=>a.classList.remove("active")),o.classList.add("active"),document.getElementById("spotPanel").style.display=g.lightType==="spot"?"":"none"})});const d=[["ambient","ambient"],["diffuse","diffuse"],["specular","specular"],["shininess","shininess"],["lightX","lightX"],["lightY","lightY"],["lightZ","lightZ"],["spotDX","spotDirX"],["spotDY","spotDirY"],["spotDZ","spotDirZ"],["spotCut","spotCutoff"],["spotE","spotExp"]];for(const[o,a]of d){const c=document.getElementById(o);c&&c.addEventListener("input",()=>{g[a]=parseFloat(c.value),document.getElementById(o+"-val").textContent=c.value})}document.getElementById("autoRot").addEventListener("change",o=>{g.autoRotLight=o.target.checked}),document.getElementById("lightColor").addEventListener("input",o=>{g.lightColor=o.target.value}),i()}if(!navigator.gpu)throw new Error("WebGPU not supported");const S=document.querySelector("#gfx-main");if(!S)throw new Error("Canvas #gfx-main not found");const ot=await navigator.gpu.requestAdapter();if(!ot)throw new Error("No GPU adapter");const b=await ot.requestDevice(),it=S.getContext("webgpu"),H=navigator.gpu.getPreferredCanvasFormat();let Z=null;const F=new dt;function rt(){S.width=Math.max(1,Math.floor(innerWidth*devicePixelRatio)),S.height=Math.max(1,Math.floor(innerHeight*devicePixelRatio)),F.width=S.width,F.height=S.height,it.configure({device:b,format:H,alphaMode:"premultiplied"}),Z?.destroy(),Z=b.createTexture({size:[S.width,S.height],format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT})}rt();addEventListener("resize",rt);const k=b.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),K=b.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{}}]}),st=320,j=b.createBuffer({size:st,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),_=new ArrayBuffer(st),h=new Float32Array(_),A=new Uint32Array(_),et=b.createBindGroup({layout:k,entries:[{binding:0,resource:{buffer:j}}]}),$=b.createShaderModule({label:"main",code:ut}),bt=b.createRenderPipeline({label:"main-tri",layout:b.createPipelineLayout({bindGroupLayouts:[k,K]}),vertex:{module:$,entryPoint:"vs_main",buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}]},fragment:{module:$,entryPoint:"fs_main",targets:[{format:H}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"}}),xt=b.createRenderPipeline({label:"lines",layout:b.createPipelineLayout({bindGroupLayouts:[k]}),vertex:{module:$,entryPoint:"vs_lines",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}]},fragment:{module:$,entryPoint:"fs_lines",targets:[{format:H}]},primitive:{topology:"line-list"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"}}),at=b.createTexture({size:[1,1],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});b.queue.writeTexture({texture:at},new Uint8Array([255,255,255,255]),{bytesPerRow:4},[1,1]);const lt=b.createSampler({minFilter:"linear",magFilter:"linear"}),yt=b.createBindGroup({layout:K,entries:[{binding:0,resource:lt},{binding:1,resource:at.createView()}]}),Y=new ht;function Lt(t){if(!t.vertexBuffer){const e=b.createBuffer({size:t.vertexData.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});b.queue.writeBuffer(e,0,t.vertexData),t.vertexBuffer=e,t.vertexCount=t.vertexData.length/8}if(!t.normalLineBuffer&&t.normalLineData&&t.normalLineData.length>0){const e=b.createBuffer({size:t.normalLineData.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});b.queue.writeBuffer(e,0,t.normalLineData),t.normalLineBuffer=e,t.normalLineCount=t.normalLineData.length/6}}async function Ct(t,e){const s=await createImageBitmap(e),n=b.createTexture({size:[s.width,s.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});b.queue.copyExternalImageToTexture({source:s},{texture:n},[s.width,s.height]),t.gpuTexture?.destroy(),t.gpuTexture=n,t.textureName=e.name,t.textureBindGroup=b.createBindGroup({layout:K,entries:[{binding:0,resource:lt},{binding:1,resource:n.createView()}]})}let J=!1,W=0,q=0;S.addEventListener("mousedown",t=>{t.button===0&&(J=!0,W=t.clientX,q=t.clientY)});addEventListener("mouseup",()=>{J=!1});S.addEventListener("mousemove",t=>{if(!J)return;const e=Y.getSelected();e?(e.rotation[1]+=t.movementX*.01,e.rotation[0]+=t.movementY*.01):F.rotate(W,q,t.clientX,t.clientY),W=t.clientX,q=t.clientY});S.addEventListener("wheel",t=>{t.preventDefault(),F.zoom(t.deltaY)},{passive:!1});function nt(t){const e=parseInt(t.slice(1),16);return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]}function wt(t){const e=y.translation(t.position[0],t.position[1],t.position[2]),s=y.rotationX(t.rotation[0]),n=y.rotationY(t.rotation[1]),i=y.rotationZ(t.rotation[2]),l=y.scaling(t.scale[0],t.scale[1],t.scale[2]);return y.multiply(e,y.multiply(y.multiply(n,y.multiply(s,i)),l))}vt(Y,(t,e)=>Ct(t,e));Y.addObject("cube","Cube");const Pt=performance.now(),Et={solid:0,wireframe:1,uvdebug:2,normals:0},St={point:0,directional:1,spot:2};function ct(t){const e=(t-Pt)/1e3,s=S.width/S.height,n=y.perspective(60*Math.PI/180,s,.1,100),i=F.getViewMatrix(),l=F.getPosition();let r=g.lightX,u=g.lightY,d=g.lightZ;g.autoRotLight&&(r=Math.cos(e*.8)*4.5,d=Math.sin(e*.8)*4.5);const[o,a,c]=nt(g.lightColor),p=b.createCommandEncoder(),f=p.beginRenderPass({colorAttachments:[{view:it.getCurrentTexture().createView(),clearValue:{r:.05,g:.05,b:.08,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:Z.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});for(const m of Y.objects){if(!m.visible||(Lt(m),!m.vertexBuffer))continue;const v=wt(m),C=y.normalMatrix(v),x=y.multiply(y.multiply(n,i),v),[P,E,B]=nt(m.color),T=m.id===Y.selectedId?1:0,N=Et[g.renderMode],z=St[g.lightType],I=m.textureBindGroup?1:0;h.set(x,0),h.set(v,16),h.set(C,32),h[48]=r,h[49]=u,h[50]=d,h[51]=0,h[52]=o,h[53]=a,h[54]=c,h[55]=0,h[56]=g.ambient,h[57]=g.diffuse,h[58]=g.specular,h[59]=g.shininess,h[60]=l[0],h[61]=l[1],h[62]=l[2],A[63]=g.modelId,h[64]=P,h[65]=E,h[66]=B,h[67]=e,A[68]=N,A[69]=z,A[70]=I,A[71]=T,h[72]=g.spotDirX,h[73]=g.spotDirY,h[74]=g.spotDirZ,h[75]=g.spotCutoff,h[76]=g.spotExp,h[77]=0,h[78]=0,h[79]=0,b.queue.writeBuffer(j,0,_),f.setPipeline(bt),f.setBindGroup(0,et),f.setBindGroup(1,m.textureBindGroup||yt),f.setVertexBuffer(0,m.vertexBuffer),f.draw(m.vertexCount),g.renderMode==="normals"&&m.normalLineBuffer&&(A[68]=0,b.queue.writeBuffer(j,0,_),f.setPipeline(xt),f.setBindGroup(0,et),f.setVertexBuffer(0,m.normalLineBuffer),f.draw(m.normalLineCount))}f.end(),b.queue.submit([p.finish()]),requestAnimationFrame(ct)}requestAnimationFrame(ct);
