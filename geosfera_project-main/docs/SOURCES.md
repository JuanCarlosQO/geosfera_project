# Sources

Official sources behind every fact Geosfera may show. Read on the pages themselves on 14 November 2026; quotes are exact. The challenge resources are the three NASA Human Research Program pages and the two Canadian Space Agency pages listed on the Space Apps challenge page.

| Fact | Exact words | Source |
| --- | --- | --- |
| Five hazards | "space radiation, isolation and confinement, distance from Earth, gravity (and the lack of it), and closed or hostile environments" | https://www.nasa.gov/hrp/hazards/ |
| Distance to Mars | "Mars is, on average, 140 million miles from Earth." … "roughly three years" | https://www.nasa.gov/hrp/hazards/ |
| Mars gravity | "three-eighths of Earth's gravitational pull for up to two years" | https://www.nasa.gov/hrp/hazards/ |
| Bone loss | "on average, bones lose between 1% and 1.5% of their density each month during four-to-six-month missions" | https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/ |
| Height | "the height of crew members can increase as much as 3% in space" | same page |
| Exercise | "Six to seven days a week … resistance training and aerobic exercises for 1.5 hours per day" | https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/ |
| Fitness loss | "average losses to strength and aerobic fitness are 10-12% of pre-mission levels" … "between 12-38% of space station crew members lose more than 20% of their pre-mission fitness" | same page |
| Eyes (SANS) | "Approximately 70 percent of astronauts aboard the International Space Station experience some swelling in the back of their eyes." | https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/ |
| Sunrises | "Astronauts witness 16 sunrises and sunsets per day aboard the space station" | https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/ |
| Heart | low gravity can lead to "blood clots, heart arrythmias, cardiovascular disease, and low blood pressure which elevates the chances of fainting at landing"; the heart can become "more spherical" | https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/ |
| Hypoxia | "Mild hypoxia, if untreated, can cause confusion, headaches, vision impairment, and trouble sleeping." Risk "relatively low" | https://www.nasa.gov/reference/risk-of-hypoxia/ |
| Radiation | ISS missions are "entirely within the magnetosphere"; Moon and Mars "will extend beyond this protective bubble" | https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/ |
| Neutrons | "Neutron radiation, which contributes to about 30% of total radiation on the ISS" (CANS instrument) | https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp |
| Experiments | "On average, there are 200 international space experiments on board the ISS at any given time." | https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp |
| Space ≈ ageing | "effects observed in astronauts are similar to accelerated aging and health problems caused by a sedentary lifestyle" | same CSA page |
| What NASA measures (Standard Measures) | "activity and light exposure (gathered through a wrist sensor), sleep reports, fluid samples …, saliva …, cognition tests …, sensorimotor tests …, total body strength test" | https://www.nasa.gov/reference/standard-measures/ |
| 17 risks | Full list in https://www.nasa.gov/hrp/risks/ (11 physiology, 5 behaviour/human factors, 1 radiation) | https://www.nasa.gov/hrp/risks/ |


## The five hazards (exact text)

Source: https://www.nasa.gov/hrp/hazards/

| Hazard | Exact words |
| --- | --- |
| Space Radiation | "Invisible to the human eye, space radiation is not only stealthy but considered one of the most hazardous aspects of spaceflight." |
| Isolation and Confinement | "Behavioral responses occur among groups of people far from Earth who are isolated and confined in a small space over a long period of time." |
| Distance from Earth | "Instructions, new supplies, medical care, and more become increasingly challenging to receive from Earth as astronauts venture deeper into space." |
| Gravity Fields | "Astronauts' entire bodies – muscles, bones, inner ear, and organs – must adjust to the new gravities encountered on the space station or their spacecraft, as well as on the Moon, Mars, and Earth once they return home." |
| Hostile/Closed Environments | "Maintaining a safe ecosystem inside a spacecraft presents unique challenges, from ensuring optimal temperatures, pressures, and lighting, to reducing noise, monitoring microbial communities, and tracking immune responses." |

