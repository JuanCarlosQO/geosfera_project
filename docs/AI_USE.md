# AI use

For the Space Apps submission form: what we used AI for and what it did. The summary comes first; the tables list every AI-assisted piece of work in order.

## Summary

We used **Claude Code** (Anthropic; models Claude Fable 5.2 and Claude Opus 5.5) as a coding and research assistant, and **Gemini Notebook** (Google, with its Deep Research search) to collect sources. AI wrote most of the code and its unit tests, searched official sources (NASA standards and technical briefs, NASA Human Research Program evidence reports, NASA's ISS medical kit list, NASA RadLab and DONKI data, FDA labels) and drafted text.

**How facts were checked.** Every health fact the app shows is quoted word for word in `docs/SOURCES.md` with its link, and automated tests fail if a quote is missing. FDA label quotes were checked by program against openFDA; NASA quotes were read in the original PDF text. Where no source was found, the app says "Pending check" or labels the value an app rule.

**Human review.** The team reviewed every module before it was published, and the medication content was reviewed by the team's pharmaceutical chemist.

**What the app does not do.** The app contains no AI: it runs fixed, sourced rules in the browser. It does not diagnose or prescribe. Values that are not real crew data are labelled "simulated". The body figure and the 3D medication models are original drawings made in code, not NASA images; no NASA logo or branding is used.

## Work done outside the repository

| Date | Tool | What the AI did |
| --- | --- | --- |
| 14 Nov 2026 | Gemini Notebook (Google) | Team notebook "Arquitectura de Salud y Monitoreo para Misiones Espaciales": collected 25 sources (challenge page and videos, NASA-STD-3001, OCHMO briefs, RadLab and OSDR APIs, research papers) and a Deep Research report. |
| 14 Nov 2026, morning (UTC−5) | Claude Code (Anthropic), model Claude Opus 5.5 | Read the challenge text and resources, summarised what it asks, and asked the team the questions to define the project; drafted team roles and questions for an aerospace engineering student. |
| 14 Nov 2026, 10:30–11:10 (UTC−5) | Claude Code (Anthropic), model Claude Opus 5.5, with research sub-agents | Researched real values for the dashboard (cabin atmosphere and radiation limits in NASA-STD-3001, vital-sign reference ranges, effects of spaceflight, NASA data sources usable from a browser) and wrote the team document "AstroVital — Datos reales para el dashboard" (PDF). Checked the key figures in the original PDFs and tested the NASA APIs from a browser. |
| 14 Nov 2026, 11:30–14:00 (UTC−5) | Claude Code (Anthropic), model Claude Fable 5.2 | Wrote the pharmacist's verification sheet "Hoja de verificación de medicamentos" (PDF) from the app's own medication data. |
| 14 Nov 2026, 19:00 (UTC−5) | Claude Code (Anthropic), model Claude Opus 5.5, with a research sub-agent | Checked the pharmacist's vitamin proposal against NASA's nutrition evidence report: vitamin D kept, vitamins C, E and B left out as open questions. |

## Log of changes in this repository

| Date | Tool | What the AI did |
| --- | --- | --- |
| 14 Nov 2026 | Claude Code (Anthropic) | Read the challenge resources (NASA HRP, Canadian Space Agency) and wrote `docs/SOURCES.md` with exact quotes. Wrote module 1 (crew access): the hatch screen, the code and fingerprint logic and its unit tests, following the team's chosen mockup (option A, "Airlock"). |
| 14 Nov 2026 | Claude Code (Anthropic) | Wrote module 2 (body hologram): drew the anatomical figure as original SVG, extracted the 17 NASA risks word for word from nasa.gov, grouped them into body systems and wrote the tests that check every fact against docs/SOURCES.md. |
| 14 Nov 2026 | Claude Code (Anthropic) | Wrote the main dashboard (the Cupola from mockup option A), its tested rules and the bottom navigation. |
| 14 Nov 2026 | Claude Code (Anthropic) | Wrote module 3 (daily check-in) with its tested rules, CSV export and JSON backup/restore, and made the forgot-code reset erase only Ergosphere's data. |
| 14 Nov 2026 | Claude Code (Anthropic) | Wrote module 4 (mission and gamification) with its tested rules. |
| 14 Nov 2026 | Claude Code (Anthropic) | Extended the main dashboard into a full overview (day stepper, mission strip, NASA's five hazards, what to do now, radiation, readings with sparklines) with tested rules. |
| 14 Nov 2026 | Claude Code (Anthropic) | Redesigned the daily check-in as a futuristic flight procedure (instrument modules, nudges, live deltas, telemetry receipt). |
| 14 Nov 2026 | Claude Code (Anthropic) | Applied the check-in's futuristic instrument style to the dashboard, Mission and Body modules, and added Vercel cache headers. |
| 14 Nov 2026, 11:30–14:00 (UTC−5) | Claude Code (Anthropic), model Claude Fable 5.2, with research sub-agents | Researched medications in spaceflight from official sources (NASA ISS medical kit list, NASA OCHMO technical briefs, NASA HRP evidence report, FDA labels through openFDA, NIH NCCIH) and checked every label quote by program against the FDA label text. Wrote module 8 (onboard medications): `js/meds-core.js`, `js/meds.js`, `js/data/med-kit.js`, `css/meds.css`, `tests/meds-core.test.js`, `tests/meds-data.test.js`; added the Meds route and dock link in `index.html` and `js/app.js`; added the module's section to `docs/SOURCES.md` and notes in `README.md`, `CLAUDE.md` and `docs/PLAN.md`. |
| 14 Nov 2026, 14:00–15:00 (UTC−5) | Claude Code (Anthropic), model Claude Fable 5.2 | Merged the medications branch with the latest `main`. Wrote module 9 (fit for duty): `js/duty-core.js`, `js/duty.js`, `js/data/duty.js`, `css/duty.css`, `tests/duty-core.test.js`; added the `#duty` route in `js/app.js`, the style link in `index.html`, a link from the Meds screen, a `performance` caution per medication in `js/data/med-kit.js`, and the module's section in `docs/SOURCES.md` with quotes read in NASA-STD-3001 Vol. 1 Rev. C and NASA's sleep brief. |
| 14 Nov 2026, 17:00–17:45 (UTC−5) | Claude Code (Anthropic), model Claude Fable 5.2 | Reworked module 8 into a visual flow: `js/meds.js` (tap a zone on the body figure, three numbered steps, kit shelf), new `js/data/med-zones.js` and `js/pill3d.js` (CSS-only 3D models), styles in `css/meds.css`, a form and colour per medication in `js/data/med-kit.js`, two new data tests. No medical content changed. |
| 14 Nov 2026, 17:50 (UTC−5) | Claude Code (Anthropic), model Claude Fable 5.2 | Added a preview mode in `js/app.js` (`START_UNLOCKED`): the app starts unlocked; the hatch still opens from the lock button. Noted it in `README.md` and `CLAUDE.md`. |
| 14 Nov 2026 | Claude Code (Anthropic) | Made Ergosphere multi-crew (registration, per-member logs, crew status row with silhouettes) and applied the vital ranges and radiation limits from the team research document, with tests. |
| 14 Nov 2026, 18:00–19:00 (UTC−5) | Claude Code (Anthropic), model Claude Fable 5.2 / Claude Opus 5.5 | Day look and clinical dashboard: `css/clinic.css`, `js/clinic.js`, `js/clinic-core.js` with tests, day/night switch in `js/app.js`, Outfit font; renamed the visible project name to Ergosphere. Live telemetry: reviewed a team member's prototype (`js/telemetry.js` imported a missing `telemetry-core.js` and was not linked) and rebuilt it as module 10 with `js/telemetry-core.js`, `js/data/telemetry.js`, `css/telemetry.css` and tests; saved real NASA RadLab dose-rate data in `js/data/radlab-iss.js`; read NASA CO2 limits in OCHMO-TB-004. Fixed Fit for duty to read the active crew member's log. |
| 14 Nov 2026 | Claude Code (Anthropic) | Added encrypted station sync across devices (Vercel function on Upstash Redis, client-side AES-GCM, conflict merge) with tests and a two-device browser test. |
| 14 Nov 2026, 19:00 (UTC−5) | Claude Code (Anthropic), model Claude Opus 5.5 | Reworked module 8 into a medication log that does not prescribe: rewrote `js/meds-core.js`, `js/meds.js` and their tests; added kit categories, kit-list side effects and limits to `js/data/med-kit.js`; turned the body zones into "what for"; added `js/data/supplements.js` (vitamin D) after checking NASA's nutrition evidence report, and left vitamins C, E and B out because that report treats them as open questions. |
| 14 Nov 2026, 19:15 (UTC−5) | Claude Code (Anthropic), model Claude Opus 5.5 | Wrote module 5 (future body): `js/future-core.js`, `js/future.js`, `js/data/future.js`, `css/future.css`, `tests/future-core.test.js`; read NASA-STD-3001 Vol. 1 [V1 4027], its rationale and [V1 4028] in the PDF text; linked it from Mission and Body; kept the masthead inside small phones after the sync button was added. |
| 14 Nov 2026, 19:30 (UTC−5) | Claude Code (Anthropic), model Claude Opus 5.5 | Wrote the in-app sources page: `js/sources-core.js` (builds the list from the app's own data modules), `js/sources.js`, `css/sources.css`, `tests/sources-core.test.js`; added a masthead button and the `#sources` route. |
| 14 Nov 2026, 19:45 (UTC−5) | Claude Code (Anthropic), model Claude Opus 5.5 | Wrote Mind & support: `js/support-core.js`, `js/support.js`, `js/mind.js`, `js/data/support.js`, `css/support.css`, `tests/support-core.test.js`; read NASA OCHMO-TB-016 (behavioral health) in the PDF text; added the `#mind` route, the Support button and a link from Body. |
