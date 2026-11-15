// The app's own outline icons, drawn for it: one line weight, rounded ends, a 24 x 24 grid.
// `tile()` puts an icon on a small rounded square, the way a health dashboard labels its
// readings. They are decoration beside a written label, so they are hidden from screen readers.

const PATHS = {
  heartRate: '<path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z"/><path d="M3.5 12.5h4l1.5-3 2.5 5.5 1.5-2.5h3.5"/>',
  bloodPressure: '<path d="M5 17.5a8 8 0 1 1 14 0"/><path d="M12 13.5l3.5-4.5"/><circle cx="12" cy="13.5" r="1.3"/><path d="M8 20h8"/>',
  temperature: '<path d="M10 5a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
  bloodOxygen: '<path d="M12 4v8M12 9c-2 0-3 1-4 3M12 9c2 0 3 1 4 3"/><path d="M8 7C5 8 4 13 4 17c0 2 2 3 4 2V9M16 7c3 1 4 6 4 10 0 2-2 3-4 2V9"/>',
  glucose: '<path d="M12 3c3 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10 9 7 12 3z"/><path d="M12 11v5M9.5 13.5h5"/>',
  sleepHours: '<path d="M19 14.5A8 8 0 0 1 9.5 5a7 7 0 1 0 9.5 9.5z"/><path d="M15 4h4l-4 4h4"/>',
  exerciseMinutes: '<path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12"/>',
  radiationDose: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10 9 4.8A8 8 0 0 0 4.2 13H10M14 12h5.8A8 8 0 0 0 15 4.8L12 10M13 13.7 16 19a8 8 0 0 1-8 0l3-5.3"/>',
  mood: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0"/><path d="M9 10h.01M15 10h.01"/>',
  still: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  hydration: '<path d="M12 3c3 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10 9 7 12 3z"/><path d="M8.5 14c1.2 1 2.3 1 3.5 0s2.3-1 3.5 0"/>',
  co2: '<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9.5a4.3 4.3 0 0 1 .5 8.5z"/>',
  co2Personal: '<path d="M3 9h10a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h7"/>',
  humidity: '<path d="M8 4c2 2.7 4 4.6 4 7a4 4 0 0 1-8 0c0-2.4 2-4.3 4-7z"/><path d="M16.5 11c1.3 1.8 2.5 3 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1.6 1.2-2.8 2.5-4.6z"/>',
  pressure: '<circle cx="12" cy="12" r="8.5"/><path d="M12 12l4-3.5"/><path d="M8 16.5h8"/>',
  smoke: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 3 0-3-1-5.5 1-8.5z"/>',
  ammonia: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/>',
  power: '<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21 11v2M11.5 9.5l-2 3h3l-2 3"/>',
  alert: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  home: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7.5l8 6 8-6"/>',
  support: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M6 6l3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5"/>'
};
// other names for the same picture
PATHS.dose = PATHS.radiationDose;
PATHS.sleep = PATHS.sleepHours;

export const has = (id) => Boolean(PATHS[id]);
export const icon = (id, size = 20) => (PATHS[id] ? `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[id]}</svg>` : "");
export const tile = (id, size = 20) => (PATHS[id] ? `<span class="ic-tile" aria-hidden="true">${icon(id, size)}</span>` : "");
