// One time for everyone: Ergosphere keeps every record in UTC (Coordinated Universal Time), and
// shows next to it the time in Houston, Texas and at Cape Canaveral, Florida, so a dose logged
// on the station reads the same for the crew and for the teams on the ground. Pure, no DOM.
// Which clocks to show is an app choice (docs/SOURCES.md); the conversion is the browser's own
// time-zone database (daylight saving included).

export const ZONES = [
  { id: "utc", label: "UTC", place: "Station and records", tz: "UTC" },
  { id: "tx", label: "Texas", place: "Houston, Texas", tz: "America/Chicago" },
  { id: "fl", label: "Florida", place: "Cape Canaveral, Florida", tz: "America/New_York" }
];

const parts = (date, tz, opts) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", ...opts }).formatToParts(date).map((p) => [p.type, p.value]));

/** "14:05" (or "14:05:09" with seconds) in a zone. */
export function hm(date, tz, seconds = false) {
  const p = parts(new Date(date), tz, { hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}) });
  return `${p.hour === "24" ? "00" : p.hour}:${p.minute}${seconds ? `:${p.second}` : ""}`;
}

/** "2026-11-15" in a zone. */
export function ymd(date, tz) {
  const p = parts(new Date(date), tz, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** The zone's short name at that moment: "CST", "CDT", "EST", "EDT", "UTC". */
export function abbr(date, tz) {
  if (tz === "UTC") return "UTC";
  return parts(new Date(date), tz, { timeZoneName: "short" }).timeZoneName ?? "";
}

/** Hours from UTC at that moment (e.g. -6). */
export function offset(date, tz) {
  const d = new Date(date);
  const p = parts(d, tz, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +(p.hour === "24" ? 0 : p.hour), +p.minute, +p.second);
  return Math.round((local - Math.floor(d.getTime() / 1000) * 1000) / 3600000);
}

/** All three clocks for one moment: [{ id, label, place, time, day, abbr, offset }]. */
export function clocks(date = new Date(), seconds = false) {
  return ZONES.map((z) => ({ ...z, time: hm(date, z.tz, seconds), day: ymd(date, z.tz), abbr: abbr(date, z.tz), offset: offset(date, z.tz) }));
}

/** One line for a record: "14:05 UTC · 08:05 Houston (CST) · 09:05 Florida (EST)"; the date is added when it differs from UTC's. */
export function stamp(date) {
  const d = new Date(date);
  const u = ymd(d, "UTC");
  return clocks(d).map((c) => (c.id === "utc" ? `${c.time} UTC` : `${c.time}${c.day !== u ? ` (${c.day.slice(5)})` : ""} ${c.id === "tx" ? "Houston" : "Florida"} ${c.abbr}`)).join(" · ");
}
