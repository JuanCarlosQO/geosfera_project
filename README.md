# Geosfera

Daily health monitoring for astronauts. Team entry for the **NASA Space Apps Challenge 2026**, challenge *Create Health Monitoring Software for Astronauts on Space Missions*.

## Modules

Built one at a time during the hackathon (14–15 November 2026).

1. **Crew access.** The app opens behind a station hatch. Tap your 4-digit code on the ring of digits; each digit locks one of the four bolts, then the hatch opens onto the station. Optional fingerprint or face unlock.

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
