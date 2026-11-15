// Draws the 3D brain on a canvas: a cloud of points that turns in space, with each zone
// tinted by the status of its signal. Drag to turn it, tap a zone to pick it. No library:
// the shape comes from brain-core.js and the drawing is a plain 2D canvas, so it works on a
// phone and with no connection. It is an illustration drawn by code, not a scan.

import { buildBrain, ZONES, VIEWS } from "./brain-core.js";

// the stage is always dark, so these are the glowing tones of the night look
const TONES = { normal: [143, 216, 196], watch: [255, 159, 90], act: [255, 123, 107], again: [143, 180, 255], none: [122, 140, 166], idle: [111, 184, 255] };
const SHADES = 10;
const BUCKETS = 48;
const LIGHT = (() => { const v = [0.35, 0.55, 0.76]; const l = Math.hypot(...v); return v.map((x) => x / l); })();

let cloud = null; // built once, shared by every mount
let skin = null;  // a dark disc stamped under every dot, so the near side hides the far side

function skinDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const d = c.getContext("2d");
  const g = d.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(7,14,27,1)"); g.addColorStop(0.7, "rgba(7,14,27,1)"); g.addColorStop(1, "rgba(7,14,27,0)");
  d.fillStyle = g;
  d.fillRect(0, 0, 32, 32);
  return c;
}

/**
 * mountBrain(canvas, { onPick }) -> { set({ zones, selected }), stop() }
 * zones: { frontal: "watch", ... }; selected: a list of zone names to bring forward, or null.
 */
