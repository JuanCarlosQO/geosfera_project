import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as B from "../js/barcode-core.js";
import { KIT } from "../js/data/med-kit.js";

// draws an EAN-13 the way a box prints it: 95 modules, quiet zones, as grey levels
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = L.map((p) => [...p].map((b) => (b === "1" ? "0" : "1")).reverse().join(""));
const R = L.map((p) => [...p].map((b) => (b === "1" ? "0" : "1")).join(""));
const FIRST = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
function modules(code) {
  const d = [...code].map(Number);
  let m = "101";
  for (let i = 0; i < 6; i += 1) m += (FIRST[d[0]][i] === "L" ? L : G)[d[1 + i]];
  m += "01010";
  for (let i = 0; i < 6; i += 1) m += R[d[7 + i]];
  return `${m}101`;
}
function image(code, { px = 3, width = 420, height = 120, blur = true, noise = 18, seed = 7 } = {}) {
  const m = modules(code);
  const gray = new Uint8Array(width * height);
  const left = Math.round((width - m.length * px) / 2);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const k = Math.floor((x - left) / px);
    const v = k >= 0 && k < m.length && m[k] === "1" ? 40 : 225;
    gray[y * width + x] = v;
  }
  if (blur) for (let y = 0; y < height; y += 1) { const row = gray.slice(y * width, y * width + width); for (let x = 1; x < width - 1; x += 1) gray[y * width + x] = (row[x - 1] + 2 * row[x] + row[x + 1]) / 4; }
  for (let i = 0; i < gray.length; i += 1) gray[i] = Math.max(0, Math.min(255, gray[i] + (rnd() - 0.5) * noise));
  return gray;
}

describe("reading a box's barcode from a photo", () => {
  it("checks the EAN-13 check digit", () => {
    assert.equal(B.validEan("0341520314643"), true);
    assert.equal(B.validEan("0341520314644"), false);
  });

  it("reads a printed barcode, blurred and noisy, and upside down", () => {
    const code = "0341520314643";
    assert.equal(B.decodeGray(image(code), 420, 120), code);
    const flipped = image(code).reverse();
    assert.equal(B.decodeGray(flipped, 420, 120), code);
  });

  it("reads a barcode with a first digit other than 0 and a box held sideways", () => {
    const code = "4006381333931";
    const w = 420, h = 120, img = image(code);
    const turned = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) turned[x * h + y] = img[y * w + x];
    assert.equal(B.decodeGray(turned, h, w), code);
  });

  it("finds nothing in a picture without a barcode", () => {
    assert.equal(B.decodeGray(new Uint8Array(300 * 100).fill(200), 300, 100), null);
  });

  it("looks a 12-digit UPC up with and without its leading 0", () => {
    assert.deepEqual(B.upcForms("341520314643"), ["0341520314643", "341520314643"]);
    assert.deepEqual(B.upcForms("abc"), []);
  });

  it("matches a label to the kit by its one active ingredient, never a combination", () => {
    assert.equal(B.medFromLabel({ substance_name: ["IBUPROFEN"], brand_name: ["Advil"] }, KIT).med.id, "ibuprofen");
    assert.equal(B.medFromLabel({ substance_name: ["OXYMETAZOLINE HYDROCHLORIDE"] }, KIT).med.id, "oxymetazoline");
    assert.equal(B.medFromLabel({ substance_name: ["ACETAMINOPHEN", "DIPHENHYDRAMINE HYDROCHLORIDE"] }, KIT).med, null);
    assert.equal(B.medFromLabel({ substance_name: ["LORATADINE"] }, KIT).med, null);
  });
});
