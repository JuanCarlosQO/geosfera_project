// A small WebGL viewer for the realistic 3D brain (day look). No library: one textured mesh,
// one shader. The model turns by drag, sways by itself, and each zone can be tinted by the
// status of its signal while the folds stay visible. Labels placed in 3D are reported back
// every frame so the page can pin HTML buttons on the model.
// The mesh (assets/brain3d.bin) and its texture were GENERATED WITH AI from a picture (see
// docs/SOURCES.md): an illustration, not a scan. Format of the .bin, written by the team's
// converter: "EBR1", vertex count, index count, box min xyz, box max xyz, then per vertex
// position (3 x uint16 inside the box), normal (3 x int8 + 1 pad), uv (2 x uint16), then
// uint16 indices.

const VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUv; attribute float aZone; attribute float aWeight;
uniform mat4 uMvp; uniform mat3 uRot;
varying vec3 vN; varying vec2 vUv; varying float vZone; varying float vWeight;
void main() { vN = uRot * aNrm; vUv = aUv; vZone = aZone; vWeight = aWeight; gl_Position = uMvp * vec4(aPos, 1.0); }`;

const FS = `
precision mediump float;
uniform sampler2D uTex; uniform vec4 uTint[6];
varying vec3 vN; varying vec2 vUv; varying float vZone; varying float vWeight;
void main() {
  vec3 n = normalize(vN);
  float diffuse = max(dot(n, normalize(vec3(0.35, 0.6, 0.72))), 0.0);
  vec3 col = texture2D(uTex, vUv).rgb * (0.56 + 0.56 * diffuse);
  vec4 tint = vec4(0.0);
  for (int i = 0; i < 6; i++) { if (abs(vZone - float(i)) < 0.5) tint = uTint[i]; }
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, tint.rgb * (lum * 1.3 + 0.1), tint.a * vWeight);   // recolour, keep the light and shade
  col += pow(1.0 - max(n.z, 0.0), 3.0) * 0.07;
  gl_FragColor = vec4(col, 1.0);
}`;

/* 4 x 4 matrices, column-major, just what the viewer needs */
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
const perspective = (fov, aspect, near, far) => { const f = 1 / Math.tan(fov / 2); return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]); };
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const move = (z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1]);

const TINT = { watch: [1, 0.52, 0.1, 0.82], act: [0.9, 0.12, 0.16, 0.86], again: [0.3, 0.5, 0.95, 0.7], none: [0.6, 0.63, 0.68, 0.75] };
const FOV = 0.5, DIST = 3.25;

/**
 * Reads the mesh file. The model's own axes are x across, y up, z along its length; the viewer
 * wants it lying the way the picture shows it: length across the screen, front to the left.
 * Returns positions scaled so the longest half-extent is 1, plus side-view coordinates
 * (u: 0 front to 1 back, v: 0 top to 1 bottom) used to place zones and labels.
 */
export function readMesh(buffer) {
  const dv = new DataView(buffer);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== "EBR1") throw new Error("not a brain mesh");
  const n = dv.getUint32(4, true), ni = dv.getUint32(8, true);
  const min = [0, 1, 2].map((k) => dv.getFloat32(12 + k * 4, true)), max = [0, 1, 2].map((k) => dv.getFloat32(24 + k * 4, true));
  const half = Math.max(...[0, 1, 2].map((k) => (max[k] - min[k]) / 2));
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), side = new Float32Array(n * 2);
  let o = 36;
  for (let i = 0; i < n; i++, o += 14) {
    const q = [0, 1, 2].map((k) => dv.getUint16(o + k * 2, true) / 65535);          // 0..1 inside the box
    const p = [0, 1, 2].map((k) => ((q[k] - 0.5) * (max[k] - min[k])) / half);      // centred, longest half = 1
    // lay it like the picture: screen x = the model's length (front to the left), depth = its width
    pos[i * 3] = -p[2]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[0];
    nrm[i * 3] = -dv.getInt8(o + 8) / 127; nrm[i * 3 + 1] = dv.getInt8(o + 7) / 127; nrm[i * 3 + 2] = dv.getInt8(o + 6) / 127;
    uv[i * 2] = dv.getUint16(o + 10, true) / 65535; uv[i * 2 + 1] = dv.getUint16(o + 12, true) / 65535;
    side[i * 2] = 1 - q[2]; side[i * 2 + 1] = 1 - q[1];
  }
  const idx = new Uint16Array(buffer.slice(o, o + ni * 2));
  return { n, pos, nrm, uv, side, idx, extent: [(max[2] - min[2]) / 2 / half, (max[1] - min[1]) / 2 / half] };
}

/** Which zone each vertex belongs to, and how strongly: zonesAt gives ellipses [cx, cy, rx, ry] in side-view 0..100. */
export function paintZones(side, n, names, zonesAt) {
  const zone = new Float32Array(n), weight = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = side[i * 2] * 100, y = side[i * 2 + 1] * 100;
    let best = 0, bestD = Infinity;
    names.forEach((name, k) => { const [cx, cy, rx, ry] = zonesAt[name]; const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < bestD) { bestD = d; best = k; } });
    zone[i] = best;
    weight[i] = Math.max(0, Math.min(1, (1.9 - bestD) / 1.1)); // full inside the ellipse, fading out just beyond it
  }
  return { zone, weight };
}

/**
 * mountBrainGl(canvas, { mesh, texture, zones, zonesAt, pinsAt, onFrame })
 * Resolves to { set({ zones }), stop() }, or rejects when WebGL or the files are not there
 * (the page then keeps its still picture).
 * onFrame(points): where each pin is on screen this frame, { id: [x %, y %] }.
 */
export async function mountBrainGl(canvas, { mesh, texture, zones: names, zonesAt, pinsAt = {}, onFrame }) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
  if (!gl) throw new Error("no WebGL");
  const [buffer, image] = await Promise.all([
    fetch(mesh).then((r) => { if (!r.ok) throw new Error("mesh"); return r.arrayBuffer(); }),
    new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("texture")); im.src = texture; })
  ]);
  const m = readMesh(buffer);
  const painted = paintZones(m.side, m.n, names, zonesAt);

  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader"); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
  gl.useProgram(prog);
  const attr = (name, data, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
  attr("aPos", m.pos, 3); attr("aNrm", m.nrm, 3); attr("aUv", m.uv, 2); attr("aZone", painted.zone, 1); attr("aWeight", painted.weight, 1);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  const U = { mvp: gl.getUniformLocation(prog, "uMvp"), rot: gl.getUniformLocation(prog, "uRot"), tint: gl.getUniformLocation(prog, "uTint") };

  const calm = () => document.documentElement.classList.contains("comfort-calm") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  let status = {};
  let yaw = 0, pitch = 0.06, home = 0;   // home: the yaw the sway turns around
  let drag = null, heldUntil = 0, swayFrom = 0, raf = 0, seen = true, stopped = false;

  // a label's place in the model: on the middle plane, at its side-view spot
  const pinPoints = Object.entries(pinsAt).map(([id, [x, y]]) => [id, [(x / 100 - 0.5) * 2 * m.extent[0], (0.5 - y / 100) * 2 * m.extent[1], 0]]);

  function size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw(t) {
    size();
    if (!canvas.width) return;
    const still = calm();
    if (!drag && !still && t > heldUntil) yaw = home + 0.62 * Math.sin((t - swayFrom) / 2300); // starts from where it was left, no jump
    const tilt = pitch + (still || drag ? 0 : 0.05 * Math.sin(t / 3100));
    const rot = mul(rotX(tilt), rotY(yaw));
    const aspect = canvas.width / canvas.height;
    const mvp = mul(perspective(FOV, aspect, 0.1, 20), mul(move(-DIST), rot));
    gl.uniformMatrix4fv(U.mvp, false, mvp);
    gl.uniformMatrix3fv(U.rot, false, new Float32Array([rot[0], rot[1], rot[2], rot[4], rot[5], rot[6], rot[8], rot[9], rot[10]]));
    const pulse = still ? 1 : 0.78 + 0.22 * Math.sin(t / 420);
    const tints = new Float32Array(24);
    names.forEach((name, k) => { const c = TINT[status[name]]; if (!c) return; const flagged = status[name] === "watch" || status[name] === "act"; tints.set([c[0], c[1], c[2], c[3] * (flagged ? pulse : 1)], k * 4); });
    gl.uniform4fv(U.tint, tints);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, m.idx.length, gl.UNSIGNED_SHORT, 0);
    if (onFrame) {
      const out = {};
      for (const [id, p] of pinPoints) {
        const x = mvp[0] * p[0] + mvp[4] * p[1] + mvp[8] * p[2] + mvp[12], y = mvp[1] * p[0] + mvp[5] * p[1] + mvp[9] * p[2] + mvp[13], w = mvp[3] * p[0] + mvp[7] * p[1] + mvp[11] * p[2] + mvp[15];
        out[id] = [(x / w * 0.5 + 0.5) * 100, (0.5 - y / w * 0.5) * 100];
      }
      onFrame(out);
    }
  }

  function frame(t) {
    raf = 0;
    if (stopped || !canvas.isConnected) return;
    draw(t);
    if (seen && !document.hidden && (!calm() || drag)) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && !stopped && canvas.isConnected) raf = requestAnimationFrame(frame); };

  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; canvas.setPointerCapture?.(e.pointerId); wake(); });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.011;
    pitch = Math.max(-0.9, Math.min(0.9, drag.pitch + (e.clientY - drag.y) * 0.008));
    wake();
  });
  const drop = () => { if (!drag) return; drag = null; home = yaw; heldUntil = performance.now() + 2500; swayFrom = heldUntil; wake(); };
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", drop);
  const ro = new ResizeObserver(wake);
  ro.observe(canvas);
  const io = new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen) wake(); });
  io.observe(canvas);
  document.addEventListener("visibilitychange", wake);
  wake();

  return {
    set({ zones = status } = {}) { status = zones; wake(); },
    stop() { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", wake); }
  };
}