## Module 8 — onboard medications

Read on 14 November 2026. These sources are outside the five challenge resources; they are official NASA, NIH and FDA documents and still need the lead's approval as sources and the team pharmacist's review of every medication entry. Until an entry is signed off (`reviewedBy` in `js/data/med-kit.js`) the app shows it as "Pending check".

- **NASA ISS medical kit list** — "3.001 Medical Kit – Contents and Reference" (MED CL/SpX-6, 09 APR 15), NASA public release. Gives each medication's strength, possible side effects and comments. Table cells are quoted word for word with line breaks removed.
- **NASA OCHMO technical briefs** — MTB-004 Rev A Space Adaptation Sickness, MTB-012 Rev B Pharmaceutical Care, TB-004 Rev D Carbon Dioxide, Sleep Accommodations Rev A. NASA states these briefs describe practice and are "not to deliver direct medical care recommendations or guidance for individuals"; the app repeats that.
- **NASA Human Research Program** — evidence report on medication stability (20 Dec 2023) and the Human Research Roadmap page on skin rash.
- **FDA drug labels** — read through the openFDA label API; every label quote below was checked by program as an exact part of the label text. Links go to the same label on DailyMed by its set id. Bullets and line breaks of the label are removed.
- **NIH NCCIH** — melatonin is a dietary supplement with no FDA label.

