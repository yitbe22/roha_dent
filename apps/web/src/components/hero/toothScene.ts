// Glass tooth for the home hero (desktop only; loaded on demand by HeroTooth).
// Ported from the reference design: a molar built from signed-distance shapes, meshed with
// marching cubes, then layered as a swirl-coloured core, an iridescent clear shell and a rim glow.
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type V3 = [number, number, number];

/* ---- signed distance helpers ---- */
const sph = (p: V3, c: V3, r: number) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r;
const ell = (p: V3, c: V3, r: V3) => {
  const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2];
  const k0 = Math.hypot(x, y, z), k1 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  return (k0 * (k0 - 1)) / (k1 || 1e-6);
};
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
const cone = (p: V3, a: V3, b: V3, r1: number, r2: number) => {
  const pa = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const bb = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
  let h = (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / bb;
  h = Math.min(1, Math.max(0, h));
  return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - (r1 + (r2 - r1) * h);
};

function molar(p: V3) {
  let d = ell(p, [0, 0.2, 0], [0.46, 0.3, 0.41]);
  for (const [x, z] of [[-0.21, -0.17], [0.21, -0.17], [-0.21, 0.18], [0.21, 0.18]]) d = smin(d, sph(p, [x, 0.4, z], 0.2), 0.16);
  d = smax(d, -sph(p, [0, 0.66, 0], 0.2), 0.14);
  d = smax(d, -cone(p, [-0.5, 0.6, 0], [0.5, 0.6, 0], 0.05, 0.05), 0.08);
  d = smin(d, ell(p, [0, -0.04, 0], [0.33, 0.2, 0.29]), 0.14);
  d = smin(d, cone(p, [-0.16, -0.02, 0], [-0.27, -0.82, 0.04], 0.17, 0.05), 0.12);
  d = smin(d, cone(p, [0.16, -0.02, 0], [0.25, -0.8, -0.04], 0.17, 0.05), 0.12);
  return d;
}

function sdfGeo(fn: (p: V3) => number, res: number) {
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 300000);
  mc.isolation = 0;
  const n = res, h = n / 2, f = mc.field;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    f[x + y * n + z * n * n] = -fn([(x - h) / h, (y - h) / h, (z - h) / h]);
  }
  mc.update();
  const c = mc.count, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute((mc.geometry.attributes.position.array as Float32Array).slice(0, c * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute((mc.geometry.attributes.normal.array as Float32Array).slice(0, c * 3), 3));
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

/* ---- dissolve: the tooth assembles from scattered fragments ---- */
const NOISE = `float dh(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float dn(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float dmask(vec3 p){return dn(p*5.0)*.65+dn(p*13.0)*.35;}`;

type Uniform = { value: number };

function addDissolve<M extends THREE.Material>(mat: M, dis: Uniform): M {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDis = dis;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDPos=position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDPos;uniform float uDis;\n' + NOISE)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(dmask(vDPos)>uDis)discard;');
  };
  mat.customProgramCacheKey = () => 'dissolve';
  return mat;
}

const rimMat = (color: number, power: number, strength: number, dis: Uniform) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, s: { value: strength }, uDis: dis },
    vertexShader:
      'varying vec3 vN;varying vec3 vV;varying vec3 vDPos;void main(){vDPos=position;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader:
      'uniform vec3 c;uniform float p,s,uDis;varying vec3 vN;varying vec3 vV;varying vec3 vDPos;' + NOISE +
      'void main(){if(dmask(vDPos)>uDis)discard;float f=pow(1.-abs(dot(vN,vV)),p)*s;gl_FragColor=vec4(c*f,f);}',
  });

