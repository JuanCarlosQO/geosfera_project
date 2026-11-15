# Ergosphere — project context for Claude Code

Ergosphere is the team's entry for the **NASA Space Apps Challenge 2026**, challenge *Create Health Monitoring Software for Astronauts on Space Missions* (resources: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources). The challenge started at 09:00 Colombia time on 14 November 2026; every file in this repository was written after that. Submission closes Sunday 15 November, 11:59 p.m. local event time.

- App UI, submission form and demo video: **English**. The app also has a Spanish look (ES/EN button in the top bar): `js/i18n.js` swaps text on screen from the dictionary `js/data/es.js`; quoted sources are never translated. New screen text should get a Spanish entry too (anything missing simply stays in English).
- The developer, Juan Carlos, speaks Spanish: **talk to him in Spanish**.
- `main` is the published branch (GitHub Pages). Juan Carlos authorised pushing straight to `main`.

**Name:** the project is **Ergosphere** (Spanish: Ergosfera). It was first called Geosfera; device storage keys (`geosfera.*`), the backup file's `app: "geosfera"` tag and the repository name keep the old word so saved data and links keep working.

## How to run

- No build step, no dependencies. `npm start` serves on port 8000 (use http, not file://: ES modules need a server).
- `npm test` runs the Node unit tests in `tests/`. Keep them green; every new rule gets a test.

## Architecture (grows module by module)

| File | Role |
| --- | --- |
| `index.html` | Shell: masthead (mark, UTC clock, lock), station area, hatch root |
| `css/base.css` | Tokens, shell and shared controls |
| `css/hatch.css` | Module 1 styles |
| `js/app.js` | Boot, UTC clock, lock button, hash router (`#today`, `#body/<system>`, `#log`, `#log/<YYYY-MM-DD>`, `#mission`, `#meds`, `#duty`) and bottom dock |
| `js/access-core.js` | Pure access rules, tested: code shape, guessable codes, PBKDF2 record, wrong-code waits, WebAuthn assertion check |
| `js/role-core.js`, `js/role.js` | Who is looking: the ground medical team (sees every reading) or a crew member (home with no readings; emergency opening for 60 min, kept in `geosfera.openings` for the ground). `geosfera.role` never leaves the device |
| `js/exercise-core.js`, `js/exercise.js`, `js/data/exercise.js` | Countermeasure exercise: the ground team prescribes daily sessions (ARED, CEVIS, T2) on Mission; the crew member marks them done on their home with loads and anything felt after, and reports machine problems. Kept in `geosfera.exercise` (synced); minutes fill "Exercise today" in the daily log |
| `js/crew-home.js` | `#crew`: the crew member's own home. Morning question without numbers, watch taps, medication, family, talk, critical task, emergency opening |
| `js/ground.js` | `#ground`: the ground team's crew list (short night, morning answer, requests, emergency openings); a card opens that member's record |
| `js/hatch.js` | Module 1 screen: hatch with a ring of digits 0–9, four bolts, ISS in the porthole, fingerprint/face, forgot code, opening animation |
| `css/today.css` | Main dashboard and bottom dock styles |
| `js/today-core.js` | Dashboard rules, tested: six Cupola windows, worst-status per window, honest headline, mission day, Cupola geometry |
| `js/today.js` | Main dashboard ("Today"): the Cupola (mockup option A) with six windows; each opens its system in the hologram |
| `css/log.css` | Module 3 styles |
| `js/log-core.js` | Daily log rules, tested: fields, typo limits and jump detection (app rules), entry building, CSV export, JSON backup and restore with merge |
| `js/log.js` | Module 3 screen, styled as a flight procedure: three sequences (Vitals, Recovery, Countermeasures) of instrument modules with glowing digital readouts, − / + nudges, last reading and live delta, live jump warning, completion ring and segment bar, "Transmit to log" with a telemetry receipt, data vault (export, backup, restore) and recent days |
| `css/mission.css` | Module 4 styles |
| `js/mission-core.js` | Mission rules, tested: NASA exercise goal (90 min, 6 days/week, quoted), streaks, week, habit achievements, adherence |
| `js/mission.js` | Module 4 screen (`#mission`): exercise ring, check-in streak, self-drawing week chart with goal line, mission patches |
| `css/instrument.css` | Shared futuristic layer loaded last: background grid, glass panels with light sweep and lift on hover, SEC 01… section codes, glowing digital readouts, Cupola and hazard hovers, lit dock indicator, CTA sweep |
| `js/crew-core.js` | Crew rules, tested: member validation, roles, per-member log keys, active member, initials |
| `js/store.js` | Device storage for the crew: `geosfera.crew` and one log per member (`geosfera.log.<id>`); moves an old single log to the first member |
| `js/crew.js` + `css/crew.css` | Crew registration, crew status row (silhouette per astronaut tinted by status, key readings, heart-rate trend), roster sheet, who-is-checking-in pills |
| `js/data/vital-ranges.js` | Vital ranges from the team document (CDC, ADA, MedlinePlus numbers only; pending team review) and NASA-STD-3001 radiation limits (600 mSv career, 250 mSv per event) |
| `css/body.css` | Module 2 styles |
| `js/anatomy.js` | Our own anatomical figure (SVG): outline, surface contours, skeleton, organs; every part has a `data-region` |
| `js/body.js` | Module 2 screen: figure on a ring of light, seven body-system controls joined by lines, panel with NASA risks and facts |
| `js/data/nasa-risks.js` | The 17 NASA HRP risks, word for word, with links |
| `js/data/hazards.js` | NASA's five hazards word for word, linked to body systems (app choice) |
| `js/data/body-systems.js` | App grouping of the risks into seven body systems, the regions each lights, verified facts, status words and shapes |
| `css/meds.css` | Module 8 styles |
| `js/meds-core.js` | Medication rules, tested: symptoms to possible complaints, label interval and daily limit, kit stock and dates, source-warned combinations, dose record, "Did it work?", CSV; readings stored next to a dose with no conclusion (`logContext`), warning preview (`patternsAfter`), export queue (`queued`, `markExported`); Dose Tracker ideas: weekly question (`weeklyDue`, `whenToAt`), own and every-day medications (`addOwn`, `medList`, `scheduledToday`), side-effect strength (`SEVERITY`) |
| `js/meds.js` | Module 8 screen: body figure for "what for", kit options as 3D models, how many, follow-up with kit-list side effects, patterns to raise, vitamin D, log and CSV; quick log (one typed or spoken sentence, confirmed with a tap), "Logged with this entry", FHIR export |
| `css/cupola.css` | Today's Cupola: windows as buttons (lift, press, fly-in, breathing "Act now"), hub arcs, radar sweep |
| `js/devices-core.js` | Devices rules, tested: Actiware interval-file reader, watch timeline (asleep, awake, wake, off, on) and night summary, simulated watch, Bluetooth SIG decoders (heart rate, blood pressure, thermometer, pulse oximeter; IEEE 11073 SFLOAT/FLOAT), `fillDay` (marks the origin, never replaces a typed value) |
| `js/devices.js` | Devices screen (#devices) and `autoSync()` run before Today, the check-in and Mind; `watchLine()` for Today |
| `lib/actigraph-handler.js`, `api/actigraph.js` | ActiGraph CentrePoint through the server (OAuth client credentials; secret only in env, see `.env.example`), tested with a fake server |
| `js/data/devices.js` | Quoted facts for the Devices screen (NASA, Philips, Chrome) |
| `samples/actiware-sample.csv` | SIMULATED file in the layout of an Actiware interval export, for the demo |
| `js/sleepcheck-core.js`, `js/sleepcheck.js` | Morning sleep check on Today, tested: when to ask, how they feel, reasons and note saved with the day's log, summary for the crew medical officer |
| `js/avatar.js` | Crew pictures: selectable portraits in `assets/avatars` (f1-f3, m1-m3), initials fallback, body thumbnail |
| `js/i18n-core.js` | Spanish look rules, tested: numbers taken out as `#`, template rules for names and dates, per-part " · " lines, dictionary check |
| `js/i18n.js` | Spanish look on the page: walks text and labels, follows new content with a MutationObserver, skips quotes (`small.src`), ES/EN button |
| `js/data/es.js` | Spanish dictionary and templates (machine-assisted, to be read by a Spanish speaker) |
| `js/quicklog-core.js` | Quick-log sentence reader, tested: medication name, count, reason; never picks a medication from a symptom, never converts mg to tablets |
| `js/fhir-core.js` | Medication log as HL7 FHIR R4 `MedicationStatement` bundle, tested: text only, no codes, marked simulated |
| `js/data/med-flow.js` | Quoted facts for the quick log and the export (Dose Tracker abstract, HL7 FHIR R4) |
| `js/data/supplements.js` | Vitamin D in the mission plan, with NASA quotes |
| `js/data/med-zones.js` | The body zones (where on the figure, which regions light, which symptoms each asks about); navigation only, an app choice |
| `js/pill3d.js` | CSS-only 3D medication models (stacked layers) that turn and can be dragged; illustrations of the dose form, not the real products |
| `js/data/med-kit.js` | Seven in-flight complaints and ten ISS-kit medications with exact quotes (NASA kit list and briefs, FDA labels); `reviewedBy` per medication for the pharmacist's sign-off |
| `css/duty.css` | Module 9 styles (shares chips and cards with `meds.css`) |
| `js/duty-core.js` | Fit-for-duty rules, tested: sleep against NASA's 7-9 hours, low mood, recent medication with a NASA performance caution, three workload answers, honest headline (talk / gaps / ready), saved checks |
| `js/duty.js` | Module 9 screen (`#duty`, opened from Meds): task, three workload scales, live result with reasons and sources, recent checks |
| `js/data/duty.js` | Tasks, workload questions and the NASA quotes Fit for duty shows |
| `css/telemetry.css` | Module 10 styles |
| `js/telemetry-core.js` | Live telemetry rules, tested: repeatable simulated stream (seeded), scenarios (nominal, CO2 scrubber fault, solar particle event, long time still), NASA cabin limits, personal baseline band (mean ± 2 SD of the last 14 days), 10-second averaging for vitals, alerts worst first |
| `js/telemetry.js` | Module 10 screen (`#live`): status bar, scenario buttons, alerts with response steps, crew / cabin / radiation cards with 60-second sparklines, latest real solar flare from NASA DONKI. Rebuilt from a team member's prototype |
| `js/data/telemetry.js` | NASA quotes for each limit and the response steps per alert |
| `js/data/radlab-iss.js` | REAL NASA data: 505 dose-rate readings (µGy/h) from ISS DosTel1, 1 June 2024, saved from RadLab (no CORS, so it cannot be read live) |
| `js/sync-core.js` | Station sync rules, tested: station IDs, PBKDF2 token + AES key from the station code, AES-GCM seal/open, snapshots with change stamps and tombstones, merge (logs day by day, newest save wins; other keys newest wins) |
| `js/sync.js` + `css/sync.css` | Sync client: syncs on open, after every `geosfera.*` change, every 45 s and when back online; masthead status button; sheet to create or join a station |
| `lib/sync-handler.js` | Server logic, tested: token check (stored as SHA-256), version compare-and-set (409 on conflict), size limit; Lua CAS script; in-memory store |
| `api/sync.js` | Vercel function `GET/PUT /api/sync?station=ID`. Storage: **Supabase** (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, chosen by Juan Carlos); Upstash Redis still works as a fallback |
| `lib/supabase-store.js` | Supabase REST store (select + `station_cas` RPC), tested with a fake API |
| `supabase/schema.sql` | Table `stations` (RLS on, service role only) and the atomic `station_cas` function; run once in the Supabase SQL Editor |
| `dev-server.mjs` | `npm run dev`: local preview with `/api/sync` in memory |
| `css/future.css` | Module 5 styles (also keeps the masthead inside a 360 px phone) |
| `js/future-core.js` | Future body rules, tested: NASA's 1–1.5 %/month without countermeasures, the 95 % requirement, months to cross it, habits from the log, chart geometry |
| `js/future.js` | Module 5 screen (`#future`, linked from Mission and Body): mission buttons (ISS 6 months, Mars 36), month slider, fading skeleton, self-drawing chart with the requirement line and the 6-month countermeasure result, exercise and vitamin D habits |
| `js/data/future.js` | NASA quotes for Future body and the two mission presets |
| `css/sources.css` | Sources page styles (also compacts the masthead on 360 px phones) |
| `js/sources-core.js` | Sources index, tested: collects every quoted fact from the data modules, names and groups each document (NASA standards, NASA HRP, real NASA data, partner agencies, Earth references), lists the modules that use it, search filter |
| `js/sources.js` | In-app sources page (`#sources`, document button in the masthead): legend, search, documents with links, module chips and their exact quotes |
| `css/support.css` | Support button, sheet, crew alert banners, Mind page and comfort settings |
| `js/support-core.js` | Support rules, tested: build an alert (talk / emergency, reasons, note), add, acknowledge once per person, close, which alerts a crewmate should see, mood and sleep trend, comfort settings |
| `js/support.js` | The red SOS button on every screen (also over the hatch): hold 2 s to send, ring fills while holding, a tap only shows a hint; after sending, add details or cancel within 10 s. Banners with "I'm on my way" on other crew devices; comfort settings applied to the page |
| `js/mind.js` | Mind & support page (`#mind`, linked from Body and the sheet): ask for support, requests and answers, mood and sleep week, comfort settings, NASA's behavioral-health practice |
| `js/mind-core.js` | Mind map rules, tested: five signals from the member's own data (sleep, mood, alertness, home, support), each with a status and its basis, a headline that is never a score, and the status of each brain zone |
| `js/brain-core.js`, `js/brain3d.js`, `css/brain.css` | The 3D brain: shape generated by code (point cloud, tested) and drawn on a 2D canvas, no library; drag to turn, tap a zone. An illustration, not a scan; zones are a map, not anatomy |
| `js/helix-core.js`, `js/helix3d.js` | "Radiation and your DNA" on Live's Radiation tab: a double helix generated by code (tested) and drawn on a canvas; streaks follow the live dose rate. An illustration: nothing measures DNA and no DNA number is shown |
| `js/feed.js` | The one telemetry feed for the whole app: state, tick, steady alerts and events; `subscribe()`, `toggle()`, `setSleeping()`. Starts when Live or sleep mode opens and keeps running on the other screens |
| `js/alarm.js`, `css/alarm.css` | Alerts on every screen: top bar, red frame and repeating sound for "Act now" (Web Audio, no files), Silence, and sleep mode with its wake alarm and escalation to the crew |
| `js/brain-gl.js` | Day look's realistic 3D brain: a hand-written WebGL viewer (no library) for `assets/brain3d.bin` + `assets/brain3d-tex.webp` (AI-generated model): drag to turn, sway, zones tinted by status, pins that follow the model. `readMesh` and `paintZones` are tested. Falls back to the still picture `assets/brain-side.webp` |
| `css/dark.css` | The dark look: the same app as the light one with another palette. `<html>` always carries `data-theme="day"` (structure) and `data-mode="light"` or `"dark"` (colours). Colours in `css/clinic.css` are tokens (`--hull`, `--tint`, `--soft`...) so a new screen works in both looks if it uses them instead of fixed colours |
| `js/icons.js` | The app's own outline icons and `tile()` (icon on a rounded square), used beside readings and signals |
| `js/fold.js`, `css/fold.css` | Less text on phones: `fold()` blocks, `tabsHtml()` tabs, and `tidy()` (runs after every render: intro and closing note into "About this screen", every `small.src` into a "Source" block). New screens get this for free: keep using `.lede`, `.rule-note` and `small.src` |
| `js/data/support.js` | NASA behavioral-health quotes, reasons, alert levels and comfort settings |
| `js/family-core.js`, `js/family.js` | Family channel, tested: message inside a link (`#family/write` → `#family/in/<data>`), sealed inbox per crew member (`#family`), open / set aside / delete; kept on the device (sync `LOCAL_ONLY`), text only, escaped |
| `js/mailbox-core.js`, `js/mailbox.js` | Family mailbox, tested: one invite link per crew member (who it is for + mailbox id, token and AES key), messages dropped into `/api/sync` under the mailbox id and collected by the crew member's device; answers "none" where there is no sync server |
| `family.html`, `js/family-page.js` | The family's own page: only the writing form (`mountWrite` from `family.js`), no app shell |
| `js/family-notify.js`, `css/notify.css` | Announces a new message from home on any screen (sealed, "Open it" / "Later"), polls the mailbox every 8 s while the app is open, respects a paused channel |
| `js/ask.js` | In-page "Yes / Cancel" confirmation next to the button; use it instead of the browser's confirm(), which some in-app browsers block silently |
| `js/demo-core.js`, `js/demo.js` | Demo crew, tested: two fictional members (a woman and a man, each with a demo code in `DEMO_CODES`) with 14 days of simulated readings, Valentina's short-sleep story, melatonin doses and vitamin D days; load on an empty station (button or `?demo`), remove only what the demo wrote |
| `docs/SOURCES.md` | Every fact the app may show, with the exact quote and link |

## Modules

1. **Crew access — done. Preview mode is on (`START_UNLOCKED = true` in `js/app.js`): the app starts unlocked for the hackathon and the lock button still closes the hatch; set it to `false` to start locked.** Airlock design (mockup option A). Code kept only as a salted PBKDF2 hash; wrong-code waits; optional fingerprint/face (WebAuthn platform authenticator, signature checked in the app); "Forgot your code?" erases the device. It is a device lock, not encryption: say so honestly. Fingerprint needs https and a phone with a reader.
2. **Body hologram — done (Jira SCRUM-10, SCRUM-11).** Our own SVG figure (8-head proportions, anatomical position) with skeleton and organs on a ring of light, a scan line, seven body-system controls joined by lines. Tapping a system lights its organs and opens NASA's risks (exact text and links) and verified facts. Every system shows "No data" until the daily log exists. Tests check that all 17 risks are placed once and that every fact is quoted word for word in `docs/SOURCES.md`.
- **Main dashboard — the Cupola (Juan Carlos: "this goes on the main dashboard").** First screen after the hatch. Six windows (Heart, Lungs, Metabolism, Radiation, Body, Mind) around "N/6 measured". Readings come from `localStorage["geosfera.log"][YYYY-MM-DD]`, written by the daily log. Without a reading: "No data"; with a reading but no approved range: "Pending check" (◇). Tapping a window opens `#body/<system>`. Under the Cupola (like CrewCheck's Today): day stepper (`#today/<YYYY-MM-DD>`), mission strip (exercise mini ring, streak), NASA's five hazards (exact text, links to body systems), What to do now (measuring steps only, no medical advice), radiation panel (dose this day and logged total, NASA and CSA facts, limit Pending check) and every reading with a self-drawing 14-day sparkline, value, status chip and reason. Exercise and mood are habits/self-reports: status "✓ Logged", never judged.
3. **Daily check-in — done.** Like CrewCheck's check-in: numbered steps 3.01–3.09 (heart rate, blood pressure, temperature, blood oxygen, glucose, sleep, exercise, radiation dose, mood 1–5), a tick when a value is in, empty steps allowed, comma or point decimals. Impossible values (app-rule limits) block saving with "Measure again"; a jump from the last reading saves with flag "again", which the Cupola shows as ◌ Measure again. Other readings are "Pending check" until ranges have an approved source. Past days can be corrected.
4. **Data storage — A + B + cloud sync (Juan Carlos: records must appear on any device and browser).** Each device keeps its own copy and works offline; linked devices sync through a station on Supabase (Postgres) via `/api/sync` (Vercel only, not GitHub Pages). A station has an ID (ERG-XXXXXX; older GSF- IDs still accepted) and a code of 8+ characters chosen by the crew: the code derives the access token and the AES-GCM key, so the server stores only ciphertext. `geosfera.crew-access` (the hatch PIN) and `geosfera.sync` never leave the device. Earlier decision, still valid: Everything stays on the device (`localStorage`, keys `geosfera.*`). B: CSV export, JSON backup and restore (restored values are checked again; days already on the device are never overwritten). "Forgot your code?" erases only `geosfera.*` keys. Deployment target: Vercel (own domain, so storage is not shared with other apps).
5. **Mission (gamification) — done.** Exercise ring against NASA's 1.5 hours a day; check-in streak and best run; week of exercise bars that draw themselves with a 90-minute goal line; eight mission patches (first check-in, full checklist, 3- and 7-day streaks, 90 minutes, NASA week = 6 of 7 days, dosimeter on 5 days, second look after Measure again). A test proves no badge depends on a vital-sign value.
6. **Crew — done.** Several astronauts share the station device. First run asks to register the crew (name, role). Each member has their own log; the dashboard opens with a crew status row (one silhouette per member, tinted by their most urgent status) and the Cupola, check-in and Mission follow the selected member.
7. **Ranges — from the team document "AstroVital — Datos reales para el dashboard".** Readings with a range are judged Normal / Watch / Act now and show their band and source, labelled "Earth clinical reference, pending team review" with the in-flight caveat (BP about 8 mmHg lower, temperature about 1 °C higher). Radiation shows the logged total against NASA's 600 mSv career limit.
8. **Medication log — reworked with the team pharmacist (Isabel).** It does not prescribe: it logs what the crew member took, follows up on whether it worked and flags patterns worth raising with the crew medical officer. Three steps: what for (tap the body), what you took (NASA ISS kit list names and categories, 3D models), how many. Follow-up asks the kit list's own possible side effects. Patterns: over the kit list's 24-hour limit, more days in a row than it allows, two sleep medications within 24 h (all quoted); same category 3 days in a row → downlink, and twice "did not work" (illustrative app rules). Messages say "Talk it over with your crew medical officer" or "Include it in the next downlink to Earth", never "take". Supplements: vitamin D as mission-plan compliance (taken / not taken, no "did it work?"), quoting NASA's nutrition evidence report. No doses or label directions shown; inventory and expiry are future work.
9. **Fit for duty — in review (same branch).** The human-factors check an aerospace engineer advising the team asked for. Before a critical task it shows what the crew member already logged that is worth telling a crewmate: sleep under the 7-9 hours NASA cites, mood 1-2, a medication recorded in the last 8 hours that NASA's kit list cautions about ("May cause sedation and impair performance."), or a high answer to NASA-STD-3001's three workload parts (time-stress, mental effort, frustration). It never says fit or unfit: headline is "Talk it over", "Nothing flagged, but some checks have no data" or "Nothing to mention". Reads `geosfera.log` and `geosfera.meds`; saves checks in `geosfera.duty`.
10. Next modules are announced to Juan Carlos before starting. Jira and the Excel board are no longer used.

10. **Live telemetry — in review (branch `clinic-style`).** A second-by-second feed: crew heart rate, blood pressure and minutes still; cabin CO2 (mmHg and ppm), temperature, humidity and pressure, all SIMULATED and labelled; radiation dose rate is REAL RadLab data replayed. Scenario buttons show emergencies; each alert lists what to do. Vitals are compared with the team ranges and with the crew member's own baseline. The latest real solar flare comes live from NASA DONKI (CCMC), with an offline message. The timer stops when the screen is left.

5b. **Future body — in review (module 5 of the team plan).** Bone mineral density over a mission without countermeasures, with NASA's average 1–1.5 % a month (measured on 4-to-6-month missions), against NASA-STD-3001 [V1 4027] (hip and spine ≥ 95 %), and the 6-month result with countermeasures (< 5 % loss for most crews). Beyond 6 months the line is the app's extrapolation and is drawn dashed and labelled. Exercise and vitamin D are shown as habits only; no bone number is derived from them.

11. **Mind & support — in review.** A red SOS button on every screen (also over the hatch): press and hold 2 s sends the emergency in one gesture (no second screen); then add details or cancel within 10 s if it was a mistake. "I'd like to talk to someone" is one tap on the Mind page. Alerts live in `geosfera.alerts`; the station sync carries them to linked crew devices, which show a banner with "I'm on my way" / "Seen". Mission Control delivery is simulated and says so. The Mind page adds the week's mood and sleep against the crew member's own history, and comfort settings for different sensory and attention needs (calm motion, larger text, one thing at a time) — the team's neuro-inclusive design. NASA quotes: OCHMO-TB-016.

## Information rules (Juan Carlos: "real and verified, never false or biased")

- **Only official sources.** The challenge resources are NASA HRP (hazards, risks, ongoing research) and two Canadian Space Agency pages. Their facts are in `docs/SOURCES.md` with exact quotes.
- **No invented numbers.** A value shown as fact needs an entry in `docs/SOURCES.md`. Without one the app shows "Pending check". App-chosen thresholds are labelled "app rule".
- Vital ranges come from the team document (Earth clinical references: CDC, ADA, MedlinePlus — numbers only, never their wording), listed in `docs/SOURCES.md` with status ✔ / ○. Always show them as "Earth reference, pending team review".
- **Measurement before health:** impossible values and sudden jumps become "Measure again", never an alarm.
- Reading nasa.gov from this environment: use the Playwright browser with the proxy (WebFetch does not reach it). The Space Apps site fails TLS through the proxy; ask Juan Carlos to paste what is needed.

## Design guidelines from Juan Carlos

- Build **module by module**: finished, tested and pushed before the next.
- **Human figure:** as close as possible to a real human. Blue hologram, skeleton and organs visible, standing on a ring of light, an icon per body system around it joined by thin lines. The reference he shared is a watermarked stock image: **never copy it**. Draw our own or use openly licensed anatomy and credit it.
- **Gamification:** streaks, achievements, mission progress. Reward the habit of measuring, never the health values.
- **Dynamic charts:** lines that draw themselves, numbers that count up, body systems that light up.
- **Colour code**, always with a word and a shape: Normal ● teal · Watch ▲ orange · Act now ⯃ red · Measure again ◌ blue · No data — grey.
- **Futuristic instrument style everywhere** (Juan Carlos: "we must surprise NASA"): every module uses the check-in's look — glass panels, hover sweeps, digital readouts, section codes. Put shared styling in `css/instrument.css`.
- Look: night in low Earth orbit, titanium hull, one cyan accent (`--beacon`); Saira + IBM Plex Mono. Respect `prefers-reduced-motion`; touch targets ≥ 44 px.
- Commits end with the Co-Authored-By line for Claude. Keep `docs/AI_USE.md` accurate.