| Fact | Exact words | Source |
| --- | --- | --- |
| Space motion sickness: how common | "affects up to 73% of crewmembers during the first 2-3 days of spaceflight" | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Space motion sickness: first steps | "Training to minimize head and provocative movements" | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Space motion sickness: first steps | "Increased air movement/circulation" | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Space motion sickness: first steps | "Maintain hydration" | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Space motion sickness: when to tell the medical officer | "includes more than 2 episodes of vomiting; significant performance decrement may be apparent; symptoms may persist beyond 72 hours" | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Headache: how common | "Headaches are reported by up to 90% of astronauts during the first few days." | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Headache: first steps | "To keep the risk of headache below 1%, average 7-day CO2 needs to be maintained below 2.5 mmHg" | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf |
| Headache: first steps | "Treatment includes sleep, exercise, hydration, coffee intake, and analgesics including acetaminophen, aspirin, or NSAIDS." | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Headache: first steps | "a headache can be caused by congestion, fluid shifts, elevated CO2" | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf |
| Head and nose congestion: how common | "The SAS related nasal congestion lasts from a few hours to a few days" | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Head and nose congestion: first steps | "fluid shifts to the head can appear as nasal congestion but will not be relieved by decongestants" | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf |
| Head and nose congestion: first steps | "No significant side effects within prescribed dose" | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Head and nose congestion: when to tell the medical officer | "symptoms do not improve within 7 days or occur with a fever" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=00a8327b-41f0-4498-ad13-331256b539f9 |
| Trouble sleeping: how common | "astronauts sleep an average of about six hours while in space" | https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf |
| Trouble sleeping: first steps | "Exposure to light at inappropriate times leads to circadian misalignment, which causes sleep disruption." | https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf |
| Trouble sleeping: first steps | "environmental factors (e.g., noise, temperature, vibration, and light) inhibit sleep and impact well-being in space" | https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf |
| Space adaptation back pain: how common | "Space Adaptation Back Pain (SABP) occurs in 52% of space travelers during the first 2-5 days of flight." | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Space adaptation back pain: first steps | "Positioning exercises, analgesic medications, and exercise are used to manage symptoms" | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Skin rash: how common | "Skin rashes are a common problem in space flight, and may be caused by a contact dermatitis (irritant or allergic in nature) or infection." | https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Skin_Rash.pdf |
| Skin rash: first steps | "Contact dermatitis may result from irritants or allergens found in the space craft cabin coming in contact with the skin." | https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Skin_Rash.pdf |
| Skin rash: when to tell the medical officer | "3 reports of ineffective medication use involved topical rash treatments." | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf |
| Constipation: how common | "Some crew experience constipation that may be caused by alterations in bowel induced by microgravity." | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Constipation: first steps | "Crew is treated with fluid management and fiber in diet; stool softeners and laxatives are available if needed" | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Constipation: when to tell the medical officer | "you need to use a laxative for more than 1 week" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=02358772-6724-4f1a-b3d8-bc36e58b5cfc |
| Acetaminophen 325 mg: use | "temporarily relieves minor aches and pains due to: headache muscular aches backache" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=01f41fae-4abb-4b96-ab09-a7d3dfc286cd |
| Acetaminophen 325 mg: directions | "take 2 caplets every 4 to 6 hours while symptoms last do not take more than 10 caplets in 24 hours, unless directed by a doctor" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=01f41fae-4abb-4b96-ab09-a7d3dfc286cd |
| Acetaminophen 325 mg: Label: liver warning | "more than 4,000 mg of acetaminophen in 24 hours" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=01f41fae-4abb-4b96-ab09-a7d3dfc286cd |
| Acetaminophen 325 mg: Label: do not use | "with any other drug containing acetaminophen (prescription or nonprescription)" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=01f41fae-4abb-4b96-ab09-a7d3dfc286cd |
| Acetaminophen 325 mg: NASA kit list: comments | "No more than 12 tablets every 24 hours." | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Ibuprofen 400 mg: use | "indicated for relief of mild to moderate pain" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=00872852-680a-41b3-901b-b991b12a176d |
| Ibuprofen 400 mg: directions | "Mild to moderate pain: 400 mg every 4 to 6 hours as necessary for relief of pain" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=00872852-680a-41b3-901b-b991b12a176d |
| Ibuprofen 400 mg: NASA kit list: comments | "No more than 8 tablets every 24 hours. Take with food." | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Ibuprofen 400 mg: NASA kit list: possible side effects | "Dizziness, nervousness, upset stomach, nausea, vomiting, rash, ringing in the ears" | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Ibuprofen 400 mg: Label: daily limit | "Do not exceed 3200 mg total daily dose" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=00872852-680a-41b3-901b-b991b12a176d |
| Meclizine 25 mg: use | "prevention and treatment of these symptoms associated with motion sickness: nausea vomiting dizziness" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=30387e63-278d-412a-bcad-7965c7c0aea7 |
| Meclizine 25 mg: directions | "1 to 2 tablets once daily, or as directed by a doctor" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=30387e63-278d-412a-bcad-7965c7c0aea7 |
| Meclizine 25 mg: NASA kit list: comments | "May cause sedation and impair performance. Do not use with sleep meds." | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Meclizine 25 mg: NASA kit list: possible side effects | "Drowsiness, headache, fatigue, nervousness, dizziness, dry mouth, blurred vision" | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Meclizine 25 mg: Label: when using | "alcohol, sedatives, and tranquilizers may increase drowsiness" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=30387e63-278d-412a-bcad-7965c7c0aea7 |
| Meclizine 25 mg: ask first | "Do not use with sleep meds." | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Promethazine 25 mg: use | "Active and prophylactic treatment of motion sickness" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2d996287-9eed-265a-e063-6294a90a6969 |
| Promethazine 25 mg: directions | "The average adult dose is 25 mg taken twice daily" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2d996287-9eed-265a-e063-6294a90a6969 |
| Promethazine 25 mg: Label: repeat dose | "one-half to one hour before anticipated travel and be repeated 8 to 12 hours later, if necessary" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2d996287-9eed-265a-e063-6294a90a6969 |
| Promethazine 25 mg: Label: warning | "may cause marked drowsiness" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2d996287-9eed-265a-e063-6294a90a6969 |
| Oxymetazoline nasal spray 0.05 %: use | "temporarily relieves sinus congestion and pressure" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0f5ec576-f788-40aa-9088-0dd672e3cc7c |
| Oxymetazoline nasal spray 0.05 %: directions | "2 or 3 sprays in each nostril not more often than every 10 to 12 hours. Do not exceed 2 doses in any 24-hour period." | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0f5ec576-f788-40aa-9088-0dd672e3cc7c |
| Oxymetazoline nasal spray 0.05 %: NASA kit list: comments | "Do not use more than 3 consecutive days. Rebound congestion with prolonged use." | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Oxymetazoline nasal spray 0.05 %: Label: when using | "Frequent or prolonged use may cause nasal congestion to recur or worsen" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0f5ec576-f788-40aa-9088-0dd672e3cc7c |
| Pseudoephedrine 12-hour 120 mg: use | "temporarily relieves nasal congestion due to the common cold, hay fever or other upper respiratory allergies" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=00a8327b-41f0-4498-ad13-331256b539f9 |
| Pseudoephedrine 12-hour 120 mg: directions | "take 1 tablet every 12 hours do not take more than 2 tablets in 24 hours" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=00a8327b-41f0-4498-ad13-331256b539f9 |
| Pseudoephedrine 12-hour 120 mg: NASA kit list: possible side effects | "Dizziness, rapid heart rate, high blood pressure, restlessness, tremor, headache, loss of appetite, may impair ability to concentrate, dry mouth, insomnia, photosensitivity" | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Pseudoephedrine 12-hour 120 mg: Label: stop and ask if | "nervousness, dizziness, or sleeplessness occur" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=00a8327b-41f0-4498-ad13-331256b539f9 |
| Pseudoephedrine 12-hour 120 mg: in flight | "Treatment: pharmaceuticals such as pseudoephedrine (congestion or allergy medications)." | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf |
| Melatonin 3 mg: use | "In the United States, melatonin is considered a dietary supplement." | https://www.nccih.nih.gov/health/melatonin-what-you-need-to-know |
| Melatonin 3 mg: directions | "Short-term use of melatonin supplements appears to be safe for most people, but information on the long-term safety of supplementing with melatonin is lacking." | https://www.nccih.nih.gov/health/melatonin-what-you-need-to-know |
| Melatonin 3 mg: NASA kit list: comments | "Do not use with other sleep meds." | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Melatonin 3 mg: NASA kit list: possible side effects | "Headache, nausea, drowsiness, dizziness" | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Zolpidem 10 mg: use | "short-term treatment of insomnia characterized by difficulties with sleep initiation" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=747949c5-2c91-4909-8a07-71b6826f8e97 |
| Zolpidem 10 mg: directions | "recommended initial dose is 5 mg for women and either 5 or 10 mg for men" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=747949c5-2c91-4909-8a07-71b6826f8e97 |
| Zolpidem 10 mg: Label: daily limit | "should not exceed 10 mg once daily immediately before bedtime" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=747949c5-2c91-4909-8a07-71b6826f8e97 |
| Zolpidem 10 mg: Label: same night | "should not be readministered during the same night" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=747949c5-2c91-4909-8a07-71b6826f8e97 |
| Zolpidem 10 mg: NASA kit list: possible side effects | "Drowsiness, dizziness, headache, abnormal dreams, insomnia, memory impairment, visual and attention disturbance" | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Hydrocortisone cream 1 %: use | "temporarily relieves itching associated with minor skin irritations, inflammation, and rashes" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=01cb7b47-2c3c-707d-e063-6294a90a5d97 |
| Hydrocortisone cream 1 %: directions | "apply to affected area not more than 3 to 4 times daily" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=01cb7b47-2c3c-707d-e063-6294a90a5d97 |
| Hydrocortisone cream 1 %: Label: stop and ask if | "condition worsens, symptoms persist for more than 7 days or clear up and occur again within a few days" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=01cb7b47-2c3c-707d-e063-6294a90a5d97 |
| Hydrocortisone cream 1 %: Label | "For external use only" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=01cb7b47-2c3c-707d-e063-6294a90a5d97 |
| Bisacodyl 5 mg: use | "for temporary relief of occasional constipation and irregularity" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=02358772-6724-4f1a-b3d8-bc36e58b5cfc |
| Bisacodyl 5 mg: directions | "take 1 to 3 tablets in a single daily dose" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=02358772-6724-4f1a-b3d8-bc36e58b5cfc |
| Bisacodyl 5 mg: Label: what to expect | "this product generally produces bowel movement in 6 to 12 hours" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=02358772-6724-4f1a-b3d8-bc36e58b5cfc |
| Bisacodyl 5 mg: Label: when using | "do not use within 1 hour after taking an antacid or milk" | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=02358772-6724-4f1a-b3d8-bc36e58b5cfc |
| Bisacodyl 5 mg: NASA kit list: possible side effects | "Mild abdominal cramps, nausea, vomiting, dizziness" | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Kit: carried | "To provide a contents list of each medical pack including medications, potential medication side effects, other contents, locations, and supportive information." | https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf |
| Kit: shelfLife | "Expiration Concerns include long duration spaceflight planned for 1-5 years which will be beyond the current average medication expiration dates of 1-2 years." | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf |
| Kit: expired | "it remains unclear whether spaceflight has any measurable effect on pharmaceutical stability" | https://ntrs.nasa.gov/citations/20230018496 |
| Kit: record | "how well it seemed to work, how frequently doses were repeated, and if the medication seemed to cause side effects" | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf |

