// Facts behind the countermeasure exercise screens, quoted word for word (each is repeated in
// docs/SOURCES.md; tests/exercise-core.test.js checks it). Read 15 Nov 2026.

const FIT = "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/";
const ARED = "https://www.nasa.gov/video-detail/train-like-an-astronaut-ared/";
const EVID = "https://ntrs.nasa.gov/api/citations/20220019338/downloads/Evidence%20report%20aerobic%20and%20muscle_FINAL%209-21-22%20Pubpress%20accepted_v2.pdf";
const EVID_SRC = "NASA HRP Evidence Report, reduced muscle mass, strength and aerobic capacity (2022)";
const CEVIS = "https://www.nasa.gov/image-detail/gmt299_13_42_jasmin-moghbeli_sn1168_loral-teal-cevis";
const T2 = "https://www.nasa.gov/image-article/exercising-t2-treadmill/";
const T2_MAINT = "https://www.nasa.gov/blogs/stationreport/2018/08/24/iss-daily-summary-report-8-24-2018/";

export const EXERCISE_FACTS = {
  daily: { quote: "Six to seven days a week … resistance training and aerobic exercises for 1.5 hours per day", url: FIT, source: "NASA HRP, Risk of reduced cardiorespiratory and musculoskeletal fitness" },
  ared: { quote: "In space, the Advanced Resistive Exercise Device (ARED) is the astronauts' weight lifting machine.", url: ARED, source: "NASA, Train Like an Astronaut: ARED" },
  aredMoves: { quote: "The exercises done in space to help reduce muscle and bone loss include: squats, deadlifts and presses.", url: ARED, source: "NASA, Train Like an Astronaut: ARED" },
  aredLoad: { quote: "By comparison, the currently available Advanced Resistance Exercise Device (ARED) has a 600-lb load capability.", url: EVID, source: EVID_SRC },
  cevis: { quote: "The CEVIS provides aerobic and cardiovascular conditioning and supports science activities, pre-breathe spacewalk activities, periodic fitness evaluations, and pre-landing fitness evaluations.", url: CEVIS, source: "NASA image, Astronaut Loral O'Hara pedals on an exercise cycle" },
  t2: { quote: "Astronaut Steve Swanson, equipped with a bungee harness, exercises on the T2 treadmill.", url: T2, source: "NASA image, Exercising on the T2 treadmill" },
  repair: { quote: "The crew performed both the 6-month and yearly T2 preventative inspections and maintenance actions.", url: T2_MAINT, source: "NASA ISS Daily Summary Report, 24 Aug 2018" },
  hardware: { quote: "For example, crewmembers have not always been able to exercise due to hardware failure or were only able to exercise at lower intensities to conserve station power resources.", url: EVID, source: EVID_SRC }
};
