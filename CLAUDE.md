# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Atlanta United match history and analytics dashboard. Displays complete match records from 2017-present with Expected Goals (xG) analytics, opponent head-to-head records, and player-level statistics. Data sourced from the American Soccer Analysis (ASA) API.

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (no frameworks, no build step)
- **Backend:** Vercel Serverless Functions (Node.js) in `/api/`
- **Data Source:** ASA REST API (`https://app.americansocceranalysis.com/api/v1/`)
- **Hosting/Deployment:** Vercel (auto-deploys from `main` branch)
- **No package.json, no npm dependencies, no build tooling**

## URLs

- **Main stats page:** `https://scarvesandspikes-stats.vercel.app/`
- **Opponent page:** `https://scarvesandspikes-stats.vercel.app/opponent.html?team={slug}`
- **API endpoints** (`/api/matches`, `/api/opponent`) return raw JSON — they are not user-facing pages.

## Development

There is no build step, test suite, or linter. The site is static HTML served by Vercel with serverless API functions. Deployment happens automatically when pushing to `main`.

Test endpoints exist at `/api/test-players.js`, `/api/test-player-xgoals.js`, and `/api/test-player-goalsadded.js` for manually verifying ASA API data structures.

## Architecture

### Data Flow

```
Frontend (HTML/JS) → Vercel Serverless Functions → ASA API
```

Frontend pages fetch from local `/api/` endpoints. Those serverless functions aggregate data from multiple ASA API endpoints, enrich/join records, and return shaped JSON. The frontend then filters and renders client-side.

### Key Files

- `index.html` — Main match history page (markup, styles, and JS all inline)
- `opponent.html` — Opponent head-to-head page (same inline pattern)
- `api/matches.js` — Primary data endpoint; fetches matches, teams, stadia, managers, referees, and player xG data from ASA API, joins by IDs, returns enriched match records. Supports `?season=` param (year, "all", or defaults to current).
- `api/opponent.js` — Head-to-head endpoint; returns all matches vs a specific opponent with aggregate stats. Supports `?opponent=` param (team name slug). Normalizes team names (accent removal, suffix stripping).
- `api/sitemap.js` — Dynamic XML sitemap for SEO. Has its own `normalizeOpponent` that must stay in sync with `opponent.js`.

### Patterns

- **Parallel API fetching:** Serverless functions use `Promise.all()` to fetch multiple ASA endpoints concurrently.
- **Data enrichment:** Raw API data is indexed into lookup maps, then joined by game_id/team_id/player_id to produce the final response.
- **Opponent slug normalization:** Team names are lowercased, accents stripped via NFD normalization, then non-alphanumeric characters removed. This logic exists in both `opponent.js` and `sitemap.js` and must stay consistent.
- **Client-side filtering:** Frontend caches fetched data in memory and applies filters (season, result, venue, competition, xG verdict) without refetching.
- **Caching:** API responses use `Cache-Control` headers (`s-maxage=3600` for matches/opponent, `s-maxage=86400` for sitemap).

### Design System (CSS Custom Properties)

- Brand colors: burgundy `#80000a`, gold `#c9a227`
- Result colors: win (green), loss (red), draw (gray)
- Typography: Oswald (display), Source Sans 3 (body) via Google Fonts
- Responsive layout using flexbox and grid

### xG Verdict Logic

- **"Robbed"** = Loss where Atlanta United had xG advantage (xgDiff >= 0.5)
- **"Smash-and-grab"** = Win where Atlanta United had xG disadvantage (xgDiff <= -0.5)