### Open points for the pharmacist

- **Acetaminophen 325 mg:** the NASA kit list says "No more than 12 tablets every 24 hours."; the current label says 10. The app follows the lower limit.
- **Zolpidem:** the 2015 kit list carries 10 mg tablets; the label's starting dose for women is 5 mg. The app shows both and sends the crew member to the flight surgeon.
- **Ibuprofen 400 mg, promethazine and zolpidem** are prescription medications: the app marks them "Rx" and does not replace the flight surgeon's instructions.
- **Melatonin:** no official label dose was found; the app shows no dose.
- **Labels are from one manufacturer each** (named in the app). Other brands may word directions differently.
- The kit list is from 2015; the current ISS formulary may differ.

### App rules in this module (not medical facts)

When "Did it work?" is asked after each medication · the 30-day "Use first" notice · two doses in a row that did not work → "tell your crew medical officer" · looking back 24 hours for combinations a source warns about · the "Any of these?" list that sends the crew member to a person · matching symptoms to complaints (a complaint is listed when at least one of its main symptoms is picked). Stock and expiry dates in the demo kit are simulated.

## Module 9 — fit for duty

Read on 14 November 2026 in the PDF text of NASA-STD-3001 Volume 1 Revision C (section 4.3, page 35) and NASA's OCHMO technical brief on sleep accommodations. The medication cautions it shows are the NASA kit-list quotes already listed under Module 8.

| Fact | Exact words | Source |
| --- | --- | --- |
| Sleep an adult needs | "an average adult needs 7-9 hours of sleep for optimal daytime functioning" | https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf |
| Why sleep matters before a task | "Sleep loss and fatigue can cause errors in judgment and impairments to memory and cognition" | https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf |
| What cognitive workload is | "perceived level of time-stress, mental effort, and frustration required to complete a task" | https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf |
| What high workload does | "Perceived high or low workload can lead to crew hurrying, compromised performance, and increased crew stress" | https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf |
| Limits for critical tasks [V1 4014] | "shall have established limits to assure continued crew health and safety" | https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf |
| Monitoring through the mission | "cognitive state will be assessed and monitored through all mission phases" | https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf |

App rules in this module (not NASA limits): the 1–5 scale for the three workload questions and flagging 4 or 5 · flagging mood 1 or 2 · counting a cautioned medication for 8 hours after the dose · the list of tasks. The check never says "fit" or "unfit"; it lists what to mention and the crew decides.

## Pending

Normal ranges for heart rate, blood pressure, body temperature, blood oxygen, glucose and sleep hours are not in the challenge resources. Until an official source is approved, the app shows them as "Pending check".
