(() => {
'use strict';

/* Impossible Twist
 *
 * A lattice of cubes and stairs drawn with plain WebGL through a true
 * isometric camera. The camera looks down the (1,1,1) diagonal and every face
 * is lit by its direction alone, so floors that are whole levels apart meet
 * without a seam whenever the world rests in one of its 24 cube orientations.
 * Twist it and the seams open up.
 */

const HALF_PI = Math.PI / 2;
const STEPS = 5;          // treads per stair cell

/* ---------- vectors & matrices ---------- */

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mad = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const neg = a => [-a[0], -a[1], -a[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function mul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
function rotM(axis, t) {
  const c = Math.cos(t), s = Math.sin(t);
  return axis === 0 ? [1, 0, 0, 0, c, -s, 0, s, c]
       : axis === 1 ? [c, 0, s, 0, 1, 0, -s, 0, c]
       :              [c, -s, 0, s, c, 0, 0, 0, 1];
}
const snapM = m => m.map(v => Math.round(v) + 0);

/* ---------- the structures ---------- */

// Each structure is a list of parts on a lattice of unit cells:
//   ['cube', x, y, z]                       one cell
//   ['line', x0, y0, z0, x1, y1, z1]        a straight run of cells
//   ['box',  x0, y0, z0, x1, y1, z1]        a filled block
//   ['void', x0, y0, z0, x1, y1, z1]        cells cut back out
//   ['stair', x, y, z, rise, run]           a stair cell climbing `rise` as it goes `run`
//   ['open', x, y, z, normal]               one face of a cube left off
// With `sym`, every part is repeated three times around the camera diagonal,
// so each way up has its own floors, pillars and stairs.

const UP = [0, 1, 0];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const STRUCTURES = [
  {
    name: 'Cloister',
    theme: 'A ring of walks around a court, tied together by three flights of stairs.',
    sym: true,
    parts: [
      ['line', -3, -3, 3, 3, -3, 3],      // outer ring: a skew hexagon around the cube
      ['line', 3, -3, -3, 3, -3, 3],
      ['line', -3, 0, 0, -3, 0, 3],       // middle walk, where the stairs arrive
      ['line', 2, -1, 1, 2, -1, 3],       // inner ledges and posts
      ['line', 1, -1, -1, 1, 1, -1],
      ['line', -1, 2, -1, -3, 2, -1],
      ['cube', 0, 1, -3],
      ['cube', 1, -3, 2],                 // landing
      ['stair', 0, -2, 2, UP, [-1, 0, 0]],
      ['stair', -1, -1, 2, UP, [-1, 0, 0]],
      ['stair', -2, 0, 2, UP, [-1, 0, 0]],
    ],
  },
  {
    name: 'Tribar',
    theme: 'The Penrose triangle: three straight beams and three right angles that still close.',
    parts: [
      // An open chain: along x, up y, forward z. Its two loose ends are five
      // cells apart along the camera diagonal, so from the front they coincide.
      ['line', -4, -2, -1, 1, -2, -1],
      ['line', 1, -2, -1, 1, 3, -1],
      ['line', 1, 3, -1, 1, 3, 3],
      ['open', 1, 3, 3, [0, 0, 1]],       // no end cap, so the far beam shows through the join
    ],
  },
  {
    name: 'Tessellation',
    theme: 'A slope of cubes that reads as steps rising, or as steps hanging overhead.',
    parts: (() => {
      const out = [];
      for (const x of range(-3, 3)) for (const y of range(-3, 3)) for (const z of range(-3, 3))
        if (x + y + z === 0 || x + y + z === -1) out.push(['cube', x, y, z]);
      return out;
    })(),
  },
  {
    name: 'Relativity',
    theme: 'After Escher\u2019s Relativity: one room, three floors, each with its own idea of down.',
    sym: true,
    parts: [
      ['box', -3, -3, -3, 3, -3, 3],      // a floor; repeated, it becomes two walls as well
      ['void', -3, 1, 1, -3, 2, 1],       // a doorway at the head of the stairs
      ['stair', 0, -2, 1, UP, [-1, 0, 0]],
      ['stair', -1, -1, 1, UP, [-1, 0, 0]],
      ['stair', -2, 0, 1, UP, [-1, 0, 0]],
    ],
  },
  {
    name: 'Lattice',
    theme: 'After Escher\u2019s Cubic Space Division: beams running every way at once.',
    parts: (() => {
      const out = [];
      for (const a of [-3, 0, 3]) for (const b of [-3, 0, 3]) {
        out.push(['line', -3, a, b, 3, a, b], ['line', a, -3, b, a, 3, b], ['line', a, b, -3, a, b, 3]);
      }
      return out;
    })(),
  },
  {
    name: 'Spire',
    theme: 'A stair winding around a single column, one landing at every corner.',
    parts: (() => {
      const out = [['box', -2, -3, -2, 2, -3, 2], ['line', 0, -3, 0, 0, 3, 0]];
      const corners = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
      const edges = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      const runs = [[0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0]];
      for (let i = 0; i <= 5; i++) {
        const c = corners[i % 4];
        out.push(['cube', c[0], -3 + i, c[1]]);
        if (i < 5) out.push(['stair', edges[i % 4][0], -2 + i, edges[i % 4][1], UP, runs[i % 4]]);
      }
      return out;
    })(),
  },
  {
    name: 'Aqueduct',
    theme: 'After Escher\u2019s Waterfall: a level channel that ends two storeys above where it began.',
    parts: [
      // The channel stays on one level. Each corner sits four cells back
      // along the camera diagonal from the top of a post, so from the front the
      // posts seem to carry it upward.
      ['line', 4, 1, 4, 0, 1, 4],
      ['line', 0, 1, 4, 0, 1, 0],
      ['line', 0, 1, 0, -4, 1, 0],
      ['line', -4, 1, 0, -4, 1, -4],
      ['line', 4, 2, 4, 4, 4, 4], ['open', 4, 4, 4, UP],
      ['line', 0, 2, 4, 0, 4, 4], ['open', 0, 4, 4, UP],
      ['line', 0, 2, 0, 0, 4, 0], ['open', 0, 4, 0, UP],
      ['line', 4, -2, 4, 4, 0, 4],       // footings for the two towers
      ['line', 0, -2, 4, 0, 0, 4],
    ],
  },
  {
    name: 'Ascent',
    theme: 'After Escher\u2019s Ascending and Descending: four flights that climb all the way round to where they began.',
    parts: [
      // Really a rising spiral. Its last step ends four cells nearer the camera
      // than its first landing, straight along the diagonal, so they coincide.
      ['line', -3, -2, -3, 1, -2, -3], ['stair', 2, -1, -3, UP, [1, 0, 0]],
      ['line', 3, -1, -3, 3, -1, 1],   ['stair', 3, 0, 2, UP, [0, 0, 1]],
      ['cube', 3, 0, 3],               ['stair', 2, 1, 3, UP, [-1, 0, 0]],
      ['cube', 1, 1, 3],               ['stair', 1, 2, 2, UP, [0, 0, -1]],
      ['cube', -3, -3, -3],            // a pier under each corner
      ['line', 3, -3, -3, 3, -2, -3],
      ['line', 3, -3, 3, 3, -1, 3],
      ['line', 1, -3, 3, 1, 0, 3],
    ],
  },
  {
    name: 'Crossing',
    theme: 'After Monument Valley: a bridge that runs level from a tall tower to the top of a short one.',
    parts: [
      ['line', 3, -3, 2, 3, 3, 2],        // the tall tower, nearest the camera
      ['line', 2, 3, 2, 1, 3, 2],         // its bridge stops in mid-air
      // Three levels lower and far behind: the walk the bridge seems to join.
      ['line', -3, 0, -1, -3, 0, -3],
      ['line', -3, 0, -3, 0, 0, -3],
      ['line', -3, -3, -3, -3, -1, -3],   // the short tower
      ['line', 0, -3, -3, 0, -1, -3],
      ['stair', 1, 1, -3, UP, [1, 0, 0]], // up to a lookout
      ['line', 2, 1, -3, 3, 1, -3],
      ['line', 3, -3, -3, 3, 0, -3],
      ['cube', 3, 2, -3],
    ],
  },
];

/* ---------- geometry ---------- */

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const SYM = [v => [v[0], v[1], v[2]], v => [v[2], v[0], v[1]], v => [v[1], v[2], v[0]]];
const K = p => p[0] + ',' + p[1] + ',' + p[2];
const unit = k => [k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function buildStructure(def) {
  const cubes = new Map(), stairs = new Map(), open = new Set();
  const hasCube = p => cubes.has(K(p));
  const each = (m, fn) => {
    for (const x of range(Math.min(m[1], m[4]), Math.max(m[1], m[4])))
      for (const y of range(Math.min(m[2], m[5]), Math.max(m[2], m[5])))
        for (const z of range(Math.min(m[3], m[6]), Math.max(m[3], m[6]))) fn([x, y, z]);
  };
  const syms = def.sym ? SYM : SYM.slice(0, 1);
  for (const pass of ['solid', 'cut']) {
    for (const s of syms) for (const m of def.parts) {
      const t = m[0];
      if (pass === 'solid') {
        if (t === 'cube') { const p = s([m[1], m[2], m[3]]); cubes.set(K(p), p); }
        else if (t === 'line' || t === 'box') each(m, q => { const p = s(q); cubes.set(K(p), p); });
      } else {
        if (t === 'void') each(m, q => cubes.delete(K(s(q))));
        else if (t === 'stair') { const p = s([m[1], m[2], m[3]]); stairs.set(K(p), { c: p, a: s(m[4]), b: s(m[5]) }); }
        else if (t === 'open') open.add(K(s([m[1], m[2], m[3]])) + '|' + K(s(m[4])));
      }
    }
  }
  for (const k of stairs.keys()) cubes.delete(k);

  const verts = [];   // x, y, z, nx, ny, nz
  const corners = new Map();
  const quad = (o, eu, ev, n) => {
    if (dot(cross(eu, ev), n) < 0) { const t = eu; eu = ev; ev = t; }   // wind to face along n
    const p = [o, add(o, eu), add(add(o, eu), ev), add(o, ev)];
    for (const i of [0, 1, 2, 0, 2, 3]) verts.push(p[i][0], p[i][1], p[i][2], n[0], n[1], n[2]);
    for (const q of p) corners.set(K(q), q);
  };

  for (const c of cubes.values()) {
    for (const n of DIRS) {
      if (hasCube(add(c, n)) || open.has(K(c) + '|' + K(n))) continue;
      const ax = n[0] ? 0 : n[1] ? 1 : 2;
      const u = unit((ax + 1) % 3), v = unit((ax + 2) % 3);
      quad(mad(mad(mad(c, n, 0.5), u, -0.5), v, -0.5), u, v, n);
    }
  }
  for (const { c, a, b } of stairs.values()) {
    const w = cross(a, b);
    const P = (s, h, t) => [
      c[0] + b[0] * s + a[0] * h + w[0] * t,
      c[1] + b[1] * s + a[1] * h + w[1] * t,
      c[2] + b[2] * s + a[2] * h + w[2] * t,
    ];
    const sideP = !hasCube(add(c, w)), sideN = !hasCube(sub(c, w));
    for (let i = 0; i < STEPS; i++) {
      const s0 = -0.5 + i / STEPS, h0 = s0, h1 = h0 + 1 / STEPS;
      quad(P(s0, h1, -0.5), scl(b, 1 / STEPS), w, a);            // tread
      quad(P(s0, h0, -0.5), scl(a, 1 / STEPS), w, neg(b));       // riser
      if (sideP) quad(P(s0, -0.5, 0.5), scl(b, 1 / STEPS), scl(a, h1 + 0.5), w);
      if (sideN) quad(P(s0, -0.5, -0.5), scl(b, 1 / STEPS), scl(a, h1 + 0.5), neg(w));
    }
    if (!hasCube(add(c, b))) quad(P(0.5, -0.5, -0.5), a, w, b);
    if (!hasCube(sub(c, a))) quad(P(-0.5, -0.5, -0.5), b, w, neg(a));
  }

  // Pivot about the middle of the structure's bounding box.
  const pts = [...corners.values()], mid = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const v = pts.map(q => q[k]);
    mid[k] = (Math.min(...v) + Math.max(...v)) / 2;
  }
  let radius = 0;
  const points = new Float32Array(pts.length * 3);
  pts.forEach((q, i) => {
    for (let k = 0; k < 3; k++) points[i * 3 + k] = q[k] - mid[k];
    radius = Math.max(radius, Math.hypot(q[0] - mid[0], q[1] - mid[1], q[2] - mid[2]));
  });
  for (let i = 0; i < verts.length; i += 6) for (let k = 0; k < 3; k++) verts[i + k] -= mid[k];
  return { data: new Float32Array(verts), count: verts.length / 6, points, radius: Math.max(radius, 5) + 0.6 };
}

/* ---------- WebGL ---------- */

const canvas = document.getElementById('c');
const hint = document.getElementById('hint');
const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
if (!gl) { document.getElementById('title').textContent = 'WebGL is not available'; return; }

const VS = `
attribute vec3 aPos;
attribute vec3 aNormal;
uniform mat3 uRot;
uniform vec2 uScale;
uniform vec2 uCentre;
varying vec3 vNormal;
void main() {
  vec3 v = uRot * aPos;
  vNormal = uRot * aNormal;
  // true isometric: right is (1,0,-1), up is (-1,2,-1), depth runs along (1,1,1)
  gl_Position = vec4(
    ((v.x - v.z) * 0.70710678 - uCentre.x) * uScale.x,
    ((2.0 * v.y - v.x - v.z) * 0.40824829 - uCentre.y) * uScale.y + 0.09,
    -(v.x + v.y + v.z) * 0.04,   // keeps structures up to 14 cells deep inside the clip range
    1.0);
}`;
const FS = `
precision mediump float;
varying vec3 vNormal;
void main() {
  // A single light fixed to the camera, tuned so that at rest every floor is
  // white, every left wall mid grey and every right wall dark.
  vec3 n = normalize(vNormal);
  float tone = clamp(-0.2 + dot(n, vec3(0.45, 1.20, 0.80)), 0.1, 1.0);
  gl_FragColor = vec4(vec3(tone), 1.0);
}`;

function shader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
const aPos = gl.getAttribLocation(prog, 'aPos'), aNormal = gl.getAttribLocation(prog, 'aNormal');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
gl.enableVertexAttribArray(aNormal);
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 24, 12);
const uRot = gl.getUniformLocation(prog, 'uRot'), uScale = gl.getUniformLocation(prog, 'uScale');
const uCentre = gl.getUniformLocation(prog, 'uCentre');
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);   // faces are one-sided, so an open beam end is a window, not a dark box

const built = STRUCTURES.map(buildStructure);
let current = 0;
gl.clearColor(0, 0, 0, 0);

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(innerWidth * dpr)), h = Math.max(1, Math.round(innerHeight * dpr));
  canvas.width = w; canvas.height = h;
  gl.viewport(0, 0, w, h);
  const m = Math.min(w, h), r = built[current].radius;
  gl.uniform2f(uScale, 0.92 * m / w / r, 0.92 * m / h / r);
}

