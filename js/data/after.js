// After the mission (support and suicide prevention) and loneliness: quoted sentences and the
// help lines, each checked on its official page (docs/SOURCES.md). Resources only: the app gives
// no clinical advice and names no method of harm.

const LIFE = "https://988lifeline.org/";
const LIFE_EXPECT = "https://988lifeline.org/get-help/what-to-expect/";
const LIFE_HELP = "https://988lifeline.org/help-someone-else/";
const L106 = "https://www.minsalud.gov.co/salud/publica/salud-mental/Paginas/linea-106.aspx";
const FAH = "https://findahelpline.com/";
const WHO = "https://www.who.int/news-room/fact-sheets/detail/suicide";
const TIPS = "https://www.nasa.gov/humans-in-space/five-tips-from-nasa-crew-on-emerging-from-isolation/";
const BODY = "https://www.nasa.gov/humans-in-space/the-human-body-in-space/";
const RISK = "https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/";
const ISO = "https://www.nasa.gov/hrp/hazard-isolation-and-confinement/";

export const AFTER_FACTS = {
  readjust: { quote: "some astronauts and analog crews can take months to fully re-adapt when they return home", url: TIPS, source: "NASA, Five tips from NASA crew on emerging from isolation" },
  team: { quote: "A whole team works to help them readjust back to life on Earth.", url: TIPS, source: "NASA, Five tips from NASA crew on emerging from isolation" },
  lifeline: { quote: "The 988 Lifeline is available 24/7/365. Your conversations are free and confidential.", url: LIFE, source: "988 Suicide & Crisis Lifeline" },
  lifelineAll: { quote: "The 988 Lifeline is for everyone.", url: LIFE, source: "988 Suicide & Crisis Lifeline" },
  lifelineEs: { quote: "Text AYUDA to 988 for Spanish-language services or PRIDE to 988 for specialized support for LGBTQ+ youth.", url: LIFE_EXPECT, source: "988 Lifeline, What to expect" },
  steps: { quote: "These evidence-based action steps provide a blueprint for reaching and helping someone in crisis.", url: LIFE_HELP, source: "988 Lifeline, Help someone else" },
  linea106: { quote: "Es gratuita, confidencial y funciona 24/7.", url: L106, source: "Ministerio de Salud y Protección Social de Colombia, Línea 106" },
  linea106For: { quote: "Llama a la 106 siempre que necesites apoyo emocional, estés en crisis, te sientas en riesgo o simplemente necesites hablar con un profesional de salud mental.", url: L106, source: "Ministerio de Salud y Protección Social de Colombia, Línea 106" },
  helpline: { quote: "Free, confidential support from a helpline or hotline near you. Online chat, text or phone.", url: FAH, source: "Find A Helpline" },
  whoPrevent: { quote: "With timely, evidence-based and often low-cost interventions, suicides can be prevented.", url: WHO, source: "World Health Organization, Suicide fact sheet" },
  whoIsolation: { quote: "experiencing conflict, disaster, violence, abuse or loss and a sense of isolation are strongly associated with suicidal behaviour.", url: WHO, source: "World Health Organization, Suicide fact sheet" }
};

export const CONNECT_FACTS = {
  longing: { quote: "the longing for loved ones, or feeling unable to assist with family emergencies back on Earth", url: BODY, source: "NASA, The human body in space" },
  contact: { quote: "Crew members aboard the International Space Station can virtually talk with family and medical professionals for support", url: RISK, source: "NASA, Risk of behavioral conditions and psychiatric disorders" },
  journal: { quote: "Astronauts write in journals as a safe place to vent frustrations", url: BODY, source: "NASA, The human body in space" },
  compound: { quote: "Sleep loss, circadian desynchronization, and work overload compound this issue", url: ISO, source: "NASA, Hazard: isolation and confinement" },
  confinement: { quote: "The prolonged isolation and confinement that astronauts face in space can increase risks of behavioral issues", url: RISK, source: "NASA, Risk of behavioral conditions and psychiatric disorders" }
};

// The 988 Lifeline's five action steps for helping someone in crisis, as listed on its page.
export const ACTION_STEPS = ["Ask.", "Be there.", "Help keep them safe.", "Help them connect.", "Follow up."];

// National lines checked on their official pages; every other country goes to Find A Helpline.
export const LINES = [
  { id: "us", countries: ["United States", "USA", "US", "Estados Unidos"], name: "988 Suicide & Crisis Lifeline", call: "988", text: "988", chat: "https://chat.988lifeline.org/", url: LIFE, facts: ["lifeline", "lifelineEs"] },
  { id: "co", countries: ["Colombia"], name: "Línea 106", call: "106", url: L106, facts: ["linea106", "linea106For"] }
];
export const DIRECTORY = { name: "Find A Helpline", url: FAH };
// ISO codes for the directory's country pages (findahelpline.com/countries/<code>)
export const COUNTRY_CODES = {
  Argentina: "ar", Brazil: "br", Canada: "ca", Chile: "cl", China: "cn", Colombia: "co", Ecuador: "ec", France: "fr", Germany: "de",
  India: "in", Italy: "it", Japan: "jp", Mexico: "mx", Nigeria: "ng", Peru: "pe", Russia: "ru", "South Korea": "kr", Spain: "es",
  "United Arab Emirates": "ae", "United Kingdom": "gb", "United States": "us", Venezuela: "ve"
};
