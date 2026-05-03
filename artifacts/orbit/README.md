# ORBIT — Global News Intelligence Monitor

> Real-time geospatial news terminal with 9 filter types, story clustering, severity classification, and a 3D globe interface.

---

## Overview

ORBIT is a mission-control-style news intelligence dashboard that aggregates, deduplicates, and visualises global news stories in real time. It connects to GNews and NewsAPI.org via a server-side proxy, applies AI-inferred topic and severity classification, clusters near-duplicate headlines using Jaccard similarity, and plots each story on a live 3D globe. When a browser lacks WebGL, ORBIT falls back to a fully interactive 2D tactical map rendered on Canvas 2D.

**No React. No TypeScript. No CSS framework.** Vanilla JS front-end + Express back-end, CommonJS throughout.

---

## Features

| Feature | Detail |
|---------|--------|
| 3D globe | `globe.gl v2` with news pins, ripple rings for critical/high stories, auto-rotate, damping |
| Tactical map fallback | Canvas 2D world map with equirectangular projection, story pins, glow, hover labels |
| 9 filter types | Keyword (boolean), Topics, Region, Source Type, Language, Severity, Recency, Min-Sources, Sort |
| Boolean keyword search | `AND` (implicit), `OR`, `-exclude`, `"exact phrase"` operators |
| Story clustering | Jaccard similarity deduplication — groups near-identical headlines across sources |
| Severity classification | `critical / high / moderate / low` inferred from story keywords |
| Topic inference | 16 topics auto-detected from headline + description keywords |
| Alert ticker | Live scrolling headline bar showing top 6 critical/high-severity stories |
| Detail modal | Full metadata, topic tags, cluster sources, direct article link |
| Keyboard shortcuts | `/` search, `R` refresh, `J/K` navigate stories, `?` help, `Esc` close |
| Active filter badge | Filter count badge shows how many filters are currently applied |
| Auto-refresh | 5-minute server-side cache refresh; page-visibility-aware (skips when tab hidden) |
| Refresh countdown | Topbar counts down seconds to next auto-refresh |
| Stale data warning | Banner + pill when cached data exceeds TTL |
| Demo mode | 40 curated mock stories when no API keys are configured |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-Powered-By` removed |
| Health endpoint | `/orbit/health` — uptime, cache age, story/cluster counts, key presence |

---

## Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- npm

### 2. Install dependencies

```bash
cd artifacts/orbit
npm install --legacy-peer-deps
```

### 3. Run in demo mode (no API keys required)

```bash
node index.js
```

Open [http://localhost:3000](http://localhost:3000). The app runs on 40 curated mock stories.

### 4. Enable live news feeds

Set these environment variables (or Replit Secrets):

| Variable | Source | Free Tier |
|----------|--------|-----------|
| `GNEWS_API_KEY` | [gnews.io](https://gnews.io) | 100 req/day |
| `NEWS_API_KEY` | [newsapi.org](https://newsapi.org) | 100 req/day |

```bash
GNEWS_API_KEY=your_key NEWS_API_KEY=your_key node index.js
```

The server automatically switches from demo to live mode when either key is present.

---

## Project Structure

```
artifacts/orbit/
├── index.js              # Express server (entry point)
├── news.js               # News fetchers, normaliser, 40-story mock dataset, Jaccard dedup
├── filters.js            # 9 filter types, boolean keyword parser, pagination, 3 sort modes
├── geo.js                # 180 country coordinates, region lookup, TLD inference
├── package.json          # Dependencies: express, cors, node-fetch (CommonJS)
├── public/
│   └── index.html        # Complete single-file front-end (globe.gl CDN, all panels)
└── tests/
    └── unit.test.js      # 65 unit tests (Node.js built-in test runner)