/* ---------- twisting ---------- */

let Rs = [1, 0, 0, 0, 1, 0, 0, 0, 1];   // the orientation the world last snapped to
let rot = null;                          // { axis, angle, phase: 'drag' | 'snap', a0, a1, t, dur }

const easeOut = t => 1 - Math.pow(1 - t, 3);

function commitTwist() {
  const n = Math.round(rot.a1 / HALF_PI);
  Rs = snapM(mul(rotM(rot.axis, n * HALF_PI), Rs));
  rot = null;
  if (((n % 4) + 4) % 4 !== 0) hint.classList.add('done');
}

function twist(axis, quarterTurns) {
  if (rot) return;
  rot = { axis, angle: 0, phase: 'snap', a0: 0, a1: quarterTurns * HALF_PI, t: 0, dur: 0.55 };
}

let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (rot && rot.phase === 'snap') {
    rot.t = Math.min(1, rot.t + dt / rot.dur);
    rot.angle = rot.a0 + (rot.a1 - rot.a0) * easeOut(rot.t);
    if (rot.t >= 1) commitTwist();
  }
  const R = rot ? mul(rotM(rot.axis, rot.angle), Rs) : Rs;
  gl.uniformMatrix3fv(uRot, false, [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]);

  // Keep whatever is showing in the middle of the frame, whichever way it faces.
  const pts = built[current].points;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const vx = R[0] * pts[i] + R[1] * pts[i + 1] + R[2] * pts[i + 2];
    const vy = R[3] * pts[i] + R[4] * pts[i + 1] + R[5] * pts[i + 2];
    const vz = R[6] * pts[i] + R[7] * pts[i + 1] + R[8] * pts[i + 2];
    const sx = (vx - vz) * 0.70710678, sy = (2 * vy - vx - vz) * 0.40824829;
    if (sx < x0) x0 = sx; if (sx > x1) x1 = sx;
    if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
  }
  gl.uniform2f(uCentre, (x0 + x1) / 2, (y0 + y1) / 2);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, built[current].count);
  requestAnimationFrame(frame);
}

