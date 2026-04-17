(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const a of o)if(a.type==="childList")for(const s of a.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function r(o){const a={};return o.integrity&&(a.integrity=o.integrity),o.referrerPolicy&&(a.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?a.credentials="include":o.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function n(o){if(o.ep)return;o.ep=!0;const a=r(o);fetch(o.href,a)}})();const ut=`// shader.wgsl — Full lighting + textures + wireframe + UV debug
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
`,S={add(t,e){return[t[0]+e[0],t[1]+e[1],t[2]+e[2]]},sub(t,e){return[t[0]-e[0],t[1]-e[1],t[2]-e[2]]},scale(t,e){return[t[0]*e,t[1]*e,t[2]*e]},dot(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]},cross(t,e){return[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]]},normalize(t){const e=Math.hypot(t[0],t[1],t[2])||1;return[t[0]/e,t[1]/e,t[2]/e]}},y={identity(){const t=new Float32Array(16);return t[0]=1,t[5]=1,t[10]=1,t[15]=1,t},multiply(t,e){const r=new Float32Array(16);for(let n=0;n<4;n++)for(let o=0;o<4;o++)r[n*4+o]=t[0+o]*e[n*4+0]+t[4+o]*e[n*4+1]+t[8+o]*e[n*4+2]+t[12+o]*e[n*4+3];return r},transpose(t){const e=new Float32Array(16);for(let r=0;r<4;r++)for(let n=0;n<4;n++)e[n*4+r]=t[r*4+n];return e},invert(t){const e=new Float32Array(16),r=t[0],n=t[1],o=t[2],a=t[3],s=t[4],c=t[5],f=t[6],u=t[7],i=t[8],l=t[9],d=t[10],p=t[11],m=t[12],v=t[13],C=t[14],x=t[15],P=r*c-n*s,E=r*f-o*s,B=r*u-a*s,T=n*f-o*c,N=n*u-a*c,z=o*u-a*f,I=i*v-l*m,G=i*C-d*m,U=i*x-p*m,O=l*C-d*v,R=l*x-p*v,V=d*x-p*C;let w=P*V-E*R+B*O+T*U-N*G+z*I;return w?(w=1/w,e[0]=(c*V-f*R+u*O)*w,e[1]=(f*U-s*V-u*G)*w,e[2]=(s*R-c*U+u*I)*w,e[3]=(c*G-s*O-f*I)*w,e[4]=(o*R-n*V-a*O)*w,e[5]=(r*V-o*U+a*G)*w,e[6]=(n*U-r*R-a*I)*w,e[7]=(r*O-n*G+o*I)*w,e[8]=(v*z-C*N+x*T)*w,e[9]=(C*B-m*z-x*E)*w,e[10]=(m*N-v*B+x*P)*w,e[11]=(v*E-m*T-C*P)*w,e[12]=(d*N-l*z-p*T)*w,e[13]=(i*z-d*B+p*E)*w,e[14]=(l*B-i*N-p*P)*w,e[15]=(i*T-l*E+d*P)*w,e):y.identity()},normalMatrix(t){return y.transpose(y.invert(t))},translation(t,e,r){const n=y.identity();return n[12]=t,n[13]=e,n[14]=r,n},scaling(t,e,r){const n=y.identity();return n[0]=t,n[5]=e,n[10]=r,n},rotationX(t){const e=Math.cos(t),r=Math.sin(t),n=y.identity();return n[5]=e,n[6]=r,n[9]=-r,n[10]=e,n},rotationY(t){const e=Math.cos(t),r=Math.sin(t),n=y.identity();return n[0]=e,n[2]=-r,n[8]=r,n[10]=e,n},rotationZ(t){const e=Math.cos(t),r=Math.sin(t),n=y.identity();return n[0]=e,n[1]=r,n[4]=-r,n[5]=e,n},perspective(t,e,r,n){const o=1/Math.tan(t/2),a=new Float32Array(16);return a[0]=o/e,a[5]=o,a[10]=n/(r-n),a[11]=-1,a[14]=n*r/(r-n),a},lookAt(t,e,r){const n=S.normalize(S.sub(t,e)),o=S.normalize(S.cross(r,n)),a=S.cross(n,o),s=new Float32Array(16);return s[0]=o[0],s[4]=o[1],s[8]=o[2],s[12]=-S.dot(o,t),s[1]=a[0],s[5]=a[1],s[9]=a[2],s[13]=-S.dot(a,t),s[2]=n[0],s[6]=n[1],s[10]=n[2],s[14]=-S.dot(n,t),s[3]=0,s[7]=0,s[11]=0,s[15]=1,s}},A={identity(){return new Float32Array([0,0,0,1])},multiply(t,e){const r=t[0],n=t[1],o=t[2],a=t[3],s=e[0],c=e[1],f=e[2],u=e[3];return new Float32Array([r*u+a*s+n*f-o*c,n*u+a*c+o*s-r*f,o*u+a*f+r*c-n*s,a*u-r*s-n*c-o*f])},setAxisAngle(t,e){const r=e*.5,n=Math.sin(r);return new Float32Array([t[0]*n,t[1]*n,t[2]*n,Math.cos(r)])},normalize(t){let e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2]+t[3]*t[3];return e>0?(e=1/Math.sqrt(e),new Float32Array([t[0]*e,t[1]*e,t[2]*e,t[3]*e])):A.identity()},toMat4(t){const e=t[0],r=t[1],n=t[2],o=t[3],a=e+e,s=r+r,c=n+n,f=e*a,u=e*s,i=e*c,l=r*s,d=r*c,p=n*c,m=o*a,v=o*s,C=o*c,x=y.identity();return x[0]=1-(l+p),x[4]=u-C,x[8]=i+v,x[1]=u+C,x[5]=1-(f+p),x[9]=d-m,x[2]=i-v,x[6]=d+m,x[10]=1-(f+l),x}};class dt{rotation=A.identity();distance=5;target=[0,0,0];zoomMin=1.5;zoomMax=30;width=800;height=600;mapToSphere(e,r){const n=Math.min(this.width,this.height)*.5,o=this.width*.5,a=this.height*.5;let s=(e-o)/n,c=-(r-a)/n;const f=s*s+c*c;let u;if(f<=1)u=Math.sqrt(1-f);else{const i=Math.sqrt(f);s/=i,c/=i,u=0}return[s,c,u]}rotate(e,r,n,o){const a=this.mapToSphere(e,r),s=this.mapToSphere(n,o),c=S.cross(a,s);if(Math.hypot(c[0],c[1],c[2])<1e-8)return;const u=A.toMat4(this.rotation),i=[u[0]*c[0]+u[4]*c[1]+u[8]*c[2],u[1]*c[0]+u[5]*c[1]+u[9]*c[2],u[2]*c[0]+u[6]*c[1]+u[10]*c[2]],l=Math.max(-1,Math.min(1,S.dot(a,s))),d=Math.acos(l),p=S.normalize(i),m=A.setAxisAngle(p,d);this.rotation=A.normalize(A.multiply(m,this.rotation))}getPosition(){return this.calculateTransform().pos}calculateTransform(){const e=A.toMat4(this.rotation),r=e[8]*this.distance+this.target[0],n=e[9]*this.distance+this.target[1],o=e[10]*this.distance+this.target[2],a=e[4],s=e[5],c=e[6];return{pos:[r,n,o],up:[a,s,c]}}getViewMatrix(){const e=this.calculateTransform();return y.lookAt(e.pos,this.target,e.up)}zoom(e){this.distance*=1+e*.001,this.distance=Math.max(this.zoomMin,Math.min(this.zoomMax,this.distance))}}function Q(){const t=[{n:[0,0,1],verts:[[-1,-1,1,0,1],[1,-1,1,1,1],[1,1,1,1,0],[-1,-1,1,0,1],[1,1,1,1,0],[-1,1,1,0,0]]},{n:[0,0,-1],verts:[[1,-1,-1,0,1],[-1,-1,-1,1,1],[-1,1,-1,1,0],[1,-1,-1,0,1],[-1,1,-1,1,0],[1,1,-1,0,0]]},{n:[-1,0,0],verts:[[-1,-1,-1,0,1],[-1,-1,1,1,1],[-1,1,1,1,0],[-1,-1,-1,0,1],[-1,1,1,1,0],[-1,1,-1,0,0]]},{n:[1,0,0],verts:[[1,-1,1,0,1],[1,-1,-1,1,1],[1,1,-1,1,0],[1,-1,1,0,1],[1,1,-1,1,0],[1,1,1,0,0]]},{n:[0,1,0],verts:[[-1,1,1,0,1],[1,1,1,1,1],[1,1,-1,1,0],[-1,1,1,0,1],[1,1,-1,1,0],[-1,1,-1,0,0]]},{n:[0,-1,0],verts:[[-1,-1,-1,0,1],[1,-1,-1,1,1],[1,-1,1,1,0],[-1,-1,-1,0,1],[1,-1,1,1,0],[-1,-1,1,0,0]]}],e=[];for(const r of t)for(const n of r.verts)e.push(n[0],n[1],n[2]),e.push(...r.n),e.push(n[3],n[4]);return new Float32Array(e)}function ft(t,e){const r=[];for(let n=0;n<t;n++)for(let o=0;o<e;o++){const a=Math.PI*n/t,s=Math.PI*(n+1)/t,c=2*Math.PI*o/e,f=2*Math.PI*(o+1)/e,u=X(a,c,n,o,t,e),i=X(s,c,n+1,o,t,e),l=X(s,f,n+1,o+1,t,e),d=X(a,f,n,o+1,t,e);r.push(...u,...l,...i),r.push(...u,...d,...l)}return new Float32Array(r)}function X(t,e,r,n,o,a){const s=Math.sin(t)*Math.cos(e),c=Math.cos(t),f=Math.sin(t)*Math.sin(e),u=n/a,i=r/o;return[s,c,f,s,c,f,u,i]}function pt(t,e=.15){const n=t.length/8/3,o=[];for(let a=0;a<n;a++){const s=a*3*8,c=(t[s]+t[s+8]+t[s+16])/3,f=(t[s+1]+t[s+8+1]+t[s+16+1])/3,u=(t[s+2]+t[s+8+2]+t[s+16+2])/3,i=t[s+8]-t[s],l=t[s+8+1]-t[s+1],d=t[s+8+2]-t[s+2],p=t[s+16]-t[s],m=t[s+16+1]-t[s+1],v=t[s+16+2]-t[s+2];let C=l*v-d*m,x=d*p-i*v,P=i*m-l*p;const E=Math.hypot(C,x,P)||1;C/=E,x/=E,P/=E,o.push(c,f,u,1,1,0),o.push(c+C*e,f+x*e,u+P*e,0,1,1)}return new Float32Array(o)}function mt(t){const e=[],r=[],n=[],o=[],a=t.split(`
`);for(const c of a){const f=c.trim();if(f===""||f.startsWith("#"))continue;const u=f.split(/\s+/),i=u[0];if(i==="v")e.push([parseFloat(u[1]),parseFloat(u[2]),parseFloat(u[3])]);else if(i==="vn")r.push([parseFloat(u[1]),parseFloat(u[2]),parseFloat(u[3])]);else if(i==="vt")n.push([parseFloat(u[1]),parseFloat(u[2])||0]);else if(i==="f"){const l=[];for(let d=1;d<u.length;d++){const p=u[d].split("/"),m=parseInt(p[0])-1,v=p.length>1&&p[1]!==""?parseInt(p[1])-1:-1,C=p.length>2&&p[2]!==""?parseInt(p[2])-1:-1,x=e[m]||[0,0,0],P=v>=0&&n[v]?n[v]:[0,0],E=C>=0&&r[C]?r[C]:[0,0,0];l.push([...x,...E,...P])}for(let d=1;d<l.length-1;d++)o.push(...l[0],...l[d],...l[d+1])}}const s=new Float32Array(o);return r.length===0&&gt(s),s}function gt(t){const r=t.length/8/3;for(let n=0;n<r;n++){const o=n*3*8,a=t[o+8]-t[o],s=t[o+8+1]-t[o+1],c=t[o+8+2]-t[o+2],f=t[o+16]-t[o],u=t[o+16+1]-t[o+1],i=t[o+16+2]-t[o+2];let l=s*i-c*u,d=c*f-a*i,p=a*u-s*f;const m=Math.hypot(l,d,p)||1;l/=m,d/=m,p/=m;for(let v=0;v<3;v++)t[o+v*8+3]=l,t[o+v*8+4]=d,t[o+v*8+5]=p}}let tt=0;class ht{objects=[];selectedId=null;addObject(e,r,n){let o;e==="cube"?o=Q():e==="sphere"?o=ft(48,48):e==="obj"&&n?o=mt(n):o=Q();const a=pt(o),s=this.objects.length,c=2.5,f=4,u=s%f*c-(f-1)*c/2,i=Math.floor(s/f)*c,l={id:tt++,name:r||`${e}_${tt-1}`,geometryType:e,position:[u,0,i],rotation:[0,0,0],scale:[1,1,1],color:"#4a9eff",vertexData:o,vertexBuffer:null,vertexCount:o.length/8,normalLineData:a,normalLineBuffer:null,normalLineCount:a.length/6,textureImage:null,gpuTexture:null,textureBindGroup:null,textureName:"",visible:!0};return this.objects.push(l),l}removeObject(e){const r=this.objects.findIndex(o=>o.id===e);if(r<0)return;const n=this.objects[r];n.vertexBuffer?.destroy(),n.normalLineBuffer?.destroy(),n.gpuTexture?.destroy(),this.objects.splice(r,1),this.selectedId===e&&(this.selectedId=null)}selectObject(e){this.selectedId=e}deselectAll(){this.selectedId=null}getSelected(){return this.selectedId===null?null:this.objects.find(e=>e.id===this.selectedId)||null}}const g={modelId:0,ambient:.12,diffuse:.75,specular:.6,shininess:32,lightX:3,lightY:4,lightZ:3,autoRotLight:!0,lightColor:"#ffffff",renderMode:"solid",lightType:"point",spotDirX:0,spotDirY:-1,spotDirZ:0,spotCutoff:.9,spotExp:16};function L(t,e,r,n,o,a){return`<div class="sl-row"><span class="sl-lbl">${e}</span><input type="range" id="${t}" min="${r}" max="${n}" step="${o}" value="${a}"><span class="sl-val" id="${t}-val">${a}</span></div>`}function vt(t,e,r){const n=document.createElement("div");n.id="gui",n.innerHTML=`
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
</div>`,document.body.appendChild(n);const o=document.getElementById("objList");function a(){o.innerHTML="";for(const l of t.objects){const d=document.createElement("div");d.className="obj-item"+(l.id===t.selectedId?" selected":""),d.textContent=l.name,d.addEventListener("click",()=>{t.selectObject(l.id),e.target=l.position,a(),s()}),o.appendChild(d)}const i=document.getElementById("transformPanel");i.style.display=t.getSelected()?"":"none"}function s(){const i=t.getSelected();i&&(c("posX",i.position[0]),c("posY",i.position[1]),c("posZ",i.position[2]),c("rotX",i.rotation[0]),c("rotY",i.rotation[1]),c("rotZ",i.rotation[2]),c("scX",i.scale[0]),c("scY",i.scale[1]),c("scZ",i.scale[2]),document.getElementById("objColor").value=i.color,document.getElementById("texName").textContent=i.textureName||"None")}function c(i,l){const d=document.getElementById(i);d.value=String(l),document.getElementById(i+"-val").textContent=l.toFixed(2)}document.getElementById("addCube").addEventListener("click",()=>{t.addObject("cube",`Cube_${t.objects.length}`),a()}),document.getElementById("addSphere").addEventListener("click",()=>{t.addObject("sphere",`Sphere_${t.objects.length}`),a()}),document.getElementById("addTeapot").addEventListener("click",async()=>{try{const i=await fetch("data/teapot.obj");if(!i.ok)throw new Error("No se pudo cargar la taza");const l=await i.text();t.addObject("obj",`Taza_${t.objects.length}`,l),a()}catch(i){alert("Error al cargar la taza. Asegúrate de mover la carpeta 'data' adentro de la carpeta 'public' (public/data/teapot.obj)"),console.error(i)}}),document.getElementById("objFile").addEventListener("change",async i=>{const l=i.target.files?.[0];if(!l)return;const d=await l.text();t.addObject("obj",l.name.replace(".obj",""),d),a()}),document.getElementById("btnDeselect").addEventListener("click",()=>{t.deselectAll(),e.target=[0,0,0],a()}),document.getElementById("btnDelete").addEventListener("click",()=>{const i=t.getSelected();i&&(t.removeObject(i.id),a())});const f=[["posX",(i,l)=>i.position[0]=l],["posY",(i,l)=>i.position[1]=l],["posZ",(i,l)=>i.position[2]=l],["rotX",(i,l)=>i.rotation[0]=l],["rotY",(i,l)=>i.rotation[1]=l],["rotZ",(i,l)=>i.rotation[2]=l],["scX",(i,l)=>i.scale[0]=l],["scY",(i,l)=>i.scale[1]=l],["scZ",(i,l)=>i.scale[2]=l]];for(const[i,l]of f){const d=document.getElementById(i);d.addEventListener("input",()=>{const p=t.getSelected();if(!p)return;const m=parseFloat(d.value);l(p,m),i.startsWith("pos")&&(e.target=p.position),document.getElementById(i+"-val").textContent=m.toFixed(2)})}document.getElementById("objColor").addEventListener("input",i=>{const l=t.getSelected();l&&(l.color=i.target.value)}),document.getElementById("texFile").addEventListener("change",async i=>{const l=i.target.files?.[0],d=t.getSelected();!l||!d||(await r(d,l),document.getElementById("texName").textContent=d.textureName)}),document.querySelectorAll(".model-btn").forEach(i=>{i.addEventListener("click",()=>{g.modelId=Number(i.dataset.id),document.querySelectorAll(".model-btn").forEach(l=>l.classList.remove("active")),i.classList.add("active")})}),document.querySelectorAll(".rm-btn").forEach(i=>{i.addEventListener("click",()=>{g.renderMode=i.dataset.rm,document.querySelectorAll(".rm-btn").forEach(l=>l.classList.remove("active")),i.classList.add("active")})}),document.querySelectorAll(".lt-btn").forEach(i=>{i.addEventListener("click",()=>{g.lightType=i.dataset.lt,document.querySelectorAll(".lt-btn").forEach(l=>l.classList.remove("active")),i.classList.add("active"),document.getElementById("spotPanel").style.display=g.lightType==="spot"?"":"none"})});const u=[["ambient","ambient"],["diffuse","diffuse"],["specular","specular"],["shininess","shininess"],["lightX","lightX"],["lightY","lightY"],["lightZ","lightZ"],["spotDX","spotDirX"],["spotDY","spotDirY"],["spotDZ","spotDirZ"],["spotCut","spotCutoff"],["spotE","spotExp"]];for(const[i,l]of u){const d=document.getElementById(i);d&&d.addEventListener("input",()=>{g[l]=parseFloat(d.value),document.getElementById(i+"-val").textContent=d.value})}document.getElementById("autoRot").addEventListener("change",i=>{g.autoRotLight=i.target.checked}),document.getElementById("lightColor").addEventListener("input",i=>{g.lightColor=i.target.value}),a()}if(!navigator.gpu)throw new Error("WebGPU not supported");const M=document.querySelector("#gfx-main");if(!M)throw new Error("Canvas #gfx-main not found");const ot=await navigator.gpu.requestAdapter();if(!ot)throw new Error("No GPU adapter");const b=await ot.requestDevice(),it=M.getContext("webgpu"),H=navigator.gpu.getPreferredCanvasFormat();let Z=null;const D=new dt;function rt(){M.width=Math.max(1,Math.floor(innerWidth*devicePixelRatio)),M.height=Math.max(1,Math.floor(innerHeight*devicePixelRatio)),D.width=M.width,D.height=M.height,it.configure({device:b,format:H,alphaMode:"premultiplied"}),Z?.destroy(),Z=b.createTexture({size:[M.width,M.height],format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT})}rt();addEventListener("resize",rt);const k=b.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),K=b.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{}}]}),st=320,j=b.createBuffer({size:st,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),_=new ArrayBuffer(st),h=new Float32Array(_),F=new Uint32Array(_),et=b.createBindGroup({layout:k,entries:[{binding:0,resource:{buffer:j}}]}),$=b.createShaderModule({label:"main",code:ut}),bt=b.createRenderPipeline({label:"main-tri",layout:b.createPipelineLayout({bindGroupLayouts:[k,K]}),vertex:{module:$,entryPoint:"vs_main",buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}]},fragment:{module:$,entryPoint:"fs_main",targets:[{format:H}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"}}),xt=b.createRenderPipeline({label:"lines",layout:b.createPipelineLayout({bindGroupLayouts:[k]}),vertex:{module:$,entryPoint:"vs_lines",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}]},fragment:{module:$,entryPoint:"fs_lines",targets:[{format:H}]},primitive:{topology:"line-list"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"}}),at=b.createTexture({size:[1,1],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});b.queue.writeTexture({texture:at},new Uint8Array([255,255,255,255]),{bytesPerRow:4},[1,1]);const lt=b.createSampler({minFilter:"linear",magFilter:"linear"}),yt=b.createBindGroup({layout:K,entries:[{binding:0,resource:lt},{binding:1,resource:at.createView()}]}),Y=new ht;function Lt(t){if(!t.vertexBuffer){const e=b.createBuffer({size:t.vertexData.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});b.queue.writeBuffer(e,0,t.vertexData),t.vertexBuffer=e,t.vertexCount=t.vertexData.length/8}if(!t.normalLineBuffer&&t.normalLineData&&t.normalLineData.length>0){const e=b.createBuffer({size:t.normalLineData.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});b.queue.writeBuffer(e,0,t.normalLineData),t.normalLineBuffer=e,t.normalLineCount=t.normalLineData.length/6}}async function Ct(t,e){const r=await createImageBitmap(e),n=b.createTexture({size:[r.width,r.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});b.queue.copyExternalImageToTexture({source:r},{texture:n},[r.width,r.height]),t.gpuTexture?.destroy(),t.gpuTexture=n,t.textureName=e.name,t.textureBindGroup=b.createBindGroup({layout:K,entries:[{binding:0,resource:lt},{binding:1,resource:n.createView()}]})}let J=!1,W=0,q=0;M.addEventListener("mousedown",t=>{t.button===0&&(J=!0,W=t.clientX,q=t.clientY)});addEventListener("mouseup",()=>{J=!1});M.addEventListener("mousemove",t=>{if(!J)return;const e=Y.getSelected();if(e){e.rotation[1]+=t.movementX*.01,e.rotation[0]+=t.movementY*.01;const r=Math.PI/2-.01;e.rotation[0]=Math.max(-r,Math.min(r,e.rotation[0]))}else D.rotate(W,q,t.clientX,t.clientY);W=t.clientX,q=t.clientY});M.addEventListener("wheel",t=>{t.preventDefault(),D.zoom(t.deltaY)},{passive:!1});function nt(t){const e=parseInt(t.slice(1),16);return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]}function wt(t){const e=y.translation(t.position[0],t.position[1],t.position[2]),r=y.rotationX(t.rotation[0]),n=y.rotationY(t.rotation[1]),o=y.rotationZ(t.rotation[2]),a=y.scaling(t.scale[0],t.scale[1],t.scale[2]);return y.multiply(e,y.multiply(y.multiply(n,y.multiply(r,o)),a))}vt(Y,D,(t,e)=>Ct(t,e));Y.addObject("cube","Cube");const Pt=performance.now(),Et={solid:0,wireframe:1,uvdebug:2,normals:0},Mt={point:0,directional:1,spot:2};function ct(t){const e=(t-Pt)/1e3,r=M.width/M.height,n=y.perspective(60*Math.PI/180,r,.1,100),o=D.getViewMatrix(),a=D.getPosition();let s=g.lightX,c=g.lightY,f=g.lightZ;g.autoRotLight&&(s=Math.cos(e*.8)*4.5,f=Math.sin(e*.8)*4.5);const[u,i,l]=nt(g.lightColor),d=b.createCommandEncoder(),p=d.beginRenderPass({colorAttachments:[{view:it.getCurrentTexture().createView(),clearValue:{r:.05,g:.05,b:.08,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:Z.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});for(const m of Y.objects){if(!m.visible||(Lt(m),!m.vertexBuffer))continue;const v=wt(m),C=y.normalMatrix(v),x=y.multiply(y.multiply(n,o),v),[P,E,B]=nt(m.color),T=m.id===Y.selectedId?1:0,N=Et[g.renderMode],z=Mt[g.lightType],I=m.textureBindGroup?1:0;h.set(x,0),h.set(v,16),h.set(C,32),h[48]=s,h[49]=c,h[50]=f,h[51]=0,h[52]=u,h[53]=i,h[54]=l,h[55]=0,h[56]=g.ambient,h[57]=g.diffuse,h[58]=g.specular,h[59]=g.shininess,h[60]=a[0],h[61]=a[1],h[62]=a[2],F[63]=g.modelId,h[64]=P,h[65]=E,h[66]=B,h[67]=e,F[68]=N,F[69]=z,F[70]=I,F[71]=T,h[72]=g.spotDirX,h[73]=g.spotDirY,h[74]=g.spotDirZ,h[75]=g.spotCutoff,h[76]=g.spotExp,h[77]=0,h[78]=0,h[79]=0,b.queue.writeBuffer(j,0,_),p.setPipeline(bt),p.setBindGroup(0,et),p.setBindGroup(1,m.textureBindGroup||yt),p.setVertexBuffer(0,m.vertexBuffer),p.draw(m.vertexCount),g.renderMode==="normals"&&m.normalLineBuffer&&(F[68]=0,b.queue.writeBuffer(j,0,_),p.setPipeline(xt),p.setBindGroup(0,et),p.setVertexBuffer(0,m.normalLineBuffer),p.draw(m.normalLineCount))}p.end(),b.queue.submit([d.finish()]),requestAnimationFrame(ct)}requestAnimationFrame(ct);
