import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as H from "../js/helix-core.js";

describe("DNA helix shape", () => {
  const h = H.buildHelix();
  it("builds two strands and a rung for every base pair, the same every time", () => {
    const count = [0, 0, 0, 0];
    for (const k of h.kind) count[k]++;
    assert.equal(count[0], count[1], "the two strands have the same number of points");
    assert.ok(count[2] > 0 && count[3] > 0, "each rung has its two halves");
    assert.equal(new Set(Array.from(h.rung).filter((r) => r >= 0)).size, h.pairs);
    assert.deepEqual(Array.from(H.buildHelix().pos.slice(0, 30)), Array.from(h.pos.slice(0, 30)));
  });
  it("keeps every point inside the stage, strands on the cylinder and rungs between them", () => {
    for (let i = 0; i < h.n; i++) {
      const [x, y, z] = [h.pos[i * 3], h.pos[i * 3 + 1], h.pos[i * 3 + 2]];
      assert.ok(y >= -1.001 && y <= 1.001);
      const r = Math.hypot(x, z);
      if (h.kind[i] < 2) { assert.ok(Math.abs(r - 0.42) < 1e-3); assert.equal(h.rung[i], -1); }
      else { assert.ok(r < 0.42); assert.ok(h.rung[i] >= 0 && h.rung[i] < h.pairs); }
    }
  });
  it("draws more streaks when the dose rate rises, within limits, and none without a reading", () => {
    const usual = H.tracksPerSecond(5, 5);
    assert.equal(usual, H.RULES.tracksUsual);
    assert.ok(H.tracksPerSecond(15, 5) > usual);
    assert.equal(H.tracksPerSecond(5 * 40, 5), H.RULES.tracksMax, "a solar event is capped so the picture stays readable");
    assert.equal(H.tracksPerSecond(0.01, 5), H.RULES.tracksMin);
    for (const bad of [[null, 5], [5, 0], [5, null], [-1, 5]]) assert.equal(H.tracksPerSecond(...bad), 0);
  });
  it("says how the dose rate compares in plain words", () => {
    assert.equal(H.versusUsual(5, 5), "about the usual");
    assert.equal(H.versusUsual(7.6, 4.9), "1.6× the usual");
    assert.equal(H.versusUsual(196, 4.9), "40× the usual");
    assert.equal(H.versusUsual(null, 5), "");
  });
});
