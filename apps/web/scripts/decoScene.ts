// Used only by scripts/render-deco.mjs (via deco-still.html) to make the booking-band images
// public/img/deco-aligner.webp and public/img/deco-tooth.webp. Not part of the site bundle.
// Ported from the reference design's static "aligner" and "tooth" renders.
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type V3 = [number, number, number];
const sph = (p: V3, c: V3, r: number) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r;
const ell = (p: V3, c: V3, r: V3) => {
  const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2];
  const k0 = Math.hypot(x, y, z), k1 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  return (k0 * (k0 - 1)) / (k1 || 1e-6);
};
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
const cone = (p: V3, a: V3, b: V3, r1: number, r2: number) => {
  const pa = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const bb = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
  const h = Math.min(1, Math.max(0, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / bb));
  return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - (r1 + (r2 - r1) * h);
};

function molar(p: V3, crownOnly = false) {
  let d = ell(p, [0, 0.2, 0], [0.46, 0.3, 0.41]);
  for (const [x, z] of [[-0.21, -0.17], [0.21, -0.17], [-0.21, 0.18], [0.21, 0.18]]) d = smin(d, sph(p, [x, 0.4, z], 0.2), 0.16);
  d = smax(d, -sph(p, [0, 0.66, 0], 0.2), 0.14);
  d = smax(d, -cone(p, [-0.5, 0.6, 0], [0.5, 0.6, 0], 0.05, 0.05), 0.08);
  if (crownOnly) return smax(d, -0.02 - p[1], 0.06);
  d = smin(d, ell(p, [0, -0.04, 0], [0.33, 0.2, 0.29]), 0.14);
  d = smin(d, cone(p, [-0.16, -0.02, 0], [-0.27, -0.82, 0.04], 0.17, 0.05), 0.12);
  d = smin(d, cone(p, [0.16, -0.02, 0], [0.25, -0.8, -0.04], 0.17, 0.05), 0.12);
  return d;
}
const incisor = (p: V3) => { const d = smax(ell(p, [0, 0.05, 0], [0.36, 0.62, 0.16]), p[1] - 0.55, 0.08); return smin(d, ell(p, [0, -0.25, 0], [0.24, 0.3, 0.17]), 0.1); };
const canine = (p: V3) => smin(cone(p, [0, -0.3, 0], [0, 0.55, 0], 0.3, 0.05), ell(p, [0, -0.1, 0], [0.3, 0.42, 0.25]), 0.15);
const premolar = (p: V3) => {
  let d = ell(p, [0, 0.05, 0], [0.32, 0.42, 0.34]);
  d = smin(d, sph(p, [0, 0.38, -0.12], 0.17), 0.12);
  d = smin(d, sph(p, [0, 0.36, 0.14], 0.16), 0.12);
  return smax(d, -sph(p, [0, 0.6, 0], 0.13), 0.1);
};

function sdfGeo(fn: (p: V3) => number, res: number) {
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 300000);
  mc.isolation = 0;
  const n = res, h = n / 2, f = mc.field;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) f[x + y * n + z * n * n] = -fn([(x - h) / h, (y - h) / h, (z - h) / h]);
  mc.update();
  const c = mc.count, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mc.geometry.attributes.position.array.slice(0, c * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mc.geometry.attributes.normal.array.slice(0, c * 3), 3));
  g.normalizeNormals();
  mc.geometry.dispose();
  return g;
}
function swirlColors(g: THREE.BufferGeometry, a: number, b: number, c: number) {
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const A = new THREE.Color(a), B = new THREE.Color(b), C = new THREE.Color(c), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * 3.2, y = pos.getY(i) * 3.2, z = pos.getZ(i) * 3.2;
    let n = Math.sin(x + Math.sin(y * 1.7 + z)) * 0.5 + Math.sin(y * 2.3 + Math.cos(z * 1.9 + x * 0.7)) * 0.35 + Math.sin(z * 2.9 + y * 0.6) * 0.25;
    n = n * 0.5 + 0.5;
    t.copy(A).lerp(B, Math.min(1, n * 1.2));
    if (n > 0.78) t.lerp(C, (n - 0.78) * 3.5);
    col.set([t.r, t.g, t.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const rimMat = (color: number, power: number, strength: number) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, s: { value: strength } },
  vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'uniform vec3 c;uniform float p,s;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),p)*s;gl_FragColor=vec4(c*f,f);}',
});
const shellMat = (o: { color?: number; opacity?: number; env?: number } = {}) => new THREE.MeshPhysicalMaterial({
  color: o.color ?? 0xb9d7ff, roughness: 0.06, metalness: 0, transparent: true, opacity: o.opacity ?? 0.38, clearcoat: 1, clearcoatRoughness: 0.04,
  iridescence: 0.7, iridescenceIOR: 1.35, envMapIntensity: o.env ?? 2.2, depthWrite: false, side: THREE.FrontSide,
});

