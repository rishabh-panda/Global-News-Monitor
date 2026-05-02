'use strict';

const fetch = require('node-fetch');
const crypto = require('crypto');
const { COUNTRY_COORDS, inferCountryFromText, inferCountryFromUrl } = require('./geo');

const TOPIC_KEYWORDS = {
  'Technology': ['technology', 'tech', 'software', 'hardware', 'digital', 'internet', 'app', 'chip', 'semiconductor'],
  'AI & ML': ['artificial intelligence', 'machine learning', 'llm', 'gpt', 'neural', 'deep learning', 'openai', 'anthropic', 'gemini', 'chatgpt', 'generative ai', 'large language'],
  'Geopolitics': ['sanctions', 'treaty', 'diplomatic', 'diplomacy', 'united nations', 'nato', 'bilateral', 'sovereignty', 'foreign policy', 'geopolit', 'summit'],
  'Economy': ['gdp', 'inflation', 'recession', 'central bank', 'federal reserve', 'fiscal', 'tariff', 'trade war', 'economic', 'currency', 'treasury', 'budget', 'deficit'],
  'Science': ['research', 'study', 'discovery', 'scientist', 'experiment', 'laboratory', 'physics', 'biology', 'chemistry', 'genome', 'quantum'],
  'Climate': ['climate', 'emissions', 'carbon', 'cop ', 'renewable', 'fossil fuel', 'ipcc', 'global warming', 'greenhouse', 'net zero', 'deforestation', 'drought', 'wildfire'],
  'Defense': ['military', 'defense', 'army', 'navy', 'air force', 'pentagon', 'weapon', 'drone', 'nuclear', 'submarine', 'fighter jet', 'defense spending'],
  'Health': ['outbreak', 'pandemic', 'world health', 'vaccine', 'virus', 'epidemic', 'pathogen', 'disease', 'hospital', 'cancer', 'drug approval', 'fda'],
  'Energy': ['oil', 'gas', 'petroleum', 'opec', 'pipeline', 'electricity', 'nuclear plant', 'solar', 'wind energy', 'energy crisis', 'power grid', 'lng'],
  'Space': ['nasa', 'spacex', 'satellite', 'rocket', 'iss ', 'lunar', 'orbit', 'astronaut', 'mars', 'moon', 'space station', 'asteroid'],
  'Cyber': ['cyberattack', 'ransomware', 'data breach', 'hacked', 'malware', 'zero-day', 'cybersecurity', 'phishing', 'vulnerability'],
  'Finance': ['stock', 'market', 'bond', 'ipo', 'merger', 'acquisition', 'bank', 'interest rate', 'nasdaq', 'dow jones', 'crypto', 'bitcoin'],
  'Law & Policy': ['court', 'law', 'regulation', 'legislation', 'bill', 'senate', 'congress', 'parliament', 'supreme court', 'policy', 'ruling', 'indictment'],
  'Markets': ['commodities', 'forex', 'exchange rate', 'crude oil', 'gold price', 'futures', 'etf', 'market rally', 'market crash'],
  'Culture': ['culture', 'art', 'music', 'film', 'movie', 'book', 'sports', 'olympic', 'festival', 'award', 'celebrity', 'entertainment'],
  'Conflict': ['war', 'airstrike', 'ceasefire', 'offensive', 'casualties', 'killed', 'bombing', 'explosion', 'combat', 'armed conflict', 'rebels', 'insurgent'],
};

const CRITICAL_KEYWORDS = [
  'war', 'attack', 'collapse', 'crisis', 'earthquake', 'explosion', 'killed',
  'sanctions', 'outbreak', 'arrested', 'missile', 'coup', 'assassination',
  'nuclear', 'catastrophe', 'disaster', 'terror', 'genocide', 'invasion',
  'mass shooting', 'tsunami', 'hurricane', 'famine', 'pandemic',
];

