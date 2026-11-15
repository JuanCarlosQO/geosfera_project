import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readMesh, paintZones } from "../js/brain-gl.js";
import { ZONES } from "../js/brain-core.js";

const file = readFileSync(new URL("../assets/brain3d.bin", import.meta.url));
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
const ZONE_AT = { frontal: [23, 40, 21, 30], parietal: [61, 21, 23, 19], temporal: [45, 60, 22, 12], occipital: [83, 45, 11, 22], cerebellum: [69, 73, 13, 12], stem: [54, 87, 6, 12] };

describe("3D brain model file", () => {
  const m = readMesh(buffer);
  it("is a mesh small enough for a phone, and every triangle points at a real vertex", () => {
    assert.ok(m.n > 5000 && m.n < 65536, String(m.n));
    assert.equal(m.idx.length % 3, 0);
    assert.ok(file.byteLength < 400000, "under 400 KB");
    let top = 0;
    for (const i of m.idx) if (i > top) top = i;
    assert.ok(top < m.n);
  });
  it("lies along the screen, centred, with unit normals", () => {
    let maxX = 0, maxY = 0, maxZ = 0;
    for (let i = 0; i < m.n; i++) {
      maxX = Math.max(maxX, Math.abs(m.pos[i * 3])); maxY = Math.max(maxY, Math.abs(m.pos[i * 3 + 1])); maxZ = Math.max(maxZ, Math.abs(m.pos[i * 3 + 2]));
      const l = Math.hypot(m.nrm[i * 3], m.nrm[i * 3 + 1], m.nrm[i * 3 + 2]);
      assert.ok(Math.abs(l - 1) < 0.03, `normal ${i} has length ${l}`);
    }
    assert.ok(Math.abs(maxX - 1) < 0.01, "its length runs across the screen and fills -1..1");
    assert.ok(maxY < maxX && maxZ < maxX, "it is longer than it is tall or wide");
  });
  it("refuses a file that is not the app's mesh", () => {
    assert.throws(() => readMesh(new ArrayBuffer(64)));
  });
  it("paints every vertex with one of the six zones, strongest at a zone's centre", () => {
    const { zone, weight } = paintZones(m.side, m.n, Object.keys(ZONE_AT), ZONE_AT);
    const seen = new Set();
    for (let i = 0; i < m.n; i++) { seen.add(zone[i]); assert.ok(weight[i] >= 0 && weight[i] <= 1); }
    assert.equal(seen.size, 6, "all six zones exist on the model");
    assert.deepEqual(Object.keys(ZONE_AT).sort(), [...ZONES].sort(), "the same zones as the mind map");
    const side = new Float32Array([0.23, 0.40, 0.99, 0.99]);
    const two = paintZones(side, 2, Object.keys(ZONE_AT), ZONE_AT);
    assert.equal(two.zone[0], 0); assert.equal(two.weight[0], 1);
    assert.equal(two.weight[1], 0, "far from every zone the model keeps its own colour");
  });
});
