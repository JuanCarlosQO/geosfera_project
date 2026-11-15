import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, DEMO_CREW, DEMO_DAYS, isDemoId } from "../js/demo-core.js";
import { FIELDS, checkValue, dateKey } from "../js/log-core.js";
import { ROLES, MAX_CREW } from "../js/crew-core.js";
import { cleanStore, patterns, forMember } from "../js/meds-core.js";
import { KIT } from "../js/data/med-kit.js";
import { SUPPLEMENTS } from "../js/data/supplements.js";
import { checkSleep } from "../js/duty-core.js";

const NOW = new Date(2026, 10, 15, 10, 0);
const demo = buildDemo(NOW);
const today = dateKey(NOW);

describe("demo crew", () => {
  it("is fictional, labelled, and fits the crew rules", () => {
    assert.ok(DEMO_CREW.length <= MAX_CREW);
    for (const m of demo.crew.members) {
      assert.ok(ROLES.includes(m.role), m.role);
      assert.ok(isDemoId(m.id) && m.id.startsWith("demo-"), m.id);
    }
    assert.equal(demo.crew.active, DEMO_CREW[0].id);
    assert.match(demo.marker.note, /fictional/i);
    assert.match(demo.marker.note, /simulated/i);
  });

  it("is the same every time for the same day", () => {
    assert.deepEqual(buildDemo(NOW).logs, demo.logs);
  });

  it("writes two weeks ending today, with every value accepted by the daily log", () => {
    for (const log of Object.values(demo.logs)) {
      const days = Object.keys(log).sort();
      assert.equal(days.length, DEMO_DAYS);
      assert.equal(days.at(-1), today);
      assert.equal(demo.mission.start, days[0]);
      for (const day of days) {
        for (const f of FIELDS) {
          const r = log[day][f.key];
          if (!r) continue;
          assert.equal(checkValue(f, r.value).state, "ok", `${day} ${f.key} ${r.value}`);
        }
      }
      assert.equal(log[today].exerciseMinutes, undefined, "today's exercise is not logged yet");
    }
  });

  it("keeps radiation near the typical ISS dose of about 0.5 mSv a day", () => {
    for (const log of Object.values(demo.logs)) {
      for (const e of Object.values(log)) if (e.radiationDose) assert.ok(e.radiationDose.value >= 0.4 && e.radiationDose.value <= 0.6);
    }
  });

  it("tells Valentina's story: short sleep today and melatonin three nights in a row", () => {
    const v = demo.logs[DEMO_CREW[0].id];
    assert.equal(checkSleep(v, today).state, "flag");
    const store = forMember(cleanStore(demo.meds, KIT, SUPPLEMENTS), DEMO_CREW[0].id);
    assert.equal(store.doses.length, 3);
    assert.ok(patterns(store, KIT, NOW, v).some((p) => p.id === "repeat-Sleep"));
    assert.equal(Object.keys(store.supplements).length, DEMO_DAYS - 2);
  });
});

describe("demo crew shows each status", () => {
  it("has Tomás as the all-clear example: every judged reading normal", async () => {
    const { judgeReading } = await import("../js/log-core.js");
    const t = demo.logs[DEMO_CREW[1].id];
    for (const day of Object.keys(t)) {
      for (const key of ["heartRate", "bloodPressure", "temperature", "bloodOxygen", "glucose", "sleepHours"]) {
        const s = judgeReading(key, t[day][key]);
        assert.ok(["normal", "pending"].includes(s.status ?? s), `${day} ${key} ${JSON.stringify(t[day][key])} → ${JSON.stringify(s)}`);
      }
    }
  });

  it("tells the other crew members' stories: Aiko's spacewalk and request, Arjun's two sleep medications", () => {
    const [, , aiko, arjun] = DEMO_CREW;
    assert.equal(demo.mission.name, "Expedition ERG-1");
    assert.ok(demo.alerts.some((a) => a.from.id === aiko.id && a.level === "talk"));
    const jStore = forMember(cleanStore(demo.meds, KIT, SUPPLEMENTS), arjun.id);
    assert.ok(patterns(jStore, KIT, NOW, demo.logs[arjun.id]).some((p) => p.id.startsWith("twice-")));
    assert.ok(demo.openings.some((o) => o.member === arjun.id && o.closedAt));
    assert.equal(demo.family[aiko.id].length, 1);
    // each crew member sees only their own doses
    assert.equal(forMember(cleanStore(demo.meds, KIT, SUPPLEMENTS), DEMO_CREW[1].id).doses.length, 0);
  });
});
