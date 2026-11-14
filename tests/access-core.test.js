import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as core from "../js/access-core.js";

const subtle = globalThis.crypto.subtle;
const utf8 = new TextEncoder();

describe("code shape", () => {
  it("accepts four digits only", () => {
    assert.ok(core.codeShapeOk("3907"));
    for (const v of ["390", "39071", "39a7", "", undefined, 3907]) assert.equal(core.codeShapeOk(v), false);
  });
  it("flags codes people guess first", () => {
    for (const v of ["0000", "7777", "1234", "5678", "8765", "3210", "1212", "4747"]) assert.ok(core.guessable(v), v);
    for (const v of ["3907", "1357", "2580", "1123"]) assert.equal(core.guessable(v), false, v);
  });
});

describe("code record", () => {
  it("stores no trace of the code and matches only it", async () => {
    const rec = await core.deriveRecord("3907", { rounds: 2000 });
    assert.equal(JSON.stringify(rec).includes("3907"), false);
    assert.ok(await core.matches("3907", rec));
    assert.equal(await core.matches("3908", rec), false);
  });
  it("salts every record", async () => {
    const [a, b] = await Promise.all([core.deriveRecord("3907", { rounds: 2000 }), core.deriveRecord("3907", { rounds: 2000 })]);
    assert.notEqual(a.digest, b.digest);
  });
  it("round-trips base64url", () => {
    const bytes = Uint8Array.from([251, 255, 0, 62, 63, 9]);
    assert.deepEqual(core.unb64u(core.b64u(bytes)), bytes);
    assert.match(core.b64u(bytes), /^[A-Za-z0-9_-]+$/);
  });
});

describe("wrong-code waits", () => {
  it("allows the grace tries, then doubles the wait up to the cap", () => {
    assert.equal(core.delayFor(core.GRACE_TRIES - 1), 0);
    assert.equal(core.delayFor(core.GRACE_TRIES), core.BASE_DELAY_MS);
    assert.equal(core.delayFor(core.GRACE_TRIES + 2), core.BASE_DELAY_MS * 4);
    assert.equal(core.delayFor(50), core.CAP_DELAY_MS);
  });
  it("counts tries left and the time to wait", () => {
    let s = core.cleanSlate();
    for (let i = 0; i < core.GRACE_TRIES; i += 1) s = core.afterMiss(s, 10_000);
    assert.equal(core.attemptsRemaining(s), 0);
    assert.equal(core.msLeft(s, 10_000), core.BASE_DELAY_MS);
    assert.equal(core.msLeft(s, 10_000 + core.BASE_DELAY_MS), 0);
  });
});

describe("fingerprint answer", () => {
  it("reads flags and counter", () => {
    const d = new Uint8Array(37);
    d[32] = 0b101; d[35] = 1; d[36] = 2;
    const a = core.readAuthenticatorData(d);
    assert.deepEqual([a.present, a.verified, a.counter], [true, true, 258]);
  });

  const derOf = (raw) => {
    const enc = (x) => {
      let v = [...x];
      while (v.length > 1 && v[0] === 0) v.shift();
      if (v[0] >= 0x80) v.unshift(0);
      return [0x02, v.length, ...v];
    };
    const body = [...enc(raw.slice(0, 32)), ...enc(raw.slice(32))];
    return Uint8Array.from([0x30, body.length, ...body]);
  };

  it("converts DER signatures to r||s", () => {
    const raw = Uint8Array.from({ length: 64 }, (_, i) => (i % 32 === 0 ? 0xff : i % 32 === 1 ? 0 : i));
    assert.deepEqual(core.ecdsaDerToP1363(derOf(raw)), raw);
  });

  async function phoneAnswer({ rpId = "juancarlosqo.github.io", origin = "https://juancarlosqo.github.io", flags = 0b101, alter = false } = {}) {
    const keys = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const challenge = core.freshBytes(32);
    const clientDataJSON = utf8.encode(JSON.stringify({ type: "webauthn.get", challenge: core.b64u(challenge), origin }));
    const authenticatorData = new Uint8Array(37);
    authenticatorData.set(new Uint8Array(await subtle.digest("SHA-256", utf8.encode(rpId))));
    authenticatorData[32] = flags;
    const msg = new Uint8Array([...authenticatorData, ...new Uint8Array(await subtle.digest("SHA-256", clientDataJSON))]);
    const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, msg));
    if (alter) authenticatorData[33] = 1;
    return {
      want: { challenge, origin: "https://juancarlosqo.github.io", rpId: "juancarlosqo.github.io", key: core.b64u(await subtle.exportKey("spki", keys.publicKey)), alg: -7 },
      got: { authenticatorData, clientDataJSON, signature: derOf(sig) }
    };
  }

  it("accepts a genuine answer", async () => {
    const { want, got } = await phoneAnswer();
    assert.equal((await core.checkAssertion(want, got)).ok, true);
  });

  it("rejects other sites, unconfirmed users and altered data", async () => {
    for (const bad of [{ rpId: "other.example" }, { origin: "https://other.example" }, { flags: 0b001 }, { alter: true }]) {
      const { want, got } = await phoneAnswer(bad);
      assert.equal((await core.checkAssertion(want, got)).ok, false, JSON.stringify(bad));
    }
  });
});

describe("forgot-code reset", () => {
  it("erases only Geosfera's own keys", () => {
    assert.deepEqual(core.appKeys(["geosfera.log", "crewcheck.v1", "geosfera.crew-access", "other"]), ["geosfera.log", "geosfera.crew-access"]);
  });
});