const WIRE_DOMAINS = ['reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'afp.com', 'bloomberg.com'];
const NEWSPAPER_DOMAINS = ['nytimes.com', 'theguardian.com', 'washingtonpost.com', 'wsj.com', 'ft.com'];
const BROADCAST_DOMAINS = ['cnn.com', 'foxnews.com', 'nbcnews.com', 'cbsnews.com', 'aljazeera.com', 'dw.com', 'france24.com', 'euronews.com'];
const DIGITAL_DOMAINS = ['techcrunch.com', 'theverge.com', 'wired.com', 'axios.com', 'vox.com', 'politico.com'];
const GOVERNMENT_DOMAINS = ['.gov', '.mil', 'who.int', 'un.org', 'nato.int'];
const NGO_DOMAINS = ['amnesty.org', 'hrw.org', 'icrc.org', 'msf.org', 'oxfam.org'];
const ACADEMIC_DOMAINS = ['.edu', 'nature.com', 'science.org', 'thelancet.com', 'nejm.org'];

function classifySourceType(domain) {
  if (!domain) return 'digital';
  const d = domain.toLowerCase();
  if (WIRE_DOMAINS.some(w => d.includes(w))) return 'wire';
  if (NEWSPAPER_DOMAINS.some(w => d.includes(w))) return 'newspaper';
  if (BROADCAST_DOMAINS.some(w => d.includes(w))) return 'broadcast';
  if (GOVERNMENT_DOMAINS.some(w => d.includes(w))) return 'government';
  if (NGO_DOMAINS.some(w => d.includes(w))) return 'ngo';
  if (ACADEMIC_DOMAINS.some(w => d.includes(w))) return 'academic';
  return 'digital';
}

function extractDomain(url) {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function inferTopics(title, description) {
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  const found = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw.toLowerCase()))) found.push(topic);
  }
  return found;
}

function inferSentiment(title, description) {
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  return CRITICAL_KEYWORDS.some(kw => text.includes(kw)) ? 'critical' : 'neutral';
}

function inferSeverity(publishedAt, sourceType) {
  const ageH = (Date.now() - new Date(publishedAt).getTime()) / 3600000;
  if (sourceType === 'wire' && ageH < 2) return 'critical';
  if (ageH < 6) return 'high';
  if (ageH < 24) return 'moderate';
  return 'low';
}

function stableId(title, sourceName) {
  return crypto.createHash('sha1').update((title || '') + '|' + (sourceName || '')).digest('hex').slice(0, 16);
}

function normalizeLanguage(lang) {
  if (!lang) return 'en';
  const map = { en: 'en', es: 'es', fr: 'fr', ar: 'ar', zh: 'zh', pt: 'pt', de: 'de', hi: 'hi', ru: 'ru', ja: 'ja' };
  return map[lang.toLowerCase().slice(0, 2)] || lang.slice(0, 2);
}

function normalizeCountry(apiCountry) {
  if (!apiCountry) return null;
  const code = apiCountry.toUpperCase().slice(0, 2);
  return COUNTRY_COORDS[code] ? code : null;
}

function buildStory(title, description, url, sourceName, publishedAt, country, language) {
  if (!title || !url) return null;
  const domain = extractDomain(url);
  const sourceType = classifySourceType(domain);
  let resolvedCountry = normalizeCountry(country);
  if (!resolvedCountry) resolvedCountry = inferCountryFromText(title + ' ' + (description || ''));
  if (!resolvedCountry) resolvedCountry = inferCountryFromUrl(url);
  const coords = resolvedCountry ? COUNTRY_COORDS[resolvedCountry] : null;
  return {
    id: stableId(title, sourceName),
    title,
    description: description || title,
    url,
    source: { name: sourceName || domain, domain, type: sourceType },
    publishedAt: publishedAt || new Date().toISOString(),
    country: resolvedCountry || 'UNKNOWN',
    region: coords?.region || 'Unknown',
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    language: normalizeLanguage(language),
    topics: inferTopics(title, description),
    sentiment: inferSentiment(title, description),
    severity: inferSeverity(publishedAt || new Date().toISOString(), sourceType),
    clusterSize: 1,
    clusterId: null,
  };
}

