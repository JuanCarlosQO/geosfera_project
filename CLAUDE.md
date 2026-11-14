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
| `js/app.js` | Boot, UTC clock, lock button |
| `js/access-core.js` | Pure access rules, tested: code shape, guessable codes, PBKDF2 record, wrong-code waits, WebAuthn assertion check |
| `js/hatch.js` | Module 1 screen: hatch with a ring of digits 0–9, four bolts, ISS in the porthole, fingerprint/face, forgot code, opening animation |
| `docs/SOURCES.md` | Every fact the app may show, with the exact quote and link |

## Modules

1. **Crew access — done.** Airlock design (mockup option A). Code kept only as a salted PBKDF2 hash; wrong-code waits; optional fingerprint/face (WebAuthn platform authenticator, signature checked in the app); "Forgot your code?" erases the device. It is a device lock, not encryption: say so honestly. Fingerprint needs https and a phone with a reader.
2. Next modules: agreed with Juan Carlos one at a time, announced before starting.

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