export function mountBrain(canvas, { onPick } = {}) {
  cloud ??= buildBrain(1);
  skin ??= skinDot();
  const { n, pos, nrm, zone, shade } = cloud;
  const ctx = canvas.getContext("2d");
  const calm = () => document.documentElement.classList.contains("comfort-calm") || matchMedia("(prefers-reduced-motion: reduce)").matches;

  let status = {};
  let picked = null;
  let palette = [];
  let yaw = -1.1, pitch = 0.12;
  let goal = null;
  let drag = null;
  let seen = true;
  let raf = 0;
  let last = 0;
  let dirty = true;
  let W = 0, H = 0, dpr = 1;

  const sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n), lit = new Float32Array(n), face = new Float32Array(n);
  const order = new Uint32Array(n), count = new Uint32Array(BUCKETS + 1);

  // one soft round dot per zone and brightness, drawn once and stamped for every point
  function colours() {
    palette = ZONES.map((z) => {
      const [r, g, b] = TONES[status[z]] ?? TONES.idle;
      return Array.from({ length: SHADES }, (_, i) => {
        const k = 0.16 + 0.84 * (i / (SHADES - 1));
        const c = `${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)}`;
        const dot = document.createElement("canvas");
        dot.width = dot.height = 24;
        const d = dot.getContext("2d");
        const grad = d.createRadialGradient(12, 12, 0, 12, 12, 12);
        grad.addColorStop(0, `rgba(${c},1)`); grad.addColorStop(0.62, `rgba(${c},1)`); grad.addColorStop(1, `rgba(${c},0)`);
        d.fillStyle = grad;
        d.fillRect(0, 0, 24, 24);
        return dot;
      });
    });
  }

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w && h && (w !== W || h !== H)) { W = canvas.width = w; H = canvas.height = h; dirty = true; }
  }

  function draw(t) {
    if (!W || !H) return;
    const cy = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = Math.min(W, H * 1.08) * 0.47;
    const cx = W / 2, cyc = H * 0.47;
    count.fill(0);
    for (let i = 0, j = 0; i < n; i++, j += 3) {
      const x = pos[j], y = pos[j + 1], z = pos[j + 2];
      const x1 = x * cy + z * syw, z1 = -x * syw + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const persp = 3.4 / (3.4 - z2);
      sx[i] = cx + x1 * persp * scale;
      sy[i] = cyc - (y2 + 0.16) * persp * scale;
      sz[i] = z2;
      const nx = nrm[j], ny = nrm[j + 1], nz = nrm[j + 2];
      const nx1 = nx * cy + nz * syw, nz1 = -nx * syw + nz * cy;
      const ny2 = ny * cp - nz1 * sp, nz2 = ny * sp + nz1 * cp;
      face[i] = nz2;
      lit[i] = Math.max(0, nx1 * LIGHT[0] + ny2 * LIGHT[1] + nz2 * LIGHT[2]);
      count[Math.min(BUCKETS - 1, Math.max(0, Math.floor(((z2 + 1.15) / 2.3) * BUCKETS))) + 1]++;
    }
    for (let b = 1; b <= BUCKETS; b++) count[b] += count[b - 1];
    const next = count.slice(0, BUCKETS);
    for (let i = 0; i < n; i++) order[next[Math.min(BUCKETS - 1, Math.max(0, Math.floor(((sz[i] + 1.15) / 2.3) * BUCKETS)))]++] = i;

    ctx.clearRect(0, 0, W, H);
    const pulse = calm() ? 1 : 0.8 + 0.2 * Math.sin(t / 420);
    const dot = Math.max(3, scale / 48);
    for (let k = 0; k < n; k++) {
      const i = order[k];
      if (face[i] < -0.02) continue;                       // the far side is hidden, so the folds read as dark gaps
      const zi = zone[i];
      const name = ZONES[zi];
      const flagged = status[name] === "watch" || status[name] === "act";
      const chosen = picked?.includes(name);
      let light = (0.14 + 0.86 * lit[i] ** 0.85) * shade[i] * (0.55 + 0.45 * Math.min(1, face[i] * 2.2));
      if (flagged) light *= pulse;
      if (picked && !chosen) light *= 0.72;
      if (chosen) light = Math.min(1, light * 1.2 + 0.06);
      const s = dot * (3.4 / (3.4 - sz[i])) * (chosen ? 1.1 : 1);
      ctx.drawImage(skin, sx[i] - s * 0.95, sy[i] - s * 0.95, s * 1.9, s * 1.9);
      ctx.drawImage(palette[zi][Math.min(SHADES - 1, Math.round(light * (SHADES - 1)))], sx[i] - s / 2, sy[i] - s / 2, s, s);
    }
  }

  function frame(t) {
    raf = 0;
    if (!canvas.isConnected) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    const still = calm();
    if (goal && !drag) {
      const target = goal[0] + (still ? 0 : 0.22 * Math.sin(t / 1700)); // a slow sway so it still reads as 3D
      const dy = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
      const k = still ? 1 : Math.min(1, dt * 4);
      yaw += dy * k;
      pitch += (goal[1] - pitch) * k;
      dirty = true;
    } else if (!drag && !still) { yaw += dt * 0.28; dirty = true; }
    const flagged = Object.values(status).some((s) => s === "watch" || s === "act");
    if (dirty || (flagged && !still)) { draw(t); dirty = false; }
    if (seen && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && canvas.isConnected) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  function pick(e) {
    const box = canvas.getBoundingClientRect();
    const px = (e.clientX - box.left) * dpr, py = (e.clientY - box.top) * dpr;
    let best = -1, bestD = (26 * dpr) ** 2;
    for (let i = 0; i < n; i++) {
      if (face[i] <= 0) continue;
      const d = (sx[i] - px) ** 2 + (sy[i] - py) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) onPick?.(ZONES[zone[best]]);
  }

  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw, pitch, moved: false };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    yaw = drag.yaw + dx * 0.011;
    pitch = Math.max(-0.7, Math.min(0.7, drag.pitch + dy * 0.008));
    goal = null;
    dirty = true;
    wake();
  });
  const drop = (e) => { if (drag && !drag.moved && e.type === "pointerup") pick(e); drag = null; };
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", drop);

  const ro = new ResizeObserver(() => { size(); wake(); });
  ro.observe(canvas);
  const io = new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen) wake(); });
  io.observe(canvas);
  document.addEventListener("visibilitychange", wake);

  size();
  colours();
  wake();

  return {
    set({ zones = status, selected = picked } = {}) {
      status = zones;
      picked = selected?.length ? selected : null;
      goal = picked ? VIEWS[picked[0]] : null;
      colours();
      dirty = true;
      wake();
    },
    stop() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", wake); }
  };
}