function normalizeGNews(article, defaultCountry) {
  if (!article?.title || !article?.url) return null;
  return buildStory(article.title, article.description, article.url, article.source?.name, article.publishedAt, defaultCountry, article.language);
}

function normalizeNewsAPI(article, defaultCountry, defaultLanguage) {
  if (!article?.title || !article?.url || article.title === '[Removed]') return null;
  return buildStory(article.title, article.description || article.content, article.url, article.source?.name, article.publishedAt, defaultCountry, defaultLanguage);
}

// Deduplication via Jaccard similarity on title word sets
function tokenize(text) {
  if (!text) return new Set();
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !['the','and','for','are','but','not','you','all','can','was','one','had','have','that','this','with','they','from','said','will','been','were','their','which','into'].includes(w))
  );
}

function jaccardSimilarity(setA, setB) {
  if (!setA.size && !setB.size) return 1;
  if (!setA.size || !setB.size) return 0;
  const intersection = [...setA].filter(x => setB.has(x)).length;
  return intersection / (setA.size + setB.size - intersection);
}

const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, low: 1 };

function deduplicate(stories) {
  const clusters = {};
  const reps = [];
  const tokens = stories.map(s => tokenize(s.title));

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    let placed = false;
    for (let j = 0; j < reps.length; j++) {
      if (jaccardSimilarity(tokens[i], tokenize(reps[j].title)) > 0.6) {
        clusters[reps[j].id].push(story);
        story.clusterId = reps[j].id;
        placed = true;
        break;
      }
    }
    if (!placed) {
      story.clusterId = story.id;
      clusters[story.id] = [story];
      reps.push(story);
    }
  }

  const result = [];
  for (const [clusterId, clusterStories] of Object.entries(clusters)) {
    clusterStories.sort((a, b) => {
      const rd = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
      return rd !== 0 ? rd : new Date(b.publishedAt) - new Date(a.publishedAt);
    });
    const rep = clusterStories[0];
    rep.clusterSize = clusterStories.length;
    rep.clusterId = clusterId;
    rep._cluster = clusterStories;
    result.push(rep);
  }
  return result;
}