```

---

## API Reference

All endpoints return JSON. Routes use the `/orbit/` prefix to avoid conflicts with workspace-level `/api` routing.

### `GET /orbit/news`

Returns filtered, paginated story list.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Boolean keyword query: `AI OR climate -war "oil deal"` |
| `topics` | string | Comma-separated topics: `Geopolitics,Conflict,Defense` |
| `regions` | string | Comma-separated regions: `Middle East,Europe` |
| `sources` | string | Comma-separated source types: `wire,broadcast` |
| `languages` | string | Comma-separated ISO codes: `en,fr,ar` |
| `sentiment` | string | `critical`, `high`, `moderate`, or `low` |
| `minSources` | number | Minimum cluster size (dedup group coverage) |
| `from` | ISO string | Earliest publish date |
| `sort` | string | `recency` (default), `severity`, `relevance` |
| `limit` | number | Max results (default: 50, max: 200) |
| `page` | number | Page number (1-indexed) |
| `refresh` | `true` | Force cache refresh (rate-limited: 1/min per IP) |

**Response:**

```json
{
  "stories": [ /* story objects */ ],
  "total": 37,
  "page": 1,
  "limit": 50,
  "fetchedAt": "2025-05-03T18:00:00.000Z",
  "stale": false,
  "partial": false,
  "demo": true
}
```

**Story Object:**

```json
{
  "id": "a1b2c3d4",
  "title": "Major Cyberattack Targets Critical Infrastructure in Ukraine",
  "description": "State-sponsored actors have...",
  "url": "https://...",
  "source": { "name": "BBC World Service", "type": "broadcast" },
  "publishedAt": "2025-05-03T17:30:00Z",
  "country": "UA",
  "region": "Europe",
  "language": "en",
  "topics": ["Cyber", "Conflict", "Geopolitics"],
  "severity": "critical",
  "sentiment": "critical",
  "lat": 50.45,
  "lng": 30.52,
  "clusterId": "a1b2c3d4",
  "clusterSize": 5
}
```

---

### `GET /orbit/headlines`

Returns the top 6 critical/high-severity stories for the alert ticker.

```json
{
  "headlines": [ /* story objects */ ],
  "allClear": false,
  "demo": true
}
```

---

### `GET /orbit/cluster/:id`

Returns all stories in a deduplication cluster.

```json
{
  "clusterId": "a1b2c3d4",
  "stories": [ /* story objects */ ]
}
```

---

### `GET /orbit/health`

System health and cache diagnostics.

```json
{
  "status": "ok",
  "uptime": "12m 34s",
  "storyCount": 40,
  "clusterCount": 8,
  "fetchedAt": "2025-05-03T18:00:00.000Z",
  "cacheAgeSec": 74,
  "nextRefreshSec": 226,
  "demo": true,
  "partial": false,
  "stale": false,
  "gnewsKey": false,
  "newsApiKey": false
}
```

---

## Filter Reference

### Boolean Keyword Syntax (`q`)

| Operator | Example | Behaviour |
|----------|---------|-----------|
| Implicit AND | `climate energy` | Both words must appear |
| `OR` | `war OR conflict` | Either word matches |
| `-` prefix | `-sports` | Exclude stories containing "sports" |
| `"..."` | `"interest rate"` | Exact phrase match |
| Explicit `AND` | `AI AND regulation` | Same as implicit AND |

### Topics (16)

`AI & ML` · `Technology` · `Geopolitics` · `Economy` · `Science` · `Climate` · `Defense` · `Health` · `Energy` · `Space` · `Cyber` · `Finance` · `Law & Policy` · `Markets` · `Culture` · `Conflict`

### Regions (9)

`North America` · `Europe` · `Asia-Pacific` · `Latin America` · `Middle East` · `Africa` · `South Asia` · `Central Asia` · `Oceania`

### Source Types (7)

`wire` · `newspaper` · `broadcast` · `digital` · `government` · `ngo` · `academic`

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus keyword search |
| `R` | Force data refresh |
| `J` | Navigate to next story |
| `K` | Navigate to previous story |
| `Esc` | Close modal / clear focus |
| `?` | Toggle keyboard help panel |

---

## Architecture

```
Browser (Vanilla JS)
        │
        │  GET /orbit/news?q=...&topics=...
        ▼
  Express Server (index.js)
        │
        ├── In-memory cache (5-min TTL)
        │        │
        │        └── refreshCache()
        │                 │
        │         ┌───────┴───────┐
        │         ▼               ▼
        │     GNews API      NewsAPI.org
        │     (live mode)    (live mode)
        │         │               │
        │         └──── OR ────────┘
        │                  │
        │           news.js mock data
        │           (demo mode — 40 stories)
        │
        ├── filters.js — applyFilters(stories, query)
        │     ├── Boolean keyword parser
        │     ├── Topic / region / source / language filters
        │     ├── Severity / sentiment filter
        │     ├── Recency (from date) filter
        │     ├── Min-sources (cluster size) filter
        │     └── Sort: recency | severity | relevance
        │
        └── geo.js — 180 country coords, region map, TLD inference
```

### Deduplication (Jaccard Similarity)

Stories with Jaccard similarity ≥ 0.3 on their normalised title token sets are grouped into a cluster. The cluster representative (highest severity, most recent) is surfaced in the feed; others are accessible via `/orbit/cluster/:id`. This eliminates near-duplicate headlines from different wire services covering the same event.

### Severity Classification

Severity is inferred from title + description keywords using two tiers:

- **Critical**: `war`, `attack`, `explosion`, `nuclear`, `missile`, `coup`, `tsunami`, `pandemic`, etc.
- **High**: `conflict`, `sanctions`, `crash`, `hack`, `protest`, `emergency`, `flood`, etc.
- **Moderate**: `talks`, `dispute`, `concern`, `warning`, `tension`, etc.
- **Low**: everything else

---

## Running Tests

```bash
cd artifacts/orbit
node --test tests/unit.test.js
```

65 tests covering:

- Geo lookup (country coords, region inference, TLD detection)
- All 9 filter types
- Boolean keyword parser (AND/OR/-exclude/phrase)
- Topic and sentiment inference
- Severity classification
- Jaccard deduplication algorithm
- Mock story dataset validation (40 stories, all fields present)

---

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `GNEWS_API_KEY` | — | GNews API key (activates live mode) |
| `NEWS_API_KEY` | — | NewsAPI.org key (activates live mode) |
| `SESSION_SECRET` | — | Express session secret (reserved for future auth) |

---

## Globe Notes

- `globe.gl v2` bundles Three.js internally — **do not import Three.js separately**; a duplicate instance causes WebGL context conflicts and a black globe.
- When WebGL is unavailable (sandboxed environments, old browsers), ORBIT automatically switches to the **Canvas 2D Tactical Map**: an equirectangular projection with graticule grid, story pins coloured by severity, glow halos for critical/high stories, hover labels, and click-to-open detail modal.
- Globe auto-rotation pauses when a story pin is clicked so the camera stays on the selected location.

---

## Deployment

ORBIT is configured for Replit's artifact deployment system.

**Artifact config** (`.replit-artifact/artifact.toml`):
```toml
[[services]]
localPort = 22982
name = "web"
paths = ["/", "/orbit"]

[[services.run]]
command = "cd /home/runner/workspace/artifacts/orbit && npm install --legacy-peer-deps && node index.js"
```

**To deploy on Replit:** click **Publish** in the workspace header. The platform builds, health-checks, and serves the app under a `.replit.app` domain with automatic HTTPS and CDN routing.

**To add live news data after deployment:** set `GNEWS_API_KEY` and `NEWS_API_KEY` in your Replit project Secrets. The server detects them on startup and switches from demo to live mode automatically.

---

## License

MIT — see `LICENSE` for details.
