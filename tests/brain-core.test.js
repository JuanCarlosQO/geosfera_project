import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as B from "../js/brain-core.js";

describe("3D brain shape", () => {
  const c = B.buildBrain(0.4);
  it("builds the same cloud every time", () => {
    const d = B.buildBrain(0.4);
    assert.equal(d.n, c.n);
    assert.deepEqual(Array.from(d.pos.slice(0, 60)), Array.from(c.pos.slice(0, 60)));
  });
  it("has points in every zone, on both sides, inside the stage", () => {
    const count = new Array(B.ZONES.length).fill(0);
    let left = 0, right = 0;
    for (let i = 0; i < c.n; i++) {
      count[c.zone[i]]++;
      const [x, y, z] = [c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2]];
      assert.ok(Math.abs(x) <= 1.05 && Math.abs(y) <= 1.05 && Math.abs(z) <= 1.05, "a point is outside the stage");
      if (x < -0.05) left++; else if (x > 0.05) right++;
    }
    for (const [i, n] of count.entries()) assert.ok(n > 20, `${B.ZONES[i]} has too few points`);
    assert.ok(Math.abs(left - right) / c.n < 0.05, "the two sides are not balanced");
  });
  it("gives every point a unit normal and a shade between 0 and 1", () => {
    for (let i = 0; i < c.n; i++) {
      const l = Math.hypot(c.nrm[i * 3], c.nrm[i * 3 + 1], c.nrm[i * 3 + 2]);
      assert.ok(Math.abs(l - 1) < 1e-3);
      assert.ok(c.shade[i] >= 0 && c.shade[i] <= 1);
    }
  });
  it("grows with density and stays light enough for a phone", () => {
    assert.ok(B.buildBrain(1).n > c.n);
    assert.ok(B.buildBrain(1).n < 14000);
  });
  it("has a view for every zone and turns points without stretching them", () => {
    for (const z of B.ZONES) assert.equal(B.VIEWS[z].length, 2);
    const [x, y, z] = B.turn(0.3, -0.4, 0.5, 1.1, 0.3);
    assert.ok(Math.abs(Math.hypot(x, y, z) - Math.hypot(0.3, -0.4, 0.5)) < 1e-9);
    assert.deepEqual(B.turn(0, 0, 1, 0, 0), [0, 0, 1]);
  });
  it("puts the lobes where the labels say", () => {
    assert.equal(B.lobeAt(0.2, 0.7), "frontal");
    assert.equal(B.lobeAt(0.4, -0.2), "parietal");
    assert.equal(B.lobeAt(0.1, -0.7), "occipital");
  });
});