function glassTooth(dis: Uniform) {
  const toothGeo = sdfGeo(molar, 60);
  const coreGeo = swirlColors(sdfGeo((p) => molar(p) + 0.07, 44), 0x0a2fb8, 0x3d8af7, 0xd8ecff);
  const g = new THREE.Group();
  const core = new THREE.Mesh(coreGeo, addDissolve(new THREE.MeshStandardMaterial({
    vertexColors: true, color: 0xffffff, emissive: 0x0b33c4, emissiveIntensity: 0.32, roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.95,
  }), dis));
  const shell = new THREE.Mesh(toothGeo, addDissolve(new THREE.MeshPhysicalMaterial({
    color: 0x8fbaff, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.34, clearcoat: 1, clearcoatRoughness: 0.04,
    iridescence: 0.7, iridescenceIOR: 1.35, envMapIntensity: 1.6, depthWrite: false, side: THREE.FrontSide,
  }), dis));
  const rim = new THREE.Mesh(toothGeo, rimMat(0x2d6fe0, 2.2, 0.7, dis));
  rim.scale.setScalar(1.003);
  core.renderOrder = 0; shell.renderOrder = 1; rim.renderOrder = 2;
  g.add(core, shell, rim);
  return g;
}

export type ToothOptions = {
  /** Skip motion: the tooth appears whole and still. */
  reduce?: boolean;
  /** ms from page start before the assemble animation begins (waits for the intro screen). */
  startAt?: number;
  /** Render one frame and stop (used to make the phone image). */
  still?: boolean;
  /** Called once if the device can't keep up (slow frames); the caller should fall back to the image. */
  onSlow?: () => void;
};

/** Mounts the animated tooth on a canvas. Returns a cleanup function. */
export function mountTooth(canvas: HTMLCanvasElement, opts: ToothOptions = {}) {
  const reduce = !!opts.reduce || !!opts.still;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.still });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4);
  const back = new THREE.PointLight(0x5aa0ff, 8, 10); back.position.set(-2, -1, 2);
  scene.add(key, back, new THREE.AmbientLight(0xbfd6ff, 0.6));

  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  cam.position.set(0, 0, 5.4); // same framing as the reference

  const dis: Uniform = { value: reduce ? 1.2 : -0.1 };
  const pivot = new THREE.Group();
  pivot.add(glassTooth(dis));
  scene.add(pivot);

  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);

  let mx = 0, my = 0;
  const onMove = (e: PointerEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
  addEventListener('pointermove', onMove, { passive: true });

  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; });
  io.observe(canvas);

  const start = reduce ? 0 : Math.max(performance.now(), opts.startAt ?? 0);
  const ease = (x: number) => 1 - Math.pow(1 - x, 4);
  let raf = 0;
  const frame = (now: number) => {
    const e = Math.max(0, Math.min(1, (now - start) / 1900));
    const k = reduce ? 1 : ease(e);
    const tt = reduce ? 0 : now / 1000;
    dis.value = reduce ? 1.2 : -0.1 + 1.3 * Math.min(1, Math.max(0, (now - start) / 1500));
    pivot.rotation.y = (1 - k) * -1.4 + Math.sin(tt * 0.45) * 0.45 + mx * 0.6 - 0.25;
    pivot.rotation.x = 0.12 + my * 0.25 + (1 - k) * 0.6;
    pivot.rotation.z = -0.12 + Math.sin(tt * 0.3) * 0.05;
    pivot.position.y = Math.sin(tt * 0.9) * 0.06 - (reduce ? 0 : scrollY * 0.0009);
    pivot.scale.setScalar(0.82 + 0.18 * k);
    renderer.render(scene, cam);
  };
  // Frame-time check, after a 30-frame warm-up (shader compiles make the first frames slow):
  // 30 visible frames averaging over 50 ms (under 20 fps) means the device can't keep up.
  const WARM = 30, SAMPLE = 30;
  let last = 0, seen = 0, slowSum = 0, reported = false;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) { last = 0; return; }
    if (last && !reported && seen < WARM + SAMPLE) {
      seen++;
      if (seen > WARM) slowSum += now - last;
      if (seen === WARM + SAMPLE && slowSum / SAMPLE > 50) { reported = true; opts.onSlow?.(); }
    }
    last = now;
    frame(now);
  };
  if (opts.still) frame(performance.now());
  else raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    removeEventListener('pointermove', onMove);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      }
    });
    env.dispose();
    pm.dispose();
    renderer.dispose();
  };
}