/* ---------- switching structures ---------- */

const elName = document.getElementById('s-name');
const elTheme = document.getElementById('s-theme');
const elCount = document.getElementById('s-count');
const pad = n => String(n).padStart(2, '0');
let switching = 0;

function show(i) {
  current = ((i % built.length) + built.length) % built.length;
  gl.bufferData(gl.ARRAY_BUFFER, built[current].data, gl.STATIC_DRAW);
  Rs = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  rot = null;
  press = null;
  resize();
  elName.textContent = STRUCTURES[current].name;
  elTheme.textContent = STRUCTURES[current].theme;
  elCount.textContent = pad(current + 1) + ' / ' + pad(built.length);
}

// Fade out, swap the structure while nothing is visible, fade back in.
function select(i) {
  clearTimeout(switching);
  canvas.classList.add('swap');
  switching = setTimeout(() => { show(i); canvas.classList.remove('swap'); }, 180);
}
document.getElementById('s-prev').addEventListener('click', () => select(current - 1));
document.getElementById('s-next').addEventListener('click', () => select(current + 1));

/* ---------- input ---------- */

let press = null;
const quarterPx = () => Math.min(260, Math.max(110, Math.min(innerWidth, innerHeight) * 0.3));

function dragAngle(e) {
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  const d = rot.axis === 1 ? dx : rot.axis === 2 ? -dy : dy;
  return d / quarterPx() * HALF_PI;
}

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  if (rot && rot.phase === 'snap') commitTwist();
  press = { x: e.clientX, y: e.clientY, id: e.pointerId, la: 0, lt: e.timeStamp, vel: 0 };
});

