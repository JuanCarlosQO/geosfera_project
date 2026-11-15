// The 3D brain's shape — numbers only, no DOM, so Node can test it.
// The brain is DRAWN BY CODE: a cloud of points laid over a few rounded shapes (two
// hemispheres, the temporal lobes, the cerebellum and the brainstem), with dark wavy lines for
// the folds. It is an illustration, not a scan, an atlas or anyone's real brain, and the zones
// are approximate. The screen says so.
// Axes: x left-right, y up, z front (+) to back (-). The whole brain fits in about -1..1.

export const ZONES = ["frontal", "parietal", "temporal", "occipital", "cerebellum", "stem"];

const HEMI = { c: [0.33, 0.1, 0], r: [0.37, 0.5, 0.88] };
const TEMP = { c: [0.41, -0.21, 0.02], r: [0.23, 0.2, 0.5] };
const CEREB = { c: [0, -0.36, -0.56], r: [0.43, 0.24, 0.3] };
const STEM = { top: [0, -0.3, -0.26], bottom: [0, -0.84, -0.36], r: [0.13, 0.085] };
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const inside = (x, y, z, e, side = 1) => ((x - side * e.c[0]) / e.r[0]) ** 2 + ((y - e.c[1]) / e.r[1]) ** 2 + ((z - e.c[2]) / e.r[2]) ** 2 < 1;

// Seven waves crossing in different directions; where their sum passes through zero the
// points go dark, and those dark lines meander like the folds of a cortex.
const WAVES = [[9.1, 3.2, 5.7, 0.4], [-4.3, 10.2, 3.9, 1.9], [2.6, -5.8, 9.9, 3.1], [-8.7, -4.1, 6.2, 0.8], [5.2, 8.4, -7.3, 2.5], [-2.9, 6.7, 9.4, 4.4], [10.3, -2.2, -4.8, 5.2]];
/** 0 at the bottom of a fold, up to 1 on the crown of a ridge. */
export function folds(x, y, z) {
  let sum = 0;
  for (const [a, b, c, p] of WAVES) sum += Math.sin(a * x + b * y + c * z + p);
  return Math.min(1, Math.abs(sum) / 1.9);
}
const leaves = (x, y) => Math.sin(46 * y + 4 * Math.sin(4 * x));

/** Which lobe a point on a hemisphere belongs to (approximate, for the illustration). */
export function lobeAt(y, z) {
  if (z < -0.5) return "occipital";
  return z > 0.17 - 0.4 * y ? "frontal" : "parietal";
}

/**
 * Builds the point cloud. density 1 gives about 9,500 points; the same density always gives
 * the same brain. Returns flat arrays: pos and nrm (x, y, z per point), zone (index into
 * ZONES) and shade (0..1, darker beside a fold).
 */
export function buildBrain(density = 1) {
  const pos = [], nrm = [], zone = [], shade = [];
  const add = (x, y, z, nx, ny, nz, zoneName, s) => {
    const l = Math.hypot(nx, ny, nz) || 1;
    pos.push(x, y, z); nrm.push(nx / l, ny / l, nz / l); zone.push(ZONES.indexOf(zoneName)); shade.push(s);
  };
  const onEllipsoid = (e, count, side, each) => {
    for (let i = 0; i < count; i++) {
      const v = 1 - (2 * (i + 0.5)) / count;
      const ring = Math.sqrt(1 - v * v);
      const a = i * GOLDEN;
      const dx = Math.cos(a) * ring, dy = v, dz = Math.sin(a) * ring;
      each(side * e.c[0] + dx * e.r[0], e.c[1] + dy * e.r[1], e.c[2] + dz * e.r[2], dx / e.r[0], dy / e.r[1], dz / e.r[2]);
    }
  };

  for (const side of [-1, 1]) {
    onEllipsoid(HEMI, Math.round(5200 * density), side, (x0, y0, z, nx, ny, nz) => {
      if (side * x0 < 0.035) return;                         // the gap between the hemispheres
      const zn = z / HEMI.r[2];
      const taper = 1 - (zn > 0 ? 0.24 : 0.12) * zn * zn;     // narrower at the front than at the back
      const x = side * (0.035 + (side * x0 - 0.035) * taper);
      const y = y0 < 0.1 ? 0.1 + (y0 - 0.1) * 0.66 : y0 * (1 - 0.07 * zn);   // flatter underneath, a little higher at the back
      if (inside(x, y, z, TEMP, side)) return;
      const f = folds(x, y, z);
      add(x, y, z, nx, ny, nz, lobeAt(y, z), f < 0.2 ? 0.07 : 0.38 + 0.62 * Math.min(1, (f - 0.2) * 2.4)); // dark in the folds
    });
    onEllipsoid(TEMP, Math.round(1300 * density), side, (x, y, z, nx, ny, nz) => {
      if (inside(x, y, z, HEMI, side) && y > -0.12) return;
      const f = folds(x, y, z);
      add(x, y, z, nx, ny, nz, "temporal", f < 0.2 ? 0.07 : 0.38 + 0.62 * Math.min(1, (f - 0.2) * 2.4)); // dark in the folds
    });
  }
  onEllipsoid(CEREB, Math.round(2000 * density), 1, (x, y, z, nx, ny, nz) => {
    if (inside(x, y, z, HEMI, 1) || inside(x, y, z, HEMI, -1)) return;
    const f = Math.abs(leaves(x, y));
    add(x, y, z, nx, ny, nz, "cerebellum", f < 0.3 ? 0.08 : 0.45 + 0.55 * f);
  });
  const rings = Math.round(20 * Math.sqrt(density)), around = Math.round(22 * Math.sqrt(density));
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const cy = STEM.top[1] + (STEM.bottom[1] - STEM.top[1]) * t;
    const cz = STEM.top[2] + (STEM.bottom[2] - STEM.top[2]) * t;
    const r = STEM.r[0] + (STEM.r[1] - STEM.r[0]) * t;
    for (let k = 0; k < around; k++) {
      const a = (k / around) * Math.PI * 2 + (i % 2) * (Math.PI / around);
      const x = Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (inside(x, cy, z, CEREB) || inside(x, cy, z, HEMI, 1) || inside(x, cy, z, HEMI, -1)) continue;
      add(x, cy, z, Math.cos(a), 0.15, Math.sin(a), "stem", 0.8);
    }
  }
  return { n: zone.length, pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), zone: Uint8Array.from(zone), shade: Float32Array.from(shade) };
}

/** Where to turn the brain so a zone faces the viewer: [yaw, pitch] in radians. */
export const VIEWS = {
  frontal: [-0.95, 0.16],
  parietal: [-1.75, 0.42],
  temporal: [-1.4, 0.1],
  occipital: [-2.3, 0.2],
  cerebellum: [-2.2, 0.06],
  stem: [-1.85, 0.04]
};

/** Turns a point by yaw (around the vertical axis) and then pitch. Returns [x, y, z]; z grows towards the viewer. */
export function turn(x, y, z, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}
