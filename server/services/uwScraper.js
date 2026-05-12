/**
 * UW Time Schedule Scraper
 * -------------------------------------------------------------------
 * Fetches the UW Time Schedule HTML page for a given quarter +
 * department abbreviation and parses it into structured course
 * objects suitable for the HuskyPath scheduler.
 *
 * The Time Schedule (https://www.washington.edu/students/timeschd/)
 * uses a fixed-column <pre> layout that has been stable for years.
 * Each course is introduced by a title line in bold, followed by one
 * or more section rows. We extract the section rows.
 *
 * Example section row:
 *   12345 A  5  MWF   1130-1220 KNE 210  SMITH,A         Open   120/  150
 *
 * Public API:
 *   parseTimeScheduleHTML(html)   -> Course[]
 *   fetchDept({ quarter, dept })  -> Promise<Course[]>
 *
 * Course shape:
 *   {
 *     code:        "CSE 142",
 *     title:       "Computer Programming I",
 *     sections: [{
 *       sln:         "12345",
 *       sectionId:   "A",
 *       credits:     "5",
 *       days:        ["M", "W", "F"],
 *       startTime:   "11:30",
 *       endTime:     "12:20",
 *       building:    "KNE",
 *       room:        "210",
 *       instructor:  "SMITH,A",
 *       status:      "Open",
 *       enrolled:    120,
 *       capacity:    150,
 *     }]
 *   }
 */

'use strict';

// Regex for a section row. Column positions in the HTML are stable
// but vary slightly between departments, so we parse tolerantly.
//   sln(5)  sectionId(1-2 letters)  credits  days  start-end  bldg  room  instructor...
const SECTION_RE =
  /^\s*(?:Restr\s+)?(\d{5})\s+([A-Z]{1,2}\d?)\s+([\dA-Z./-]+)\s+([MTWThFSU]+)\s+(\d{3,4})-(\d{3,4})\s+([A-Z*]+)\s+([\w\d-]+)\s+(.+?)\s{2,}(Open|Closed|Restr)/i;

// Title rows look like:  "CSE 142  Computer Programming I" possibly preceded by anchors.
// We accept either 2+ trailing spaces (followed by metadata) OR end-of-line.
const COURSE_TITLE_RE = /^([A-Z&]{1,7})\s+(\d{3}[A-Z]?)\s+(.+?)(?:\s{2,}|\s*$)/;

const DAY_TOKENS = ['Th', 'M', 'T', 'W', 'F', 'S', 'U'];

function splitDays(token) {
  // "MWF" -> ["M","W","F"];   "TTh" -> ["T","Th"]
  const out = [];
  let i = 0;
  while (i < token.length) {
    const two = token.slice(i, i + 2);
    if (two === 'Th') { out.push('Th'); i += 2; continue; }
    out.push(token[i]);
    i += 1;
  }
  return out.filter((d) => DAY_TOKENS.includes(d));
}

function formatMilTime(raw) {
  // "1130" -> "11:30", "830" -> "08:30"
  const padded = String(raw).padStart(4, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
}

function parseEnrollment(line) {
  // The tail looks like:  "Open      120/  150" or "Closed   50E/  50"
  const m = line.match(/(\d+)E?\/\s*(\d+)\s*$/);
  if (!m) return { enrolled: null, capacity: null };
  return { enrolled: Number(m[1]), capacity: Number(m[2]) };
}

/**
 * Strip HTML to plain text while preserving newlines inside <pre>.
 * We do not import a heavy DOM library — the Time Schedule pages
 * are simple enough that regex stripping works reliably.
 */
function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|li|h\d|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseTimeScheduleHTML(html) {
  const text = htmlToText(html);
  const lines = text.split(/\r?\n/);

  const courses = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/ /g, ' ');

    const titleMatch = line.match(COURSE_TITLE_RE);
    if (titleMatch) {
      const dept = titleMatch[1];
      const num = titleMatch[2];
      const code = `${dept} ${num}`;
      const title = titleMatch[3].trim();
      // De-duplicate so multiple section blocks roll up under one course.
      current = courses.find((c) => c.code === code);
      if (!current) {
        current = { code, title, sections: [] };
        courses.push(current);
      }
      continue;
    }

    const m = line.match(SECTION_RE);
    if (m && current) {
      const [, sln, sectionId, credits, days, start, end, bldg, room, instructorRaw] = m;
      const { enrolled, capacity } = parseEnrollment(line);
      current.sections.push({
        sln,
        sectionId,
        credits,
        days: splitDays(days),
        startTime: formatMilTime(start),
        endTime: formatMilTime(end),
        building: bldg,
        room,
        instructor: instructorRaw.trim().replace(/\s+/g, ' '),
        status: line.match(/(Open|Closed|Restr)/i)?.[1] ?? 'Unknown',
        enrolled,
        capacity,
      });
    }
  }

  return courses;
}

/**
 * Fetch a single department's Time Schedule page and parse it.
 * Uses Node 18+ global fetch — no extra dependency.
 *
 * @param {object} opts
 * @param {string} opts.quarter  e.g. "AUT2026", "WIN2026"
 * @param {string} opts.dept     lowercased dept abbreviation, e.g. "cse"
 * @param {number} [opts.timeoutMs=8000]
 * @returns {Promise<{code:string,title:string,sections:object[]}[]>}
 */
async function fetchDept({ quarter, dept, timeoutMs = 8000 }) {
  const url = `https://www.washington.edu/students/timeschd/${quarter}/${dept}.html`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`UW Time Schedule fetch failed: ${res.status} ${res.statusText} (${url})`);
    }
    const html = await res.text();
    return parseTimeScheduleHTML(html);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  parseTimeScheduleHTML,
  fetchDept,
  // exported for unit tests
  _internal: { splitDays, formatMilTime, parseEnrollment, htmlToText },
};