canvas.addEventListener('pointermove', e => {
  if (!press || e.pointerId !== press.id) return;
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  if (!rot && Math.hypot(dx, dy) > 6) {
    // Sideways turns the world about its upright axis. Up and down tips it,
    // rolling whichever flank of the cube is under the pointer.
    const axis = Math.abs(dx) >= Math.abs(dy) ? 1 : (press.x > innerWidth / 2 ? 2 : 0);
    rot = { axis, angle: 0, phase: 'drag' };
    canvas.classList.add('dragging');
  }
  if (rot && rot.phase === 'drag') {
    const a = dragAngle(e), t = e.timeStamp;
    if (t > press.lt) press.vel = press.vel * 0.5 + 0.5 * (a - press.la) / ((t - press.lt) / 1000);
    press.la = a; press.lt = t;
    rot.angle = a;
  }
});

function release(e) {
  if (!press || e.pointerId !== press.id) return;
  const p = press;
  press = null;
  canvas.classList.remove('dragging');
  if (rot && rot.phase === 'drag') {
    const stale = e.timeStamp - p.lt > 120;
    const aim = rot.angle + (stale ? 0 : Math.max(-0.6, Math.min(0.6, p.vel * 0.1)));
    const a1 = Math.round(aim / HALF_PI) * HALF_PI;
    rot.phase = 'snap';
    rot.a0 = rot.angle; rot.a1 = a1; rot.t = 0;
    rot.dur = 0.25 + 0.35 * Math.min(1, Math.abs(a1 - rot.angle) / (Math.PI / 4));
  }
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

/* ---------- help ---------- */

const help = document.getElementById('help');
const helpBtn = document.getElementById('help-btn');
const helpClose = document.getElementById('help-close');

function setHelp(open) {
  help.classList.toggle('open', open);
  help.setAttribute('aria-hidden', String(!open));
  (open ? helpClose : helpBtn).focus();
}
helpBtn.addEventListener('click', () => setHelp(!help.classList.contains('open')));
helpClose.addEventListener('click', () => setHelp(false));
document.getElementById('help-x').addEventListener('click', () => setHelp(false));
help.addEventListener('pointerdown', e => { if (e.target === help) setHelp(false); });

addEventListener('keydown', e => {
  const k = e.key, open = help.classList.contains('open');
  if (k === '?' || k === 'h' || k === 'H') { setHelp(!open); e.preventDefault(); return; }
  if (open) {
    if (k === 'Escape') { setHelp(false); e.preventDefault(); }
    return;
  }
  if (k === 'n' || k === 'N' || k === ']') { select(current + 1); return; }
  if (k === 'p' || k === 'P' || k === '[') { select(current - 1); return; }
  if (k >= '1' && k <= '9' && +k <= built.length) { select(+k - 1); return; }
  if (k === 'ArrowLeft') twist(1, -1);
  else if (k === 'ArrowRight') twist(1, 1);
  else if (k === 'ArrowUp') twist(e.shiftKey ? 2 : 0, e.shiftKey ? 1 : -1);
  else if (k === 'ArrowDown') twist(e.shiftKey ? 2 : 0, e.shiftKey ? -1 : 1);
  else return;
  e.preventDefault();
});

addEventListener('resize', resize);
show(0);
requestAnimationFrame(frame);

window.__twist = { twist, select, get R() { return Rs; }, get current() { return current; } };

})();
