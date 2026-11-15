// Export to Excel: the crew's records between two dates, one sheet per kind, as a real .xlsx file
// built here with no library (a ZIP of a few XML parts). Pure, no DOM: the screen part is in
// export.js. Times are written in UTC, with Houston and Florida next to them (clock-core.js).

import { stamp, hm, ymd } from "./clock-core.js";

/* ---------- filtering ---------- */

/** Whether a day ("2026-11-15") or a time is within [from, to], both days included; either end may be empty. */
export function inRange(dayOrTime, from, to) {
  const day = String(dayOrTime ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return (!from || day >= from) && (!to || day <= to);
}

/* ---------- the sheets ---------- */

const num = (v) => (Number.isFinite(v) ? v : "");
const nameOf = (members, id) => members.find((m) => m.id === id)?.name ?? (id === "_ground" ? "Ground medical team" : id);
const tx = (t) => (t ? `${ymd(t, "America/Chicago")} ${hm(t, "America/Chicago")}` : "");
const fl = (t) => (t ? `${ymd(t, "America/New_York")} ${hm(t, "America/New_York")}` : "");
const utc = (t) => (t ? `${String(new Date(t).toISOString()).slice(0, 16).replace("T", " ")}` : "");

/**
 * The workbook's sheets for the members and dates chosen:
 * [{ name, columns: [header], widths, rows: [[cell]] }]. `data` holds what the app keeps:
 * { members, logs: { id: log }, doses, kit, exercise, requests, openings, drills, itemLabel, reasonLabel, outcomeLabel, sessionLabel, symptomLabel }.
 */
export function buildSheets(data, { from = "", to = "", members: pick = null } = {}) {
  const members = (data.members ?? []).filter((m) => !pick || pick.includes(m.id));
  const ids = new Set(members.map((m) => m.id));
  const L = (f, x) => (typeof f === "function" ? f(x) : x);

  const readings = [];
  for (const m of members) {
    const log = data.logs?.[m.id] ?? {};
    for (const day of Object.keys(log).sort()) {
      if (!inRange(day, from, to)) continue;
      const e = log[day] ?? {};
      const bp = e.bloodPressure?.value ?? [];
      readings.push([day, m.name, num(e.sleepHours?.value), num(e.heartRate?.value), num(bp[0]), num(bp[1]), num(e.temperature?.value), num(e.bloodOxygen?.value), num(e.mood?.value), num(e.exerciseMinutes?.value), num(e.radiationDose?.value), e.feel?.value ?? "", e.note?.text ?? "", e.sleepHours?.src === "simulated" || e.sleepHours?.src === "sensors" ? "SIMULATED" : ""]);
    }
  }

  const doses = (data.doses ?? []).filter((d) => ids.has(d.member) && inRange(d.at, from, to)).sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((d) => { const k = (data.kit ?? []).find((x) => x.id === d.medId); return [utc(d.at), tx(d.at), fl(d.at), nameOf(members, d.member), k?.name ?? d.medId, num(d.units), k?.unit ?? "", d.reason ?? "", d.outcome?.worked ?? "", (d.outcome?.effects ?? []).join(", ")]; });

  const exercise = (data.exercise?.log ?? []).filter((e) => ids.has(e.member) && inRange(e.day, from, to)).sort((a, b) => (a.day < b.day ? -1 : 1))
    .map((e) => [e.day, nameOf(members, e.member), typeof data.sessionLabel === "function" ? data.sessionLabel(e) : e.focus, num(e.minutes), (e.sets ?? []).map((s) => [L(data.moveLabel, s.move), s.load != null ? `${s.load} lb` : "", s.reps ? `× ${s.reps}` : ""].filter(Boolean).join(" ")).join("; "), (e.symptoms ?? []).map((x) => L(data.symptomLabel, x)).join(", "), e.note ?? ""]);

  const requests = (data.requests ?? []).filter((r) => ids.has(r.member) && inRange(r.at, from, to)).sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((r) => [utc(r.at), tx(r.at), nameOf(members, r.member), r.items.map((i) => L(data.itemLabel, i)).join(", "), r.reason ?? "", r.status, utc(r.decidedAt), r.minutes ? `${r.minutes} min` : "", utc(r.usedAt), utc(r.until)]);

  const openings = (data.openings ?? []).filter((o) => ids.has(o.member) && inRange(o.at, from, to)).sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((o) => [utc(o.at), tx(o.at), fl(o.at), nameOf(members, o.member), L(data.reasonLabel, o.reason), utc(o.closedAt), o.drill ? "DRILL (simulated)" : ""]);

  const drills = (data.drills ?? []).filter((d) => ids.has(d.patient) && inRange(d.startedAt, from, to)).sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
    .map((d) => { const s = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 1000) : ""); return [utc(d.startedAt), tx(d.startedAt), nameOf(members, d.patient), nameOf(members, d.responder), s(d.startedAt, d.openedAt), d.wrongCodes, s(d.startedAt, d.endedAt), d.outcome ? L(data.outcomeLabel, d.outcome) : "", "SIMULATED"]; });

  const checkins = (data.checkins ?? []).filter((c) => ids.has(c.member) && inRange(c.at, from, to)).sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((c) => { const s = c.scores ?? {}; const b = (f, v) => (v == null || typeof f !== "function" ? "" : f(v)); return [utc(c.at), tx(c.at), nameOf(members, c.member), c.kind, num(s.phq2), num(s.phq9), b(data.phq9Band, s.phq9), num(s.item9), num(s.gad2), num(s.gad7), b(data.gad7Band, s.gad7), num(s.pss4), num(s.ucla3)]; });

  return [
    { name: "Readings", widths: [12, 20, 10, 12, 12, 12, 13, 12, 8, 13, 14, 12, 34, 12], columns: ["Date", "Crew member", "Sleep (h)", "Heart rate (bpm)", "Systolic (mmHg)", "Diastolic (mmHg)", "Temperature (°C)", "Oxygen sat. (%)", "Mood (of 5)", "Exercise (min)", "Radiation (mSv)", "Morning answer", "Note", "Source"], rows: readings },
    { name: "Medications", widths: [17, 17, 17, 20, 26, 8, 10, 22, 10, 26], columns: ["Taken (UTC)", "Houston, Texas", "Cape Canaveral, Florida", "Crew member", "Medication", "Units", "Unit", "What for", "Worked", "Side effects"], rows: doses },
    { name: "Exercise", widths: [12, 20, 28, 10, 30, 30, 30], columns: ["Date", "Crew member", "Session", "Minutes", "Loads", "Felt afterwards", "Note"], rows: exercise },
    { name: "Data access", widths: [17, 17, 20, 34, 40, 11, 17, 10, 17, 17], columns: ["Asked (UTC)", "Houston, Texas", "Crew member", "Items", "Reason", "Status", "Decided (UTC)", "For", "Code used (UTC)", "Open until (UTC)"], rows: requests },
    { name: "Emergency openings", widths: [17, 17, 17, 20, 30, 17, 18], columns: ["Opened (UTC)", "Houston, Texas", "Cape Canaveral, Florida", "Crew member", "Why", "Hidden again (UTC)", "Drill"], rows: openings },
    { name: "Check-ins", widths: [17, 17, 20, 9, 8, 8, 18, 12, 8, 8, 12, 8, 9], columns: ["Answered (UTC)", "Houston, Texas", "Crew member", "Kind", "PHQ-2 (0-6)", "PHQ-9 (0-27)", "PHQ-9 band", "PHQ-9 item 9", "GAD-2 (0-6)", "GAD-7 (0-21)", "GAD-7 band", "PSS-4 (0-16)", "UCLA-3 (3-9)"], rows: checkins },
    { name: "Drills", widths: [17, 17, 20, 20, 18, 12, 14, 24, 12], columns: ["Started (UTC)", "Houston, Texas", "Patient", "Responder", "Seconds to open data", "Wrong codes", "Seconds in total", "Outcome", "Source"], rows: drills }
  ];
}

