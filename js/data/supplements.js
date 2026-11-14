// Supplements in the mission plan. Logged as taken or not; never "did it work?", never a
// treatment for a symptom. Quotes are word for word from NASA's Human Research Program
// evidence report "Risk Factor of Inadequate Nutrition" (Smith, Zwart, Heer, 2015) and are
// repeated in docs/SOURCES.md. Vitamins C, E and B were considered (team pharmacist's idea)
// and left out: NASA's report treats them as open questions, not as supplements to take.

const NUTRITION = "https://humanresearchroadmap.nasa.gov/evidence/reports/Nutrition.pdf";
const SRC = "NASA HRP evidence report, Inadequate Nutrition (2015)";

export const SUPPLEMENTS = [
  {
    id: "vitaminD",
    name: "Vitamin D",
    plan: "every day",
    why: {
      text: "The crew takes it because the spacecraft gives no sunlight and the menu little vitamin D.",
      facts: [
        { quote: "The only supplement NASA recommends for astronaut use during spaceflight is vitamin D.", url: NUTRITION, source: SRC },
        { quote: "includes very few dietary sources of vitamin D, and vitamin D cannot be synthesized endogenously due to lack of UV light", url: NUTRITION, source: SRC },
        { quote: "recommended that ISS crewmembers consume 800 IU of vitamin D per day during long-duration spaceflight.", url: NUTRITION, source: SRC },
        { quote: "The problem of weightlessness-induced bone loss must be solved, but vitamin D is not the answer.", url: NUTRITION, source: SRC }
      ]
    }
  }
];
