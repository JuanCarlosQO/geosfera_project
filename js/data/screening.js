// Validated screening questionnaires, word for word from their sources (docs/SOURCES.md).
// They screen; they do not diagnose: a positive screen means "a person should look", and the
// flight surgeon or a behavioral-health professional decides. Thresholds below come from the
// sources quoted; where a source gives no cut-off (PSS-4, 3-item UCLA) the app compares each
// crew member with their own earlier answers only.

const UW = "https://www.hiv.uw.edu/page/mental-health-screening";
export const SCREEN_URLS = {
  phq2: `${UW}/phq-2`, phq9: `${UW}/phq-9`, gad2: `${UW}/gad-2`, gad7: `${UW}/gad-7`,
  pssForm: "https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/.doc/pss_4_item.doc",
  pssScales: "https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/index.html",
  pssScoring: "https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/html/pssscoring.html",
  ucla3: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2394670/"
};

export const TWO_WEEKS = "Over the last 2 weeks, how often have you been bothered by the following problems?";
export const FREQ4 = [
  { label: "Not at all", points: 0 },
  { label: "Several days", points: 1 },
  { label: "More than half the days", points: 2 },
  { label: "Nearly every day", points: 3 }
];
export const PSS_OPTIONS = [
  { label: "Never", points: 0 },
  { label: "Almost Never", points: 1 },
  { label: "Sometimes", points: 2 },
  { label: "Fairly Often", points: 3 },
  { label: "Very Often", points: 4 }
];
export const UCLA_OPTIONS = [
  { label: "Hardly ever", points: 1 },
  { label: "Some of the time", points: 2 },
  { label: "Often", points: 3 }
];

// PHQ-9: the first two items are the PHQ-2. GAD-7: the first two are the GAD-2.
export const PHQ9_ITEMS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed or hopeless",
  "Trouble falling asleep, staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself - or that you're a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed. Or, the opposite - being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead or of hurting yourself in some way"
];
export const GAD7_ITEMS = [
  "Feeling nervous, anxious or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen"
];
export const PSS_LEAD = "The questions in this scale ask you about your feelings and thoughts during the last month.";
export const PSS4_ITEMS = [
  "In the last month, how often have you felt that you were unable to control the important things in your life?",
  "In the last month, how often have you felt confident about your ability to handle your personal problems?",
  "In the last month, how often have you felt that things were going your way?",
  "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?"
];
export const PSS4_REVERSED = [1, 2]; // items 2 and 3 (0-based 1 and 2)
// The 3-item UCLA scale as asked in the paper (telephone wording), with the answer choices,
// which the app shows as buttons, taken out of the question.
export const UCLA_LEAD = "The next questions are about how you feel about different aspects of your life.";
export const UCLA3_ITEMS = [
  "How often do you feel that you lack companionship?",
  "How often do you feel left out?",
  "How often do you feel isolated from others?"
];

// What the sources say, quoted (each sentence is in docs/SOURCES.md).
export const SCREEN_FACTS = {
  phq2Cut: { quote: "If the score is 3 or greater, major depressive disorder is likely.", url: SCREEN_URLS.phq2, source: "PHQ-2, University of Washington" },
  phq2Next: { quote: "Patients who screen positive should be further evaluated with the PHQ-9, other diagnostic instruments, or direct interview to determine whether they meet criteria for a depressive disorder.", url: SCREEN_URLS.phq2, source: "PHQ-2, University of Washington" },
  phq9Use: { quote: "The PHQ-9 is a multipurpose instrument for screening, diagnosing, monitoring and measuring the severity of depression.", url: SCREEN_URLS.phq9, source: "PHQ-9, University of Washington" },
  phq9Item9: { quote: "Question 9 is a single screening question on suicide risk.", url: SCREEN_URLS.phq9, source: "PHQ-9, University of Washington" },
  gad2Sens: { quote: "Using a cut-off of 3 the GAD-2 has a sensitivity of 86% and specificity of 83% for diagnosis generalized anxiety disorder.", url: SCREEN_URLS.gad2, source: "GAD-2, University of Washington" },
  gad7Sens: { quote: "Using a cut-off of 8 the GAD-7 has a sensitivity of 92% and specificity of 76% for diagnosis generalized anxiety disorder.", url: SCREEN_URLS.gad7, source: "GAD-7, University of Washington" },
  gadFree: { quote: "No permission required to reproduce, translate, display or distribute.", url: SCREEN_URLS.gad7, source: "GAD-7, University of Washington" },
  pssNoCut: { quote: "The Perceived Stress Scale is not a diagnostic instrument; there are no score cut-offs.", url: SCREEN_URLS.pssScales, source: "PSS, Carnegie Mellon University" },
  pssReverse: { quote: "PSS-4 scores are obtained by reverse coding items # 2 and 3.", url: SCREEN_URLS.pssScoring, source: "PSS scoring, Carnegie Mellon University" },
  pssPermission: { quote: "Submitting a request for permission to use the PSS is completely free of charge and will ensure an optimized service.", url: SCREEN_URLS.pssScales, source: "PSS, Carnegie Mellon University" },
  uclaSum: { quote: "As in the R-UCLA, each person's responses to the questions are summed, with higher scores indicating greater loneliness.", url: SCREEN_URLS.ucla3, source: "Hughes et al. 2004, Research on Aging" }
};
