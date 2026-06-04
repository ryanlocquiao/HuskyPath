'use strict';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_NAME = 'gemma-4-31b-it';
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

  const result = {};

  const no_before = normalizeTime(payload.no_before);
  if (no_before) result.no_before = no_before;

  const no_after = normalizeTime(payload.no_after);
  if (no_after) result.no_after = no_after;

  const excluded_days = normalizeDayList(payload.excluded_days);
  if (excluded_days.length > 0) result.excluded_days = excluded_days;

  const required_courses = normalizeStringArray(payload.required_courses);
  if (required_courses.length > 0) result.required_courses = required_courses;

  const excluded_courses = normalizeStringArray(payload.excluded_courses);
  if (excluded_courses.length > 0) result.excluded_courses = excluded_courses;

  const light_days = normalizeDayList(payload.light_days);
  if (light_days.length > 0) result.light_days = light_days;

  const preferred_times = normalizePreferredTimes(payload.preferred_times);
  if (preferred_times.length > 0) result.preferred_times = preferred_times;

  if (payload.avoid_consecutive) result.avoid_consecutive = true;

  if (typeof payload.target_courses === 'number') {
    result.target_courses = payload.target_courses;
  }

  return result;
}

function buildPrompt(userText) {
  return `Extract a JSON constraint object from the user's preferences. Return ONLY valid JSON, no explanations, no markdown, no prose. Omit any fields that are not mentioned or are empty. Begin immediately with { and end with }.

CRITICAL RULE: Always default to including "target_courses": 3 in the output JSON unless the user explicitly requests a different number of classes.

Schema (all fields optional):
{
  "no_before": "HH:MM",
  "no_after": "HH:MM",
  "excluded_days": ["Monday", "Friday"],
  "excluded_courses": ["CSE 143", "MATH 126"],
  "required_courses": ["CSE 142", "MATH 125"],
  "light_days": ["Wednesday"],
  "preferred_times": ["morning", "afternoon", "evening"],
  "avoid_consecutive": true,
  "target_courses": 3
}

Example 1:
Input: "no classes before 10am, avoid Mondays, no back to back classes"
Output:
{
  "no_before": "10:00",
  "excluded_days": ["Monday"],
  "avoid_consecutive": true,
  "target_courses": 3
}

Example 2:
Input: "no classes after 5pm, avoid Friday, light Friday, I want to take 4 classes"
Output:
{
  "no_after": "17:00",
  "excluded_days": ["Friday"],
  "light_days": ["Friday"],
  "target_courses": 4"
}

Example 3:
Input: "not before 9am, not after 3pm, no Wednesdays, no back-to-back lectures, prefer afternoons, need CSE 142"
Output:
{
  "no_before": "09:00",
  "no_after": "15:00",
  "excluded_days": ["Wednesday"],
  "avoid_consecutive": true,
  "preferred_times": ["afternoon"],
  "required_courses": ["CSE 142"]
}

User input: "${userText.trim()}"
JSON:`;
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
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Generative Language API request failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  let text = '';
  if (candidate) {
    if (typeof candidate.output === 'string') {
      text = candidate.output;
    } else if (candidate.content && Array.isArray(candidate.content.parts)) {
      // Filter out thinking/reasoning parts and only use actual text
      text = candidate.content.parts
        .filter((part) => !part.thought)
        .map((part) => part.text || '')
        .join('');
    } else if (typeof candidate.outputText === 'string') {
      text = candidate.outputText;
    } else {
      // Fallback: stringify the candidate so callers can see something
      text = JSON.stringify(candidate);
    }
  }

  if (!text) {
    // Log full result for debugging before throwing so developers can inspect
    // the exact model response in server logs (do not expose API keys).
    // eslint-disable-next-line no-console
    console.error('[constraintParser] Model raw result:', JSON.stringify(result));
    throw new Error(`Model returned no output text: ${JSON.stringify(result).slice(0,200)}`);
  }

  return text;
}

async function parseConstraints({ text }) {
  if (!text || typeof text !== 'string') {
    throw new Error("Missing required text field for constraint parsing");
  }

  const prompt = buildPrompt(text);
  const raw = await callGemini(prompt);

  let jsonText;
  try {
    jsonText = extractJson(raw);
  } catch (err) {
    throw new Error(`Unable to locate JSON object in model response: ${String(raw).slice(0,200)}`);
  }

  try {
    const parsed = JSON.parse(jsonText);
    return validateConstraints(parsed);
  } catch (err) {
    throw new Error(`Failed to parse model JSON response: ${err.message}. Raw: ${String(raw).slice(0,200)}`);
  }
}

module.exports = {
  parseConstraints,
};
