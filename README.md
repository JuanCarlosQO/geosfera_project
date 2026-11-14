# Geosfera

Daily health monitoring for astronauts. Team entry for the **NASA Space Apps Challenge 2026**, challenge *Create Health Monitoring Software for Astronauts on Space Missions*.

## Modules

Built one at a time during the hackathon (14–15 November 2026).

1. **Crew access.** The app opens behind a station hatch. Tap your 4-digit code on the ring of digits; each digit locks one of the four bolts, then the hatch opens onto the station. Optional fingerprint or face unlock.
- **Today (main dashboard).** After the hatch you look out of the ISS Cupola: six windows show today's state of the heart, lungs, metabolism, radiation, body and mind around a count of what you measured. Tap a window to open that system in the body hologram. Below it: a day stepper, mission progress, NASA's five hazards, what to do now, a radiation panel and every reading with a 14-day trend that draws itself.
2. **Body hologram.** A human figure drawn for Geosfera stands on a ring of light with its skeleton and organs visible. Seven body systems surround it; tap one to light it up and read NASA's own words about the risks of spaceflight for that system, with links to nasa.gov.

3. **Daily check-in.** A numbered checklist for heart rate, blood pressure, temperature, blood oxygen, blood sugar, sleep, exercise, radiation dose and mood. Each value is checked as you type; impossible values and sudden jumps ask you to measure again instead of raising an alarm. Export to CSV, save a backup and restore it on another device. Data never leaves the device.
4. **Mission.** An exercise ring against NASA's 1.5 hours a day, a check-in streak, a week of exercise that draws itself and mission patches that reward checking in and doing the countermeasures, never what a reading says.
5. **Crew.** Several astronauts share the station device. Each one is registered with a name and role and has their own daily log. The dashboard opens with the crew at a glance: one silhouette per astronaut, tinted by their status, with key readings and a heart-rate trend. Tap someone to see their Cupola.

8. **Onboard medications.** Tap on the body where it bothers you: the zone lights up and Geosfera lists the common in-flight complaints that fit, what NASA says to try first and what the ISS medical kit holds for it, in the label's own words, each medication as a 3D model you can turn. It follows the label's interval and daily limit, warns about a past date or a combination a source cautions against, records each dose and later asks whether it worked. It never diagnoses, and every medication entry is marked "Pending check" until the team's pharmacist has reviewed it.

9. **Fit for duty.** A one-minute human-factors check before a spacewalk, docking or another critical task. It gathers what you already logged — last night's sleep, today's mood, any medication NASA cautions can dull performance — adds three workload questions from NASA-STD-3001, and lists what is worth telling a crewmate. It never rules you fit or unfit: people decide.

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

**Preview mode is on:** for the hackathon the app starts already unlocked, so anyone with the link can look around. The hatch still works from the lock button in the top bar. To start behind the hatch again, set `START_UNLOCKED` to `false` in `js/app.js`.

Crew access is a **device lock, not encryption**. The code is never stored: only a salted PBKDF2-SHA256 hash stays on the device. After five wrong codes the app makes you wait, doubling each time up to 15 minutes. "Forgot your code?" erases what Geosfera saved on that device. Fingerprints never reach the app: the phone checks them and the app verifies the phone's signed answer.

## Sources

Every health fact Geosfera shows comes from an official source listed in [docs/SOURCES.md](docs/SOURCES.md).
