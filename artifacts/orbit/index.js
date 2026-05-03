'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const { fetchAllNews } = require('./news');
const { applyFilters } = require('./filters');

const GNEWS_API_KEY = process.env.GNEWS_API_KEY || null;
const NEWS_API_KEY = process.env.NEWS_API_KEY || null;
const DEMO_MODE = !GNEWS_API_KEY && !NEWS_API_KEY;

if (!GNEWS_API_KEY) console.warn('[ORBIT] WARNING: GNEWS_API_KEY not set');
if (!NEWS_API_KEY) console.warn('[ORBIT] WARNING: NEWS_API_KEY not set');
if (DEMO_MODE) console.log('[ORBIT] DEMO MODE active — add GNEWS_API_KEY and NEWS_API_KEY for live data');

// In-memory cache
const cache = {
  data: null,
  clusters: {},
  fetchedAt: null,
  ttl: 5 * 60 * 1000,
};

const refreshRateLimit = new Map();
const serverStartTime = Date.now();
let isFetching = false;

async function refreshCache() {
  if (isFetching) return;
  isFetching = true;
  try {
    const result = await fetchAllNews(GNEWS_API_KEY, NEWS_API_KEY);
    const clusterMap = {};
    const cleanStories = result.stories.map(s => {
      if (s._cluster?.length) clusterMap[s.clusterId] = s._cluster;
      const { _cluster, ...clean } = s;
      return clean;
    });
    cache.data = {
      stories: cleanStories,
      partial: result.partial || false,
      demo: result.demo || false,
      stale: result.stale || false,
    };
    cache.clusters = clusterMap;
    cache.fetchedAt = Date.now();
    console.log(`[ORBIT] Cached ${cleanStories.length} stories at ${new Date().toUTCString()}`);
  } catch (err) {
    console.error('[ORBIT] Cache refresh failed:', err.message);
  } finally {
    isFetching = false;
  }
}

refreshCache();
setInterval(refreshCache, cache.ttl);

const app = express();

// Security hardening
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.json({ limit: '64kb' }));

// Static files with cache headers
app.use(express.static(path.join(process.cwd(), 'public'), {
  maxAge: '1m',
  etag: true,
}));

async function getCachedData(timeoutMs = 12000) {
  if (cache.data) return cache.data;
  const deadline = Date.now() + timeoutMs;
  while (!cache.data && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
  }
  return cache.data;
}

function noCache(res) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

// GET /orbit/news
app.get('/orbit/news', async (req, res) => {
  noCache(res);
  try {
    if (req.query.refresh === 'true') {
      const ip = req.ip || 'unknown';
      const last = refreshRateLimit.get(ip) || 0;
      const elapsed = Date.now() - last;
      if (elapsed < 60000) {
        return res.status(429).json({
          error: `Rate limited — retry in ${Math.ceil((60000 - elapsed) / 1000)}s`,
        });
      }
      refreshRateLimit.set(ip, Date.now());
      await refreshCache();
    }

    const data = await getCachedData();
    if (!data) return res.status(503).json({ error: 'Data not yet available — please retry shortly' });

    const filtered = applyFilters(data.stories, req.query);
    const isStale = cache.fetchedAt ? Date.now() - cache.fetchedAt > cache.ttl : false;

    res.json({
      ...filtered,
      fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
      stale: data.stale || isStale,
      partial: data.partial,
      demo: data.demo,
    });
  } catch (err) {
    console.error('[ORBIT] /orbit/news error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orbit/headlines
app.get('/orbit/headlines', async (req, res) => {
  noCache(res);
  try {
    const data = await getCachedData();
    if (!data) return res.json({ headlines: [], allClear: true, demo: true });
    const critical = data.stories
      .filter(s => s.severity === 'critical' || s.sentiment === 'critical')
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 6);
    res.json({ headlines: critical, allClear: critical.length === 0, demo: data.demo });
  } catch (err) {
    console.error('[ORBIT] /orbit/headlines error:', err.message);
    res.status(500).json({ headlines: [], error: 'Internal server error' });
  }
});

// GET /orbit/cluster/:id
app.get('/orbit/cluster/:id', (req, res) => {
  noCache(res);
  const id = req.params.id;
  if (!id || !/^[a-f0-9]{1,32}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid cluster ID' });
  }
  const cluster = cache.clusters[id];
  res.json({ stories: cluster || [], clusterId: id });
});

// GET /orbit/health
app.get('/orbit/health', (req, res) => {
  noCache(res);
  const uptimeSec = Math.floor((Date.now() - serverStartTime) / 1000);
  const cacheAgeSec = cache.fetchedAt ? Math.floor((Date.now() - cache.fetchedAt) / 1000) : null;
  res.json({
    status: 'ok',
    uptime: `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`,
    storyCount: cache.data?.stories?.length || 0,
    clusterCount: Object.keys(cache.clusters).length,
    fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    cacheAgeSec,
    nextRefreshSec: cacheAgeSec != null ? Math.max(0, Math.floor(cache.ttl / 1000) - cacheAgeSec) : null,
    demo: DEMO_MODE,
    partial: cache.data?.partial || false,
    stale: cacheAgeSec != null ? cacheAgeSec > cache.ttl / 1000 : false,
    gnewsKey: !!GNEWS_API_KEY,
    newsApiKey: !!NEWS_API_KEY,
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
app.listen(PORT, '0.0.0.0', err => {
  if (err) { console.error('[ORBIT] Failed to start:', err); process.exit(1); }
  console.log(`[ORBIT] Server listening on port ${PORT} — demo=${DEMO_MODE}`);
});

module.exports = app;
