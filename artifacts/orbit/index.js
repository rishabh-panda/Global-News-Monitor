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
if (DEMO_MODE) console.log('[ORBIT] DEMO MODE — Add GNEWS_API_KEY and NEWS_API_KEY for live data.');

// In-memory cache
const cache = {
  data: null,
  clusters: {},
  fetchedAt: null,
  ttl: 5 * 60 * 1000, // 5 minutes
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
    cache.data = { stories: cleanStories, partial: result.partial || false, demo: result.demo || false, stale: result.stale || false };
    cache.clusters = clusterMap;
    cache.fetchedAt = Date.now();
    console.log(`[ORBIT] Cached ${cleanStories.length} stories at ${new Date().toUTCString()}`);
  } catch (err) {
    console.error('[ORBIT] Refresh failed:', err.message);
  } finally {
    isFetching = false;
  }
}

refreshCache();
setInterval(refreshCache, cache.ttl);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

async function getCachedData(timeoutMs = 12000) {
  if (cache.data) return cache.data;
  const deadline = Date.now() + timeoutMs;
  while (!cache.data && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
  }
  return cache.data;
}

// GET /orbit/news
app.get('/orbit/news', async (req, res) => {
  try {
    if (req.query.refresh === 'true') {
      const ip = req.ip || 'unknown';
      const last = refreshRateLimit.get(ip) || 0;
      const elapsed = Date.now() - last;
      if (elapsed < 60000) {
        return res.status(429).json({ error: `Rate limited — retry in ${Math.ceil((60000 - elapsed) / 1000)}s` });
      }
      refreshRateLimit.set(ip, Date.now());
      await refreshCache();
    }

    const data = await getCachedData();
    if (!data) return res.status(503).json({ error: 'Data not yet available — please retry' });

    const filtered = applyFilters(data.stories, req.query);
    res.json({
      ...filtered,
      fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
      stale: data.stale || (cache.fetchedAt ? Date.now() - cache.fetchedAt > cache.ttl : false),
      partial: data.partial,
      demo: data.demo,
    });
  } catch (err) {
    console.error('[ORBIT] /api/news error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orbit/headlines
app.get('/orbit/headlines', async (req, res) => {
  try {
    const data = await getCachedData();
    if (!data) return res.json({ headlines: [], allClear: true, demo: true });
    const critical = data.stories
      .filter(s => s.severity === 'critical' || s.sentiment === 'critical')
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 5);
    res.json({ headlines: critical, allClear: critical.length === 0, demo: data.demo });
  } catch (err) {
    console.error('[ORBIT] /api/headlines error:', err);
    res.status(500).json({ headlines: [], error: 'Internal server error' });
  }
});

// GET /orbit/cluster/:id
app.get('/orbit/cluster/:id', (req, res) => {
  const cluster = cache.clusters[req.params.id];
  res.json({ stories: cluster || [], clusterId: req.params.id });
});

// GET /orbit/health
app.get('/orbit/health', (req, res) => {
  const uptimeMin = Math.floor((Date.now() - serverStartTime) / 60000);
  res.json({
    status: 'ok',
    uptime: `${uptimeMin}m`,
    storyCount: cache.data?.stories?.length || 0,
    fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    cacheAge: cache.fetchedAt ? Math.floor((Date.now() - cache.fetchedAt) / 1000) : null,
    demo: DEMO_MODE,
    partial: cache.data?.partial || false,
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
app.listen(PORT, '0.0.0.0', err => {
  if (err) { console.error('[ORBIT] Start failed:', err); process.exit(1); }
  console.log(`[ORBIT] Listening on port ${PORT} — demo=${DEMO_MODE}`);
});

module.exports = app;