type GlassOpts = { geo?: THREE.BufferGeometry; coreGeo?: THREE.BufferGeometry; coreColor?: number; coreEmissive?: number; ei?: number; coreOpacity?: number };
function glassTooth(o: GlassOpts, G: Record<string, THREE.BufferGeometry>) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(o.coreGeo ?? G.core, new THREE.MeshStandardMaterial({
    vertexColors: o.coreColor === undefined, color: o.coreColor ?? 0xffffff, emissive: o.coreEmissive ?? 0x0b33c4, emissiveIntensity: o.ei ?? 0.32,
    roughness: 0.3, metalness: 0.05, transparent: true, opacity: o.coreOpacity ?? 0.95,
  }));
  const shell = new THREE.Mesh(o.geo ?? G.tooth, shellMat());
  const rim = new THREE.Mesh(o.geo ?? G.tooth, rimMat(0xcfe6ff, 2.4, 1));
  rim.scale.setScalar(1.003);
  core.renderOrder = 0; shell.renderOrder = 1; rim.renderOrder = 2;
  g.add(core, shell, rim);
  return g;
}
function arch(n: number, R: number, fn: (i: number) => THREE.Object3D) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - 0.5) * Math.PI * 1.1;
    const m = fn(i);
    m.position.set(Math.sin(a) * R, 0, Math.cos(a) * R * 0.85);
    m.rotation.y = a;
    g.add(m);
  }
  return g;
}

function build(k: 'aligner' | 'tooth') {
  const grp = new THREE.Group();
  if (k === 'tooth') {
    const G = { tooth: sdfGeo((p) => molar(p), 60), core: swirlColors(sdfGeo((p) => molar(p) + 0.07, 44), 0x0a2fb8, 0x3d8af7, 0xd8ecff) };
    const t = glassTooth({}, G);
    t.rotation.set(0.25, -0.5, 0.08);
    grp.add(t);
  } else {
    const G = { mol: sdfGeo((p) => molar(p, true), 32), pre: sdfGeo(premolar, 32), can: sdfGeo(canine, 32), inc: sdfGeo(incisor, 32) };
    const order = [G.mol, G.pre, G.can, G.inc, G.inc, G.inc, G.inc, G.can, G.pre, G.mol];
    const a = arch(10, 0.95, (i) => {
      const t = glassTooth({ geo: order[i], coreGeo: order[i], coreColor: 0x5f9dff, coreEmissive: 0x0b33c4, ei: 0.35, coreOpacity: 0.85 }, G);
      t.scale.setScalar(0.42);
      return t;
    });
    grp.add(a);
    grp.rotation.set(0.55, 0, 0.12);
    grp.position.set(0, 0, -0.2);
  }
  return grp;
}

/** Renders one transparent PNG data URL. */
export function renderStill(k: 'aligner' | 'tooth', w: number, h: number) {
  const c = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setSize(w, h, false);
  r.setClearColor(0x000000, 0);
  const s = new THREE.Scene();
  s.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  const kl = new THREE.DirectionalLight(0xffffff, 2.2); kl.position.set(2, 3, 4);
  const bl = new THREE.PointLight(0x5aa0ff, 8, 10); bl.position.set(-2, -1, 2);
  s.add(kl, bl, new THREE.AmbientLight(0xbfd6ff, 0.6));
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  cam.position.set(0, 0, k === 'aligner' ? 6.8 : 4.6);
  s.add(build(k));
  r.render(s, cam);
  return c.toDataURL('image/png');
}
