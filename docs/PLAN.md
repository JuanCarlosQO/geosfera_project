# Geosfera — build plan

Public copy of the team's plan for the NASA Space Apps Challenge 2026 (14–15 November). The team works from a private Jira board; the keys (SCRUM-n) match it. Times are Colombia time (UTC−5). Last updated: Saturday 14 November, 10:45.

**Deadline:** code freeze Sunday 20:00 · submission by Sunday 23:00 (official close 23:59 local event time).

**Team roles:** Dev 1 · visual (hologram, animations, charts) · Dev 2 · data and rules (log, health rules, tests) · Dev 3 · features and quality (gamification, radiation, offline, phone testing).

Status: ✅ done · 🔍 in review · ⏳ to do

## Day 1 — Saturday 14 November (SCRUM-6)

| Key | When | Task | Who | Status |
| --- | --- | --- | --- | --- |
| — | 09:00 | Module 1: crew access (airlock hatch, code, fingerprint) | Claude Code | ✅ |
| SCRUM-8 | 10–12 | Choose the official source for vital-sign normal ranges | Lead | ⏳ |
| SCRUM-9 | 10–12 | Module 1: test code and fingerprint on Android and iPhone | Dev 3 | ⏳ |
| SCRUM-10 | 10–15 | Module 2: realistic human figure with skeleton, organs and ring of light | Dev 1 | 🔍 |
| SCRUM-11 | 15–20 | Module 2: body-system icons, connector lines and NASA risk panel | Dev 1 | 🔍 |
| SCRUM-25 | 10:40 | Main dashboard: the ISS Cupola (mockup option A), dock navigation | Dev 1 | 🔍 |
| SCRUM-12 | 10–14 | Module 3: daily log — data model, on-device storage, entry form | Dev 2 | ⏳ |
| SCRUM-13 | 14–20 | Module 3: health rules with tests (impossible values, jumps, ranges) | Dev 2 | ⏳ |
| SCRUM-14 | 12–20 | Module 4: gamification — daily exercise ring, streaks, achievements | Dev 3 | ⏳ |
| SCRUM-15 | 20–23 | Integrate, review and publish Day 1 | Team | ⏳ |

## Day 2 — Sunday 15 November (SCRUM-7)

| Key | When | Task | Who | Status |
| --- | --- | --- | --- | --- |
| SCRUM-16 | 08–13 | Module 5: future body — bone density projection with animated chart | Dev 1 | ⏳ |
| SCRUM-17 | 08–13 | Module 7: trends — self-drawing charts per reading | Dev 2 | ⏳ |
| SCRUM-18 | 08–13 | Module 6: hazards and radiation | Dev 3 | ⏳ |
| SCRUM-19 | 13–17 | In-app sources page | Dev 2 | ⏳ |
| SCRUM-20 | 13–17 | Offline mode: service worker and self-hosted fonts | Dev 3 | ⏳ |
| SCRUM-21 | 13–17 | Visual polish and transitions between modules | Dev 1 | ⏳ |
| SCRUM-22 | 17–20 | Final QA and code freeze at 20:00 | Dev 3 · Team | ⏳ |
| SCRUM-23 | 17–21 | Demo video script and recording (English) | Team | ⏳ |
| SCRUM-24 | 21–23 | Space Apps submission form and AI use log | Lead | ⏳ |

## Ground rules

- Every health fact comes from an official source, quoted word for word in [SOURCES.md](SOURCES.md). No source, no number: the app shows "Pending check".
- Impossible values and sudden jumps become "Measure again", never an alarm.
- Status always has a word and a shape as well as a colour.
- Gamification rewards the habit of measuring, never the health values.
- Each module is finished, tested and pushed to `main` before the next one starts.