// Demo / mock data for when no API keys are configured
function generateMockData() {
  const now = Date.now();
  const hoursAgo = h => new Date(now - h * 3600000).toISOString();
  const mockStories = [
    { title: 'G7 Leaders Agree on New AI Governance Framework', country: 'US', lang: 'en', h: 1.5, topics: ['AI & ML', 'Geopolitics'] },
    { title: 'European Central Bank Holds Interest Rates Amid Inflation', country: 'DE', lang: 'en', h: 2, topics: ['Economy', 'Finance'] },
    { title: 'Major Cyberattack Targets Critical Infrastructure in Ukraine', country: 'UA', lang: 'en', h: 0.5, topics: ['Cyber', 'Conflict'], critical: true },
    { title: 'SpaceX Launches Next-Generation Starlink Satellite Constellation', country: 'US', lang: 'en', h: 3, topics: ['Space', 'Technology'] },
    { title: 'Climate Summit Produces Historic Fossil Fuel Phaseout Agreement', country: 'AE', lang: 'en', h: 5, topics: ['Climate', 'Geopolitics'] },
    { title: 'WHO Issues Alert Over Respiratory Illness Spreading in Southeast Asia', country: 'TH', lang: 'en', h: 1, topics: ['Health'], critical: true },
    { title: 'Bank of Japan Signals End to Negative Interest Rate Era', country: 'JP', lang: 'en', h: 4, topics: ['Economy', 'Finance'] },
    { title: 'UK Parliament Passes Landmark AI Safety and Liability Bill', country: 'GB', lang: 'en', h: 6, topics: ['AI & ML', 'Law & Policy'] },
    { title: 'South China Sea Tensions Escalate as Vessels Clash Near Spratly Islands', country: 'CN', lang: 'en', h: 1.2, topics: ['Geopolitics', 'Defense', 'Conflict'], critical: true },
    { title: 'Amazon Announces $10 Billion Rural Broadband Infrastructure Fund', country: 'US', lang: 'en', h: 8, topics: ['Technology', 'Economy'] },
    { title: 'Brazil Unveils Ambitious Amazon Rainforest Protection Initiative', country: 'BR', lang: 'en', h: 10, topics: ['Climate', 'Law & Policy'] },
    { title: 'OPEC+ Agrees to Extend Production Cuts Through Next Quarter', country: 'SA', lang: 'en', h: 3, topics: ['Energy', 'Markets'] },
    { title: 'India Lunar Mission Successfully Reaches Target Orbit', country: 'IN', lang: 'en', h: 12, topics: ['Space', 'Technology'] },
    { title: 'Germany Enters Technical Recession as Energy Costs Surge', country: 'DE', lang: 'en', h: 7, topics: ['Economy', 'Energy'] },
    { title: 'UN Security Council Emergency Session on Gaza Ceasefire Negotiations', country: 'US', lang: 'en', h: 2, topics: ['Geopolitics', 'Conflict'], critical: true },
    { title: 'Microsoft Reports Record Revenue Driven by Azure AI Services', country: 'US', lang: 'en', h: 9, topics: ['AI & ML', 'Technology', 'Finance'] },
    { title: 'Iran Nuclear Talks Resume in Vienna With Limited Progress', country: 'AT', lang: 'en', h: 14, topics: ['Geopolitics', 'Defense'] },
    { title: 'Australia Announces Major Defense Spending Increase Over Decade', country: 'AU', lang: 'en', h: 11, topics: ['Defense', 'Economy'] },
    { title: 'WHO Approves New Malaria Vaccine for Sub-Saharan Africa Rollout', country: 'KE', lang: 'en', h: 16, topics: ['Health', 'Science'] },
    { title: 'Taiwan Strait: US Carrier Group Conducts Freedom of Navigation Exercise', country: 'TW', lang: 'en', h: 5, topics: ['Defense', 'Geopolitics'] },
    { title: 'French Government Survives No-Confidence Vote Over Pension Reform', country: 'FR', lang: 'fr', h: 4, topics: ['Law & Policy', 'Economy'] },
    { title: 'North Korea Fires Ballistic Missiles Toward Sea of Japan', country: 'KP', lang: 'en', h: 0.8, topics: ['Defense', 'Geopolitics', 'Conflict'], critical: true },
    { title: 'Bitcoin Surges Past $80,000 as Institutional ETF Inflows Accelerate', country: 'US', lang: 'en', h: 2, topics: ['Finance', 'Markets'] },
    { title: 'Saudi Arabia Formally Joins BRICS Economic Alliance', country: 'SA', lang: 'en', h: 20, topics: ['Geopolitics', 'Economy'] },
    { title: 'Magnitude 7.2 Earthquake Strikes Central Turkey Near Ankara', country: 'TR', lang: 'en', h: 1.8, topics: ['Conflict'], critical: true },
    { title: 'Google DeepMind Releases AlphaFold 3 for Protein Drug Discovery', country: 'GB', lang: 'en', h: 15, topics: ['AI & ML', 'Science', 'Health'] },
    { title: 'Russia Claims Territorial Advances in Eastern Ukraine Offensive', country: 'RU', lang: 'en', h: 3, topics: ['Conflict', 'Geopolitics', 'Defense'], critical: true },
    { title: 'EU Imposes Sweeping Tariffs on Chinese Electric Vehicles', country: 'BE', lang: 'en', h: 6, topics: ['Economy', 'Geopolitics', 'Markets'] },
    { title: 'South Africa Economic Crisis Deepens as Rolling Blackouts Continue', country: 'ZA', lang: 'en', h: 18, topics: ['Economy', 'Energy'] },
    { title: 'Argentina Inflation Hits 200% as IMF Bailout Negotiations Stall', country: 'AR', lang: 'es', h: 8, topics: ['Economy', 'Finance'], critical: true },
    { title: 'Meta Unveils Next-Generation AR Glasses with Neural Interface', country: 'US', lang: 'en', h: 22, topics: ['Technology', 'AI & ML'] },
    { title: 'Pacific Island Nations Declare Climate Emergency at UN General Assembly', country: 'FJ', lang: 'en', h: 24, topics: ['Climate', 'Geopolitics'] },
    { title: 'OpenAI Releases GPT-5 with Advanced Multimodal Reasoning Capabilities', country: 'US', lang: 'en', h: 13, topics: ['AI & ML', 'Technology'] },
    { title: 'Canada Announces Major Immigration Policy Overhaul Amid Housing Crisis', country: 'CA', lang: 'en', h: 17, topics: ['Law & Policy', 'Economy'] },
    { title: 'Mexican Drug Cartel Violence Surges Along Northern Border Regions', country: 'MX', lang: 'es', h: 6, topics: ['Conflict', 'Law & Policy'], critical: true },
    { title: 'South Korea Launches $2 Billion 6G Telecommunications Research Initiative', country: 'KR', lang: 'en', h: 30, topics: ['Technology', 'Economy'] },
    { title: 'Egypt Completes Suez Canal Expansion Amid Red Sea Shipping Disruptions', country: 'EG', lang: 'en', h: 20, topics: ['Economy', 'Geopolitics'] },
    { title: 'Pakistan Military Seizes Power After Disputed National Election', country: 'PK', lang: 'en', h: 4, topics: ['Geopolitics', 'Law & Policy', 'Conflict'], critical: true },
    { title: 'Scientists Achieve Sustained Net Energy Gain in Fusion Reactor', country: 'US', lang: 'en', h: 48, topics: ['Energy', 'Science'] },
    { title: 'Turkey NATO Military Expansion Gives Alliance Second Largest Standing Army', country: 'TR', lang: 'en', h: 35, topics: ['Defense', 'Geopolitics'] },
  ];

  return mockStories.map((s, i) => {
    const coords = COUNTRY_COORDS[s.country];
    return {
      id: stableId(s.title, 'demo-' + i),
      title: s.title,
      description: s.title + ' — Live intelligence feed via ORBIT monitoring system. Analysis available on source publication.',
      url: `https://demo.orbit.news/story/${i + 1}`,
      source: {
        name: s.critical ? ['Reuters', 'AP News', 'BBC World Service'][i % 3] : ['The Guardian', 'Bloomberg', 'CNN International', 'Politico', 'Al Jazeera'][i % 5],
        domain: s.critical ? ['reuters.com', 'apnews.com', 'bbc.com'][i % 3] : ['theguardian.com', 'bloomberg.com', 'cnn.com', 'politico.com', 'aljazeera.com'][i % 5],
        type: s.critical ? 'wire' : ['newspaper', 'broadcast', 'digital'][i % 3],
      },
      publishedAt: hoursAgo(s.h),
      country: s.country,
      region: coords?.region || 'Unknown',
      lat: coords ? (coords.lat + (Math.random() - 0.5) * 2) : 0,
      lng: coords ? (coords.lng + (Math.random() - 0.5) * 2) : 0,
      language: s.lang || 'en',
      topics: s.topics || [],
      sentiment: s.critical ? 'critical' : 'neutral',
      severity: s.critical ? (s.h < 2 ? 'critical' : 'high') : (s.h < 6 ? 'high' : s.h < 24 ? 'moderate' : 'low'),
      clusterSize: Math.max(1, Math.floor(Math.random() * 5)),
      clusterId: stableId(s.title, 'demo-' + i),
      _cluster: [],
      _demo: true,
    };
  });
}

