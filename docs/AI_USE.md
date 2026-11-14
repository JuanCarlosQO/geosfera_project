# AI use

For the Space Apps submission form.

| Date | Tool | What it did | Human role |
| --- | --- | --- | --- |
| 14 Nov 2026 | Claude Code (Anthropic) | Read the challenge resources (NASA HRP, Canadian Space Agency) and wrote `docs/SOURCES.md` with exact quotes. Wrote module 1 (crew access): the hatch screen, the code and fingerprint logic and its unit tests, following the team's chosen mockup (option A, "Airlock"). | Juan Carlos chose the design, gave the resources and rules, and reviews and tests every module on real phones. |
| 14 Nov 2026 | Claude Code (Anthropic) | Wrote module 2 (body hologram): drew the anatomical figure as original SVG, extracted the 17 NASA risks word for word from nasa.gov, grouped them into body systems and wrote the tests that check every fact against docs/SOURCES.md. | Juan Carlos set the visual direction (realistic hologram) and the rule that every fact must be official and verified. |
| 14 Nov 2026 | Claude Code (Anthropic) | Wrote the main dashboard (the Cupola from mockup option A), its tested rules and the bottom navigation. | Juan Carlos chose the Cupola as the main dashboard. |
| 14 Nov 2026 | Claude Code (Anthropic) | Wrote module 3 (daily check-in) with its tested rules, CSV export and JSON backup/restore, and made the forgot-code reset erase only Geosfera's data. | Juan Carlos chose on-device storage with export and backup (A + B) and asked for a check-in like CrewCheck's. |
| 14 Nov 2026 | Claude Code (Anthropic) | Wrote module 4 (mission and gamification) with its tested rules. | Juan Carlos asked for gamification that rewards the habit of measuring. |
| 14 Nov 2026 | Claude Code (Anthropic) | Extended the main dashboard into a full overview (day stepper, mission strip, NASA's five hazards, what to do now, radiation, readings with sparklines) with tested rules. | Juan Carlos asked for a dashboard as complete as CrewCheck's. |
