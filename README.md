# Geosfera

Daily health monitoring for astronauts. Team entry for the **NASA Space Apps Challenge 2026**, challenge *Create Health Monitoring Software for Astronauts on Space Missions*.

## Modules

Built one at a time during the hackathon (14–15 November 2026).

1. **Crew access.** The app opens behind a station hatch. Tap your 4-digit code on the ring of digits; each digit locks one of the four bolts, then the hatch opens onto the station. Optional fingerprint or face unlock.
- **Today (main dashboard).** After the hatch you look out of the ISS Cupola: six windows show today's state of the heart, lungs, metabolism, radiation, body and mind around a count of what you measured. Tap a window to open that system in the body hologram.
2. **Body hologram.** A human figure drawn for Geosfera stands on a ring of light with its skeleton and organs visible. Seven body systems surround it; tap one to light it up and read NASA's own words about the risks of spaceflight for that system, with links to nasa.gov.

3. **Daily check-in.** A numbered checklist for heart rate, blood pressure, temperature, blood oxygen, blood sugar, sleep, exercise, radiation dose and mood. Each value is checked as you type; impossible values and sudden jumps ask you to measure again instead of raising an alarm. Export to CSV, save a backup and restore it on another device. Data never leaves the device.

## Plan

The build plan, with every task and its status, is public in [docs/PLAN.md](docs/PLAN.md).

## Run

No build step, no dependencies.

```bash
npm start   # http://localhost:8000
npm test    # unit tests, Node 20+
```

Fingerprint or face unlock needs https (for example GitHub Pages) and a phone with a reader.

## Privacy and security

Crew access is a **device lock, not encryption**. The code is never stored: only a salted PBKDF2-SHA256 hash stays on the device. After five wrong codes the app makes you wait, doubling each time up to 15 minutes. "Forgot your code?" erases what Geosfera saved on that device. Fingerprints never reach the app: the phone checks them and the app verifies the phone's signed answer.

## Sources

Every health fact Geosfera shows comes from an official source listed in [docs/SOURCES.md](docs/SOURCES.md).