async function fetchGNews(apiKey, opts = {}) {
  const params = new URLSearchParams({ token: apiKey, lang: opts.lang || 'en', max: '10' });
  if (opts.country) params.set('country', opts.country.toLowerCase());
  if (opts.topic) params.set('topic', opts.topic);
  const resp = await fetch(`https://gnews.io/api/v4/top-headlines?${params}`, { timeout: 8000 });
  if (!resp.ok) { const e = new Error(`GNews ${resp.status}`); e.status = resp.status; throw e; }
  const data = await resp.json();
  return (data.articles || []).map(a => normalizeGNews(a, opts.country)).filter(Boolean);
}

async function fetchNewsAPI(apiKey, opts = {}) {
  const params = new URLSearchParams({ apiKey, language: opts.language || 'en', pageSize: '20' });
  if (opts.country) params.set('country', opts.country.toLowerCase());
  if (opts.category) params.set('category', opts.category);
  const resp = await fetch(`https://newsapi.org/v2/top-headlines?${params}`, { timeout: 8000 });
  if (!resp.ok) { const e = new Error(`NewsAPI ${resp.status}`); e.status = resp.status; throw e; }
  const data = await resp.json();
  if (data.status !== 'ok') throw new Error(`NewsAPI: ${data.message}`);
  return (data.articles || []).map(a => normalizeNewsAPI(a, opts.country, opts.language)).filter(Boolean);
}

