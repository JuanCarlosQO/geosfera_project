# Ergosphere

Daily health monitoring for astronauts. Team entry for the **NASA Space Apps Challenge 2026**, challenge *Create Health Monitoring Software for Astronauts on Space Missions*.

## Modules

Built one at a time during the hackathon (14–15 November 2026).

1. **Crew access.** The app opens behind a station hatch. Tap your 4-digit code on the ring of digits; each digit locks one of the four bolts, then the hatch opens onto the station. Optional fingerprint or face unlock.
- **Today (main dashboard).** After the hatch you look out of the ISS Cupola: six windows show today's state of the heart, lungs, metabolism, radiation, body and mind around a count of what you measured. Tap a window to open that system in the body hologram. Below it: a day stepper, mission progress, NASA's five hazards, what to do now, a radiation panel and every reading with a 14-day trend that draws itself.
2. **Body hologram.** A human figure drawn for Ergosphere stands on a ring of light with its skeleton and organs visible. Seven body systems surround it; tap one to light it up and read NASA's own words about the risks of spaceflight for that system, with links to nasa.gov.

3. **Daily check-in.** A numbered checklist for heart rate, blood pressure, temperature, blood oxygen, blood sugar, sleep, exercise, radiation dose and mood. Each value is checked as you type; impossible values and sudden jumps ask you to measure again instead of raising an alarm. Export to CSV, save a backup and restore it on another device. Data never leaves the device.
4. **Mission.** An exercise ring against NASA's 1.5 hours a day, a check-in streak, a week of exercise that draws itself and mission patches that reward checking in and doing the countermeasures, never what a reading says.
5. **Crew.** Several astronauts share the station device. Each one is registered with a name and role and has their own daily log. The dashboard opens with the crew at a glance: one silhouette per astronaut, tinted by their status, with key readings and a heart-rate trend. Tap someone to see their Cupola.

8. **Medication log.** It does not prescribe. It logs what you took — tap what it was for on the body, pick the medication from NASA's ISS kit list (shown in 3D), say how many — then asks whether it worked and about the side effects the kit list names, and flags patterns worth raising with the crew medical officer or including in the next downlink to Earth. Vitamin D, the one supplement NASA recommends in flight, is logged as taken or not. Ideas from NASA's Dose Tracker study: once a week it asks "anything in the last 7 days not in your log?" (doses remembered later go on their day), it keeps your own medications next to the kit list with one tap for every-day ones, and it asks how strong a side effect was (mild, moderate, severe; a severe one is raised with the crew medical officer). Any pattern worth raising can be sent to the crew medical officer in one tap, and the Today screen lists the day's reminders.

9. **Fit for duty.** A one-minute human-factors check before a spacewalk, docking or another critical task. It gathers what you already logged — last night's sleep, today's mood, any medication NASA cautions can dull performance — adds three workload questions from NASA-STD-3001, and lists what is worth telling a crewmate. It never rules you fit or unfit: people decide.

10. **Live telemetry.** A sensor feed that updates every second: heart rate, blood pressure and time still for the crew member; CO₂, temperature, humidity and pressure for the cabin; and the radiation dose rate. Crew and cabin values are simulated around NASA's nominal values and your own history; the dose rate is real NASA data from the Space Station, replayed. Buttons trigger a CO₂ scrubber fault, a solar particle event or a long time still, and every alert says what to do. The latest real solar flare comes live from NASA's DONKI service. The screen also explains the two kinds of space radiation and NASA's shelter plan for a solar particle event, and lists the exact condition behind every alert. A team member's simulator engine adds nine more simulations (cabin leak, cooling failure, fire, ammonia leak, power loss, exercise, spacewalk, dehydration, racing heart) that can run together, judges heart rate as effort during exercise, and keeps an event log.

5. **Future body.** Where the bones are heading on a long mission: NASA's average loss without countermeasures (1–1.5 % a month) against NASA's requirement to keep hip and spine at 95 % or more, on a chart that draws itself and a skeleton that fades month by month, from a 6-month Space Station increment to a three-year Mars mission. Beside it, your own exercise and vitamin D habits.

11. **Mind & support.** A red SOS button on every screen, even with the app locked: press and hold it for 2 seconds and the emergency is sent — one gesture, hard to trigger by accident, cancellable for 10 seconds. "I'd like to talk to someone" is one tap on the Mind page. With a station linked, every crewmate's device shows the alert and can answer "I'm on my way"; Mission Control delivery is simulated. The Mind page shows the week's mood and sleep against your own history and offers comfort settings for different sensory and attention needs: calm motion, larger text, one thing at a time. A family channel carries messages from home: a family member writes a short text that travels inside a link, it arrives sealed on the crew member's device, and they choose whether and when to open it. It can carry a photo or a short voice note, be paused, and asks after each read how it left them.

## Plan

The build plan, with every task and its status, is public in [docs/PLAN.md](docs/PLAN.md).

## Sync across devices (Vercel)

Records appear on every linked device and browser. Each device keeps working offline and syncs when it can. The data is encrypted on the device with the station code, so the server only stores ciphertext.

1. Deploy the repository on Vercel.
2. In the Vercel project: **Storage → Marketplace → Upstash Redis → Create** and connect it to the project (the free plan is enough). Vercel adds the database URL and token as environment variables; redeploy.
3. In the app, tap **Sync** (top right) → **New station**, choose a station code (8+ characters) and note the station ID.
4. On every other device: **Sync → Join a station** with that ID and code.

`npm run dev` runs the app with an in-memory sync server for testing.

## Run

No build step, no dependencies.

```bash
npm start   # http://localhost:8000
npm test    # unit tests, Node 20+
```

**Demo crew.** On an empty station, "Load demo crew" (or a link ending in `?demo`, for example https://juancarlosqo.github.io/geosfera_project/?demo) fills the app with three fictional crew members — Valentina Reyes, Tomás Okafor and Amara Lindqvist — and two weeks of simulated readings. They are not real astronauts: NASA publishes no individual crew health data, so a real name would mean inventing records about a real person. The app marks the demo as SIMULATED, and "Remove demo crew" on the Today screen takes away only what the demo wrote.

Fingerprint or face unlock needs https (for example GitHub Pages) and a phone with a reader.

## Privacy and security

**Preview mode is on:** for the hackathon the app starts already unlocked, so anyone with the link can look around. The hatch still works from the lock button in the top bar. To start behind the hatch again, set `START_UNLOCKED` to `false` in `js/app.js`.

Crew access is a **device lock, not encryption**. The code is never stored: only a salted PBKDF2-SHA256 hash stays on the device. After five wrong codes the app makes you wait, doubling each time up to 15 minutes. "Forgot your code?" erases what Ergosphere saved on that device. Fingerprints never reach the app: the phone checks them and the app verifies the phone's signed answer.

## Sources

Inside the app, the document button in the top bar opens **Sources**: every document behind a fact the app shows, grouped, with links, the screens that use it and its exact quotes, built from the same data the screens read.

Every health fact Ergosphere shows comes from an official source listed in [docs/SOURCES.md](docs/SOURCES.md).
