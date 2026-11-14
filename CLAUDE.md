# Geosfera — project context for Claude Code

Geosfera is the team's entry for the **NASA Space Apps Challenge 2026**, challenge *Create Health Monitoring Software for Astronauts on Space Missions* (resources: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources). The challenge started at 09:00 Colombia time on 14 November 2026; every file in this repository was written after that. Submission closes Sunday 15 November, 11:59 p.m. local event time.

- App UI, submission form and demo video: **English**.
- The developer, Juan Carlos, speaks Spanish: **talk to him in Spanish**.
- `main` is the published branch (GitHub Pages). Juan Carlos authorised pushing straight to `main`.

## How to run

- No build step, no dependencies. `npm start` serves on port 8000 (use http, not file://: ES modules need a server).
- `npm test` runs the Node unit tests in `tests/`. Keep them green; every new rule gets a test.

## Architecture (grows module by module)

| File | Role |
| --- | --- |
| `index.html` | Shell: masthead (mark, UTC clock, lock), station area, hatch root |
| `css/base.css` | Tokens, shell and shared controls |
| `css/hatch.css` | Module 1 styles |
| `js/app.js` | Boot, UTC clock, lock button, hash router (`#today`, `#body/<system>`, `#log`, `#log/<YYYY-MM-DD>`, `#mission`) and bottom dock |
| `js/access-core.js` | Pure access rules, tested: code shape, guessable codes, PBKDF2 record, wrong-code waits, WebAuthn assertion check |
| `js/hatch.js` | Module 1 screen: hatch with a ring of digits 0–9, four bolts, ISS in the porthole, fingerprint/face, forgot code, opening animation |
| `css/today.css` | Main dashboard and bottom dock styles |
| `js/today-core.js` | Dashboard rules, tested: six Cupola windows, worst-status per window, honest headline, mission day, Cupola geometry |
| `js/today.js` | Main dashboard ("Today"): the Cupola (mockup option A) with six windows; each opens its system in the hologram |
| `css/log.css` | Module 3 styles |
| `js/log-core.js` | Daily log rules, tested: fields, typo limits and jump detection (app rules), entry building, CSV export, JSON backup and restore with merge |
| `js/log.js` | Module 3 screen: numbered check-in checklist with live ticks, Measure again messages, save summary, data card (export, backup, restore), recent days with edit |
| `css/mission.css` | Module 4 styles |
| `js/mission-core.js` | Mission rules, tested: NASA exercise goal (90 min, 6 days/week, quoted), streaks, week, habit achievements, adherence |
| `js/mission.js` | Module 4 screen (`#mission`): exercise ring, check-in streak, self-drawing week chart with goal line, mission patches |
| `css/body.css` | Module 2 styles |
| `js/anatomy.js` | Our own anatomical figure (SVG): outline, surface contours, skeleton, organs; every part has a `data-region` |
| `js/body.js` | Module 2 screen: figure on a ring of light, seven body-system controls joined by lines, panel with NASA risks and facts |
| `js/data/nasa-risks.js` | The 17 NASA HRP risks, word for word, with links |
| `js/data/body-systems.js` | App grouping of the risks into seven body systems, the regions each lights, verified facts, status words and shapes |
| `docs/SOURCES.md` | Every fact the app may show, with the exact quote and link |

## Modules

1. **Crew access — done.** Airlock design (mockup option A). Code kept only as a salted PBKDF2 hash; wrong-code waits; optional fingerprint/face (WebAuthn platform authenticator, signature checked in the app); "Forgot your code?" erases the device. It is a device lock, not encryption: say so honestly. Fingerprint needs https and a phone with a reader.
2. **Body hologram — done (Jira SCRUM-10, SCRUM-11).** Our own SVG figure (8-head proportions, anatomical position) with skeleton and organs on a ring of light, a scan line, seven body-system controls joined by lines. Tapping a system lights its organs and opens NASA's risks (exact text and links) and verified facts. Every system shows "No data" until the daily log exists. Tests check that all 17 risks are placed once and that every fact is quoted word for word in `docs/SOURCES.md`.
- **Main dashboard — the Cupola (Juan Carlos: "this goes on the main dashboard").** First screen after the hatch. Six windows (Heart, Lungs, Metabolism, Radiation, Body, Mind) around "N/6 measured". Readings come from `localStorage["geosfera.log"][YYYY-MM-DD]`, written by the daily log. Without a reading: "No data"; with a reading but no approved range: "Pending check" (◇). Tapping a window opens `#body/<system>`.
3. **Daily check-in — done.** Like CrewCheck's check-in: numbered steps 3.01–3.09 (heart rate, blood pressure, temperature, blood oxygen, glucose, sleep, exercise, radiation dose, mood 1–5), a tick when a value is in, empty steps allowed, comma or point decimals. Impossible values (app-rule limits) block saving with "Measure again"; a jump from the last reading saves with flag "again", which the Cupola shows as ◌ Measure again. Other readings are "Pending check" until ranges have an approved source. Past days can be corrected.
4. **Data storage — decided: A + B.** Everything stays on the device (`localStorage`, keys `geosfera.*`). B: CSV export, JSON backup and restore (restored values are checked again; days already on the device are never overwritten). "Forgot your code?" erases only `geosfera.*` keys. Deployment target: Vercel (own domain, so storage is not shared with other apps).
5. **Mission (gamification) — done.** Exercise ring against NASA's 1.5 hours a day; check-in streak and best run; week of exercise bars that draw themselves with a 90-minute goal line; eight mission patches (first check-in, full checklist, 3- and 7-day streaks, 90 minutes, NASA week = 6 of 7 days, dosimeter on 5 days, second look after Measure again). A test proves no badge depends on a vital-sign value.
6. Next modules are announced to Juan Carlos before starting. Jira and the Excel board are no longer used.

## Information rules (Juan Carlos: "real and verified, never false or biased")

- **Only official sources.** The challenge resources are NASA HRP (hazards, risks, ongoing research) and two Canadian Space Agency pages. Their facts are in `docs/SOURCES.md` with exact quotes.
- **No invented numbers.** A value shown as fact needs an entry in `docs/SOURCES.md`. Without one the app shows "Pending check". App-chosen thresholds are labelled "app rule".
- The challenge resources give **no clinical normal ranges** for heart rate, blood pressure, temperature, blood oxygen or glucose. Those stay "Pending check" until Juan Carlos approves another official source.
- **Measurement before health:** impossible values and sudden jumps become "Measure again", never an alarm.
- Reading nasa.gov from this environment: use the Playwright browser with the proxy (WebFetch does not reach it). The Space Apps site fails TLS through the proxy; ask Juan Carlos to paste what is needed.

## Design guidelines from Juan Carlos

- Build **module by module**: finished, tested and pushed before the next.
- **Human figure:** as close as possible to a real human. Blue hologram, skeleton and organs visible, standing on a ring of light, an icon per body system around it joined by thin lines. The reference he shared is a watermarked stock image: **never copy it**. Draw our own or use openly licensed anatomy and credit it.
- **Gamification:** streaks, achievements, mission progress. Reward the habit of measuring, never the health values.
- **Dynamic charts:** lines that draw themselves, numbers that count up, body systems that light up.
- **Colour code**, always with a word and a shape: Normal ● teal · Watch ▲ orange · Act now ⯃ red · Measure again ◌ blue · No data — grey.
- Look: night in low Earth orbit, titanium hull, one cyan accent (`--beacon`); Saira + IBM Plex Mono. Respect `prefers-reduced-motion`; touch targets ≥ 44 px.
- Commits end with the Co-Authored-By line for Claude. Keep `docs/AI_USE.md` accurate.
