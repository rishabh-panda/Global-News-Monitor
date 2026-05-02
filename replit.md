# ORBIT — Real-Time Global News Intelligence Monitor

## Architecture

**Monorepo** managed by pnpm. Contains:
- `artifacts/orbit/` — Standalone vanilla JS + Express news terminal (CommonJS, `node index.js`)
- `artifacts/api-server/` — Shared TypeScript/Express API server (not used by ORBIT)
- `artifacts/mockup-sandbox/` — Vite design sandbox for UI prototyping

## ORBIT App

**Stack:** Vanilla JS frontend + Express 4 backend. No React, no TypeScript, no CSS frameworks.

**Entry point:** `artifacts/orbit/index.js` — runs directly as `node index.js`.

**Port:** 22982 (assigned by artifact system, set via `PORT` env var).

**Route prefix:** All ORBIT API routes use `/orbit/` prefix (e.g., `/orbit/news`, `/orbit/headlines`) to avoid conflict with the shared api-server which claims `/api`.

### Key Files

```
artifacts/orbit/
├── index.js          # Express server — /orbit/news, /orbit/headlines, /orbit/cluster/:id, /orbit/health
├── news.js           # GNews+NewsAPI fetchers, normalization, 40-story mock dataset, deduplication
├── filters.js        # 9 filter types, boolean keyword parser (AND/OR/-exclude/"phrase"), pagination
├── geo.js            # 180 country coords, reverse name map, TLD inference, region lookup
├── public/
│   └── index.html    # Complete frontend: globe.gl CDN, all UI panels, mission-control UI
└── tests/
    └── unit.test.js  # 65 unit tests via Node.js built-in node:test runner
```

### API Endpoints

| Route | Description |
|-------|-------------|
| `GET /orbit/news` | Stories with all 9 filters, pagination, 3 sort modes |
| `GET /orbit/headlines` | Top 5 critical/high-severity stories for ticker |
| `GET /orbit/cluster/:id` | Stories in a deduplication cluster |
| `GET /orbit/health` | Server health, cache age, story count |

### Filters (9 types)

1. `q` — Boolean keyword: AND (implicit), OR, `-exclude`, `"exact phrase"`
2. `topics` — Comma-separated from 16 topics (AI & ML, Geopolitics, Conflict, etc.)
3. `countries` — ISO 3166-1 alpha-2 codes
4. `regions` — North America, Europe, Asia-Pacific, Latin America, Middle East, Africa, South Asia, Central Asia, Oceania
5. `sources` — wire, newspaper, broadcast, digital, government, ngo, academic
6. `languages` — en, fr, de, es, ar, zh, ru, ja, etc.
7. `from` — ISO date string (recency cutoff)
8. `sentiment` — critical, neutral
9. `minSources` — Minimum cluster size (dedup-grouped source count)

### Data Sources

- **GNews API** — Set `GNEWS_API_KEY` secret for live data
- **NewsAPI.org** — Set `NEWS_API_KEY` secret for live data
- **Demo mode** — 40 curated mock stories when no API keys are set (current state)

### Cache

In-memory, 5-minute TTL. Force refresh via `?refresh=true` (rate-limited: 1/minute per IP).

### Tests

```bash
cd artifacts/orbit && node --test tests/unit.test.js
```

65 tests covering: geo lookup, filter logic, keyword parsing, topic/sentiment inference, deduplication (Jaccard similarity), mock data validation.

## Environment Secrets

| Secret | Purpose |
|--------|---------|
| `SESSION_SECRET` | Express session (set but not actively used) |
| `GNEWS_API_KEY` | GNews API live feed (not yet set — demo mode active) |
| `NEWS_API_KEY` | NewsAPI.org live feed (not yet set — demo mode active) |

## Globe.gl Notes

The 3D globe uses `globe.gl@2` CDN (bundles Three.js internally — do NOT import Three.js separately, causes duplicate instance errors). WebGL is required for the globe to render. The app gracefully degrades to intelligence feed-only mode when WebGL is unavailable (e.g., Replit preview sandbox).

## Development

The ORBIT workflow runs:
```
cd /home/runner/workspace/artifacts/orbit && npm install --legacy-peer-deps && node index.js
```

Dependencies are installed via npm (not pnpm) directly in `artifacts/orbit/node_modules/` since ORBIT uses CommonJS and needs independent package management from the pnpm workspace.
