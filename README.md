# HuskyPath

AI-powered course & schedule planner for the University of Washington.

Ryan Locquiao · Kieran Moynihan · Max Olshanskyy — DYOP Final Project

- Repo:  https://github.com/ryanlocquiao/huskypath
- Live:  https://huskypath.vercel.app

## What it does

UW students describe their preferences in plain English — *"no classes before 10am, light Friday, avoid back-to-back lectures"* — and HuskyPath returns three ranked, conflict-free schedules built from live UW Time Schedule data, each with a plain-language explanation of why it scored well.

## Architecture

```
User input ──► Claude API (NLP parser) ──► Structured constraints
                                                    │
   UW Time Schedule scraper ──► Course DB ──► Candidate generator
                                                    │
                                            Scoring model
                                                    │
                                            Top-3 schedules ──► React calendar UI
```

| Layer    | Stack                                                                 |
| -------- | --------------------------------------------------------------------- |
| Frontend | React 19, Vite, TailwindCSS (planned), deployed on Vercel             |
| Backend  | Node.js + Express 5, PostgreSQL (planned)                             |
| AI       | Anthropic Claude API for the natural-language constraint parser       |
| Data     | UW Time Schedule (scraped HTML), Rate My Professor, public grade data |

## Repo layout

```
client/          React + Vite frontend
server/
  index.js              Express entry point
  routes/courses.js     /api/courses endpoints
  services/uwScraper.js UW Time Schedule HTML parser
  scripts/scrape.js     CLI: scrape a department to JSON
  data/                 Cached / sample course data
  test/                 Node built-in test runner specs
  .env.example          Environment template
```

## Quickstart

```bash
# Backend
cd server
npm install
cp .env.example .env
npm run dev          # starts API on http://localhost:3001

# Frontend (separate terminal)
cd client
npm install
npm run dev          # Vite on http://localhost:5173
```

Health check: `curl http://localhost:3001/api/health`

## UW Time Schedule scraper

The scraper turns the legacy `<pre>`-formatted Time Schedule pages into structured JSON the rest of the pipeline can reason about.

```bash
cd server
node scripts/scrape.js cse --quarter=AUT2026
# → wrote data/cse-aut2026.json   (84 courses, 312 sections)
```

It also lives behind an API endpoint:

```bash
curl http://localhost:3001/api/courses                        # cached sample
curl http://localhost:3001/api/courses/cse?quarter=AUT2026    # live
```

Output shape (one section):

```json
{
  "code": "CSE 142",
  "title": "Computer Programming I",
  "sections": [{
    "sln": "12345",
    "sectionId": "A",
    "credits": "4",
    "days": ["M", "W", "F"],
    "startTime": "09:30",
    "endTime": "10:20",
    "building": "KNE",
    "room": "210",
    "instructor": "REGES, S",
    "status": "Open",
    "enrolled": 280,
    "capacity": 300
  }]
}
```

## Tests

```bash
cd server
node --test test/
```

No third-party test framework — Node 18+ built-in runner only.

## Roadmap

- [x] Repo, React frontend on Vercel, Express + PG backend
- [x] **UW Time Schedule scraper + `/api/courses` endpoint**
- [ ] NLP constraint parser (Claude API)
- [ ] Candidate-schedule generator (conflict-free search)
- [ ] Multi-dimensional scoring model + ranker
- [ ] React calendar UI with drag-and-drop comparison
- [ ] iCal / PDF export
