// Draws the DNA double helix on a canvas: it turns slowly, and streaks cross it in step with
// the live radiation dose rate. Where a streak crosses, a rung flashes and fades back. The
// streaks are a picture of the idea (more radiation, more particle tracks through a cell):
// they are not counted particles and the flashes are not damage measured in anyone.
// No library; the shape comes from helix-core.js.

import { buildHelix, tracksPerSecond } from "./helix-core.js";

const COLOURS = [[111, 184, 255], [143, 216, 196], [196, 170, 255], [255, 200, 120]]; // strand A, strand B, the two bases
const HOT = [255, 110, 96];
const SHADES = 8;
const FLASH_S = 2.4;   // how long a rung glows after a streak
const STREAK_S = 0.5;

let helix = null;
let sprites = null;

function dot(r, g, b) {
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const d = c.getContext("2d");
  const grad = d.createRadialGradient(12, 12, 0, 12, 12, 12);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`); grad.addColorStop(0.6, `rgba(${r},${g},${b},1)`); grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  d.fillStyle = grad;
  d.fillRect(0, 0, 24, 24);
  return c;
}
const shade = ([r, g, b], k) => dot(Math.round(r * k), Math.round(g * k), Math.round(b * k));

/** mountHelix(canvas) -> { set({ rate, usual }), stop() } */
export function mountHelix(canvas) {
  helix ??= buildHelix();
  sprites ??= { base: COLOURS.map((c) => Array.from({ length: SHADES }, (_, i) => shade(c, 0.25 + 0.75 * (i / (SHADES - 1))))), hot: dot(...HOT) };
  const { n, pairs, pos, kind, rung } = helix;
  const ctx = canvas.getContext("2d");
  const calm = () => document.documentElement.classList.contains("comfort-calm") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heat = new Float32Array(pairs); // 1 just after a streak, fading to 0
  const sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n);
  const order = Array.from({ length: n }, (_, i) => i);
  let streaks = [];
  let perSecond = 0, owed = 0;
  let yaw = 0.4, raf = 0, last = 0, seen = true, W = 0, H = 0, dpr = 1;
  const TILT = 1.12; // the helix lies almost on its side, which fits a wide stage

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w && h && (w !== W || h !== H)) { W = canvas.width = w; H = canvas.height = h; }
  }

  function project(x, y, z, scale) {
    const cy = Math.cos(yaw), syw = Math.sin(yaw);
    const x1 = x * cy + z * syw, z1 = -x * syw + z * cy;
    const x2 = x1 * Math.cos(TILT) - y * Math.sin(TILT), y2 = x1 * Math.sin(TILT) + y * Math.cos(TILT); // lean the axis
    const p = 3.2 / (3.2 - z1);
    return [W / 2 + x2 * p * scale, H * 0.56 - y2 * p * scale, z1, p];
  }

  function draw() {
    if (!W || !H) return;
    const scale = Math.min(W / 2.95, H / 1.6);
    for (let i = 0, j = 0; i < n; i++, j += 3) { const p = project(pos[j], pos[j + 1], pos[j + 2], scale); sx[i] = p[0]; sy[i] = p[1]; sz[i] = p[2]; }
    order.sort((a, b) => sz[a] - sz[b]);
    ctx.clearRect(0, 0, W, H);
    const size0 = Math.max(3, scale / 17);
    for (const i of order) {
      const depth = (sz[i] + 0.45) / 0.9;                          // 0 far, 1 near
      const p = 3.2 / (3.2 - sz[i]);
      const s = size0 * p * (kind[i] < 2 ? 1.25 : 0.95);
      const lvl = Math.max(0, Math.min(SHADES - 1, Math.round((0.15 + 0.85 * depth) * (SHADES - 1))));
      ctx.globalAlpha = 1;
      ctx.drawImage(sprites.base[kind[i]][lvl], sx[i] - s / 2, sy[i] - s / 2, s, s);
      const h = rung[i] >= 0 ? heat[rung[i]] : 0;
      if (h > 0.02) { ctx.globalAlpha = Math.min(1, h * 1.2); const hs = s * (1.3 + h); ctx.drawImage(sprites.hot, sx[i] - hs / 2, sy[i] - hs / 2, hs, hs); }
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
    for (const k of streaks) {
      const a = Math.max(0, k.t - 0.28), b = Math.min(1, k.t);
      const x1 = k.x0 + (k.x1 - k.x0) * a, y1 = k.y0 + (k.y1 - k.y0) * a, x2 = k.x0 + (k.x1 - k.x0) * b, y2 = k.y0 + (k.y1 - k.y0) * b;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, "rgba(255,160,120,0)"); g.addColorStop(1, "rgba(255,225,200,.95)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.2 * dpr;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  /** A streak aimed at one rung, from one edge of the picture to the other. */
  function shoot() {
    const r = Math.floor(Math.random() * pairs);
    let i = 0;
    while (i < n && rung[i] !== r) i++;
    const mid = Math.min(n - 1, i + 3);
    const ang = Math.random() * Math.PI * 2, reach = Math.hypot(W, H) * 0.6;
    streaks.push({ t: 0, r, x0: sx[mid] - Math.cos(ang) * reach, y0: sy[mid] - Math.sin(ang) * reach, x1: sx[mid] + Math.cos(ang) * reach, y1: sy[mid] + Math.sin(ang) * reach, hit: false });
  }

  function frame(now) {
    raf = 0;
    if (!canvas.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const still = calm();
    if (!still) {
      yaw += dt * 0.55;
      owed += perSecond * dt;
      while (owed >= 1) { owed -= 1; if (streaks.length < 14) shoot(); }
      for (const k of streaks) { k.t += dt / STREAK_S; if (!k.hit && k.t >= 0.5) { k.hit = true; heat[k.r] = 1; } }
      streaks = streaks.filter((k) => k.t < 1.28);
      for (let r = 0; r < pairs; r++) if (heat[r] > 0) heat[r] = Math.max(0, heat[r] - dt / FLASH_S);
    }
    size();
    draw();
    if (seen && !document.hidden && !still) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && canvas.isConnected) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  const ro = new ResizeObserver(wake);
  ro.observe(canvas);
  const io = new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen) wake(); });
  io.observe(canvas);
  document.addEventListener("visibilitychange", wake);
  wake();

  return {
    set({ rate, usual }) { perSecond = tracksPerSecond(rate, usual); wake(); },
    stop() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", wake); }
  };
}
