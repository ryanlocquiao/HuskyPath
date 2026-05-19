'use strict';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_NAME = 'gemini-2.5-flash';
const ALLOWED_PREF_TIMES = new Set(['morning', 'afternoon', 'evening']);
const DAY_MAP = {
  m: 'Monday',
  mon: 'Monday',
  monday: 'Monday',
  t: 'Tuesday',
  tu: 'Tuesday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  w: 'Wednesday',
  wed: 'Wednesday',
  wedn: 'Wednesday',
  wednesday: 'Wednesday',
  th: 'Thursday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  f: 'Friday',
  fri: 'Friday',
  friday: 'Friday',
};

function extractJson(text) {
  const trimmed = String(text || '').trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('Unable to locate JSON object in model response');
  }
  return trimmed.slice(first, last + 1);
}

function normalizeTime(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const exactMatch = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (exactMatch) {
    return `${exactMatch[1].padStart(2, '0')}:${exactMatch[2]}`;
  }

  const ampmMatch = normalized.match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2] || '0');
    const suffix = ampmMatch[3];
    if (hour === 12 && suffix === 'am') {
      hour = 0;
    } else if (hour !== 12 && suffix === 'pm') {
      hour += 12;
    }
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  if (normalized === 'noon') return '12:00';
  if (normalized === 'midnight') return '00:00';

  const digitsOnly = normalized.match(/^(\d{3,4})$/);
  if (digitsOnly) {
    const digits = digitsOnly[1];
    const hour = Number(digits.slice(0, -2));
    const minute = Number(digits.slice(-2));
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  return null;
}

function normalizeDay(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase().replace(/\./g, '');
  return DAY_MAP[key] || null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function normalizePreferredTimes(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => ALLOWED_PREF_TIMES.has(item));
}

function normalizeDayList(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => normalizeDay(item))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function validateConstraints(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Model response did not return a JSON object');
  }

  return {
    no_before: normalizeTime(payload.no_before),
    no_after: normalizeTime(payload.no_after),
    avoid_days: normalizeDayList(payload.avoid_days),
    avoid_consecutive: Boolean(payload.avoid_consecutive),
  };
}

function buildPrompt(userText) {
  return `Extract a JSON constraint object from the user's preferences. Return ONLY valid JSON, no explanations, no markdown, no prose.

Schema:
{
  "no_before": "HH:MM or null",
  "no_after": "HH:MM or null",
  "avoid_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "avoid_consecutive": true|false
}

Example 1:
Input: "no classes before 10am, avoid Mondays, no back to back classes"
Output:
{
  "no_before": "10:00",
  "no_after": null,
  "avoid_days": ["Monday"],
  "avoid_consecutive": true
}

Example 2:
Input: "no classes after 5pm, avoid Friday"
Output:
{
  "no_before": null,
  "no_after": "17:00",
  "avoid_days": ["Friday"],
  "avoid_consecutive": false
}

Example 3:
Input: "not before 9am, not after 3pm, no Wednesdays, no back-to-back lectures"
Output:
{
  "no_before": "09:00",
  "no_after": "15:00",
  "avoid_days": ["Wednesday"],
  "avoid_consecutive": true
}

Input: "${userText.trim()}"
Output:`;
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }

  const url = `${API_BASE}/${MODEL_NAME}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 512,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API request failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const content = candidate?.content;
  if (!content || !content.parts || content.parts.length === 0) {
    throw new Error('Gemini returned no output text');
  }

  const text = content.parts.map((part) => part.text || '').join('');
  if (!text) {
    throw new Error('Gemini returned empty text content');
  }

  return text;
}

async function parseConstraints({ text }) {
  if (!text || typeof text !== 'string') {
    throw new Error("Missing required text field for constraint parsing");
  }

  const prompt = buildPrompt(text);
  const raw = await callGemini(prompt);
  const jsonText = extractJson(raw);

  try {
    const parsed = JSON.parse(jsonText);
    return validateConstraints(parsed);
  } catch (err) {
    throw new Error(`Failed to parse Gemini JSON response: ${err.message}`);
  }
}

module.exports = {
  parseConstraints,
};
