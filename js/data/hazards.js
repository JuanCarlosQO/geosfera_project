// The five hazards of human spaceflight, word for word from NASA's Human Research Program.
// Source: https://www.nasa.gov/hrp/hazards/ (read 14 Nov 2026). "systems" links each hazard to
// the hologram's body systems: that link is a Ergosphere choice, not NASA's.

export const HAZARDS_SOURCE = { label: "NASA Human Research Program — 5 Hazards of Human Spaceflight", url: "https://www.nasa.gov/hrp/hazards/" };

export const HAZARDS = [
  {
    "id": "radiation",
    "name": "Space Radiation",
    "text": "Invisible to the human eye, space radiation is not only stealthy but considered one of the most hazardous aspects of spaceflight.",
    "systems": [
      "radiation"
    ]
  },
  {
    "id": "isolation",
    "name": "Isolation and Confinement",
    "text": "Behavioral responses occur among groups of people far from Earth who are isolated and confined in a small space over a long period of time.",
    "systems": [
      "mind"
    ]
  },
  {
    "id": "distance",
    "name": "Distance from Earth",
    "text": "Instructions, new supplies, medical care, and more become increasingly challenging to receive from Earth as astronauts venture deeper into space.",
    "systems": []
  },
  {
    "id": "gravity",
    "name": "Gravity Fields",
    "text": "Astronauts' entire bodies – muscles, bones, inner ear, and organs – must adjust to the new gravities encountered on the space station or their spacecraft, as well as on the Moon, Mars, and Earth once they return home.",
    "systems": [
      "musculo",
      "heart",
      "brain"
    ]
  },
  {
    "id": "closed",
    "name": "Hostile/Closed Environments",
    "text": "Maintaining a safe ecosystem inside a spacecraft presents unique challenges, from ensuring optimal temperatures, pressures, and lighting, to reducing noise, monitoring microbial communities, and tracking immune responses.",
    "systems": [
      "lungs",
      "immune"
    ]
  }
];