/* ---------- .xlsx ---------- */

const xml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export function colName(i) {
  let s = "", n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Excel sheet names: at most 31 characters, none of : \ / ? * [ ] */
export const sheetName = (s) => String(s).replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Sheet";

function sheetXml(sheet) {
  const cell = (v, r, c, header) => {
    const ref = `${colName(c)}${r}`;
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${header ? ' s="1"' : ""}><v>${v}</v></c>`;
    if (v === "" || v == null) return "";
    return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ""}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  };
  const rows = [sheet.columns, ...sheet.rows].map((row, i) => `<row r="${i + 1}">${row.map((v, c) => cell(v, i + 1, c, i === 0)).join("")}</row>`).join("");
  const cols = (sheet.widths ?? []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${rows}</sheetData></worksheet>`;
}

/** The workbook's parts: [{ name, text }]. */
export function workbookParts(sheets, { title = "Ergosphere export", created = new Date() } = {}) {
  const n = sheets.length;
  const names = sheets.map((s) => sheetName(s.name));
  return [
    { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: "docProps/core.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>Ergosphere</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date(created).toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
    { name: "xl/workbook.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((s, i) => `<sheet name="${xml(s)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2E15A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(s) }))
  ];
}

/* ---------- ZIP (stored, no compression) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A ZIP archive of [{ name, text | bytes }] with no compression: Uint8Array. */
export function zip(files, when = new Date()) {
  const enc = new TextEncoder();
  const d = new Date(when);
  const dosTime = ((d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2)) & 0xffff;
  const dosDate = (((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate()) & 0xffff;
  const chunks = [], central = [];
  let offset = 0;
  const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = f.bytes ?? enc.encode(f.text);
    const crc = crc32(data);
    const local = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    chunks.push(local, name, data);
    central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
    offset += local.length + name.length + data.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

/** The .xlsx file's bytes. */
export const xlsx = (sheets, opts = {}) => zip(workbookParts(sheets, opts), opts.created ?? new Date());

/** "ergosphere-2026-11-01-to-2026-11-15.xlsx" */
export const fileName = (from, to, today) => `ergosphere-${from || "start"}-to-${to || today}.xlsx`;

export { stamp };