const GNEWS_CALLS = [
  { topic: 'world' }, { topic: 'technology' }, { topic: 'business' }, { topic: 'science' }, { topic: 'health' },
];
const NEWSAPI_CALLS = [
  { category: 'general', country: 'us' }, { category: 'technology', country: 'us' },
  { category: 'science', country: 'gb' }, { category: 'health', country: 'us' },
  { category: 'business', country: 'us' }, { category: 'general', country: 'gb' },
  { category: 'general', country: 'au' },
];

async function fetchAllNews(gnewsKey, newsApiKey) {
  if (!gnewsKey && !newsApiKey) {
    console.log('[ORBIT] No API keys — DEMO MODE');
    return { stories: deduplicate(generateMockData()), partial: false, demo: true };
  }

  const allStories = [];
  let gnewsOk = false, newsApiOk = false;

  const gnewsResults = gnewsKey
    ? await Promise.allSettled(GNEWS_CALLS.map(o => fetchGNews(gnewsKey, o).catch(e => { console.warn('[ORBIT] GNews:', e.message); return []; })))
    : [];
  const newsApiResults = newsApiKey
    ? await Promise.allSettled(NEWSAPI_CALLS.map(o => fetchNewsAPI(newsApiKey, { language: 'en', ...o }).catch(e => { console.warn('[ORBIT] NewsAPI:', e.message); return []; })))
    : [];

  for (const r of gnewsResults) { if (r.status === 'fulfilled' && r.value.length) { allStories.push(...r.value); gnewsOk = true; } }
  for (const r of newsApiResults) { if (r.status === 'fulfilled' && r.value.length) { allStories.push(...r.value); newsApiOk = true; } }

  if (!allStories.length) return { stories: [], partial: false, stale: true, demo: false };

  const deduped = deduplicate(allStories);
  const partial = (gnewsKey && !gnewsOk) || (newsApiKey && !newsApiOk);
  console.log(`[ORBIT] ${allStories.length} raw → ${deduped.length} deduped (partial=${partial})`);
  return { stories: deduped, partial, demo: false };
}

module.exports = {
  fetchAllNews, generateMockData, normalizeGNews, normalizeNewsAPI, deduplicate,
  inferTopics, inferSentiment, inferSeverity, jaccardSimilarity, tokenize, stableId,
  TOPIC_KEYWORDS, CRITICAL_KEYWORDS,
};
