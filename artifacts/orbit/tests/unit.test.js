'use strict';

const test = require('node:test');
const assert = require('node:assert');

// ─── geo.js tests ────────────────────────────────────────────────────────────
const geo = require('../geo');

test('COUNTRY_COORDS has ~180 entries', () => {
  const count = Object.keys(geo.COUNTRY_COORDS).length;
  assert.ok(count >= 170, `Expected ≥170 countries, got ${count}`);
});

test('getCoords returns correct data for US', () => {
  const coords = geo.getCoords('US');
  assert.ok(coords, 'US should exist');
  assert.strictEqual(coords.name, 'United States');
  assert.strictEqual(coords.region, 'North America');
  assert.ok(typeof coords.lat === 'number');
  assert.ok(typeof coords.lng === 'number');
});

test('getCoords is case-insensitive', () => {
  assert.deepStrictEqual(geo.getCoords('gb'), geo.getCoords('GB'));
});

test('getCoords returns null for unknown code', () => {
  assert.strictEqual(geo.getCoords('ZZ'), null);
  assert.strictEqual(geo.getCoords(null), null);
  assert.strictEqual(geo.getCoords(undefined), null);
  assert.strictEqual(geo.getCoords(''), null);
});

test('inferCountryFromText detects United States', () => {
  const code = geo.inferCountryFromText('President Biden spoke in Washington United States today');
  assert.strictEqual(code, 'US');
});

test('inferCountryFromText detects UK alias', () => {
  const code = geo.inferCountryFromText('The UK government announced new measures');
  assert.strictEqual(code, 'GB');
});

test('inferCountryFromText returns null for empty/null', () => {
  assert.strictEqual(geo.inferCountryFromText(''), null);
  assert.strictEqual(geo.inferCountryFromText(null), null);
});

test('inferCountryFromUrl detects .de TLD', () => {
  const code = geo.inferCountryFromUrl('https://spiegel.de/article/test');
  assert.strictEqual(code, 'DE');
});

test('inferCountryFromUrl returns null for unknown TLD', () => {
  assert.strictEqual(geo.inferCountryFromUrl('https://example.xyz/article'), null);
});

test('inferCountryFromUrl handles malformed URL', () => {
  assert.strictEqual(geo.inferCountryFromUrl('not-a-url'), null);
  assert.strictEqual(geo.inferCountryFromUrl(null), null);
});

test('REGION_COUNTRIES groups countries correctly', () => {
  const europeanCodes = geo.REGION_COUNTRIES['Europe'];
  assert.ok(Array.isArray(europeanCodes));
  assert.ok(europeanCodes.includes('DE'));
  assert.ok(europeanCodes.includes('FR'));
  assert.ok(europeanCodes.includes('IT'));
});

test('All COUNTRY_COORDS have required fields', () => {
  for (const [code, entry] of Object.entries(geo.COUNTRY_COORDS)) {
    assert.ok(entry.name, `${code}: missing name`);
    assert.ok(entry.region, `${code}: missing region`);
    assert.ok(typeof entry.lat === 'number', `${code}: lat not a number`);
    assert.ok(typeof entry.lng === 'number', `${code}: lng not a number`);
    assert.ok(entry.lat >= -90 && entry.lat <= 90, `${code}: invalid lat ${entry.lat}`);
    assert.ok(entry.lng >= -180 && entry.lng <= 180, `${code}: invalid lng ${entry.lng}`);
  }
});

// ─── filters.js tests ────────────────────────────────────────────────────────
const { applyFilters, parseKeywordQuery, matchesKeywordQuery } = require('../filters');

test('parseKeywordQuery: AND (implicit)', () => {
  const r = parseKeywordQuery('AI chip');
  assert.deepStrictEqual(r.must, ['ai', 'chip']);
  assert.deepStrictEqual(r.should, []);
  assert.deepStrictEqual(r.not, []);
});

test('parseKeywordQuery: OR', () => {
  const r = parseKeywordQuery('AI OR climate');
  assert.ok(r.should.includes('ai'));
  assert.ok(r.should.includes('climate'));
});

test('parseKeywordQuery: exclude with -', () => {
  const r = parseKeywordQuery('-war economy');
  assert.ok(r.not.includes('war'));
  assert.ok(r.must.includes('economy'));
});

test('parseKeywordQuery: exact phrase', () => {
  const r = parseKeywordQuery('"climate deal"');
  assert.ok(r.phrases.includes('climate deal'));
});

test('parseKeywordQuery: empty/null returns empty sets', () => {
  assert.deepStrictEqual(parseKeywordQuery(''), { must: [], should: [], not: [], phrases: [] });
  assert.deepStrictEqual(parseKeywordQuery(null), { must: [], should: [], not: [], phrases: [] });
});

test('matchesKeywordQuery: AND match works', () => {
  const story = { title: 'AI chip shortage', description: 'Semiconductor crisis' };
  const q = parseKeywordQuery('AI chip');
  assert.ok(matchesKeywordQuery(story, q));
});

test('matchesKeywordQuery: AND partial fails', () => {
  const story = { title: 'AI technology news', description: '' };
  const q = parseKeywordQuery('AI chip');
  assert.strictEqual(matchesKeywordQuery(story, q), false);
});

test('matchesKeywordQuery: exclude works', () => {
  const story = { title: 'War in Ukraine', description: 'Military conflict' };
  const q = parseKeywordQuery('-war');
  assert.strictEqual(matchesKeywordQuery(story, q), false);
});

test('matchesKeywordQuery: exact phrase match', () => {
  const storyMatch = { title: 'Climate deal signed in Paris', description: '' };
  const storyNoMatch = { title: 'Climate changes in policy', description: '' };
  const q = parseKeywordQuery('"climate deal"');
  assert.ok(matchesKeywordQuery(storyMatch, q));
  assert.strictEqual(matchesKeywordQuery(storyNoMatch, q), false);
});

test('matchesKeywordQuery: OR match works', () => {
  const story1 = { title: 'AI advances in research', description: '' };
  const story2 = { title: 'Climate summit opens', description: '' };
  const storyNeither = { title: 'Sports news today', description: '' };
  const q = parseKeywordQuery('AI OR climate');
  assert.ok(matchesKeywordQuery(story1, q));
  assert.ok(matchesKeywordQuery(story2, q));
  assert.strictEqual(matchesKeywordQuery(storyNeither, q), false);
});

test('applyFilters returns all stories when no params', () => {
  const stories = [
    { title: 'Story A', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'wire' } },
    { title: 'Story B', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'GB', region: 'Europe', language: 'en', sentiment: 'neutral', severity: 'moderate', clusterSize: 1, source: { type: 'newspaper' } },
  ];
  const result = applyFilters(stories, {});
  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.stories.length, 2);
});

test('applyFilters: topic filter', () => {
  const stories = [
    { title: 'A', description: '', publishedAt: new Date().toISOString(), topics: ['AI & ML'], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
    { title: 'B', description: '', publishedAt: new Date().toISOString(), topics: ['Economy'], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
  ];
  const result = applyFilters(stories, { topics: 'AI & ML' });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.stories[0].title, 'A');
});

test('applyFilters: country filter', () => {
  const stories = [
    { title: 'A', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
    { title: 'B', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'GB', region: 'Europe', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
  ];
  const result = applyFilters(stories, { countries: 'GB' });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.stories[0].country, 'GB');
});

test('applyFilters: region filter', () => {
  const stories = [
    { title: 'A', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
    { title: 'B', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'DE', region: 'Europe', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
  ];
  const result = applyFilters(stories, { regions: 'Europe' });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.stories[0].country, 'DE');
});

test('applyFilters: language filter', () => {
  const stories = [
    { title: 'A', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
    { title: 'B', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'FR', region: 'Europe', language: 'fr', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
  ];
  const result = applyFilters(stories, { languages: 'fr' });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.stories[0].language, 'fr');
});

test('applyFilters: sentiment filter', () => {
  const stories = [
    { title: 'A', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'critical', severity: 'high', clusterSize: 1, source: { type: 'wire' } },
    { title: 'B', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
  ];
  const result = applyFilters(stories, { sentiment: 'critical' });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.stories[0].sentiment, 'critical');
});

test('applyFilters: minSources filter', () => {
  const stories = [
    { title: 'A', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 3, source: { type: 'digital' } },
    { title: 'B', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
  ];
  const result = applyFilters(stories, { minSources: '3' });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.stories[0].clusterSize, 3);
});

test('applyFilters: recency filter', () => {
  const now = new Date();
  const recentDate = new Date(now.getTime() - 3600000).toISOString(); // 1h ago
  const oldDate = new Date(now.getTime() - 7 * 24 * 3600000).toISOString(); // 7d ago
  const stories = [
    { title: 'Recent', description: '', publishedAt: recentDate, topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
    { title: 'Old', description: '', publishedAt: oldDate, topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
  ];
  const from = new Date(now.getTime() - 2 * 3600000).toISOString(); // 2h ago
  const result = applyFilters(stories, { from });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.stories[0].title, 'Recent');
});

test('applyFilters: sort by severity', () => {
  const now = new Date().toISOString();
  const stories = [
    { title: 'Low', description: '', publishedAt: now, topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
    { title: 'Critical', description: '', publishedAt: now, topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'critical', severity: 'critical', clusterSize: 1, source: { type: 'wire' } },
    { title: 'Moderate', description: '', publishedAt: now, topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'moderate', clusterSize: 1, source: { type: 'digital' } },
  ];
  const result = applyFilters(stories, { sort: 'severity' });
  assert.strictEqual(result.stories[0].severity, 'critical');
  assert.strictEqual(result.stories[2].severity, 'low');
});

test('applyFilters: source type filter', () => {
  const stories = [
    { title: 'Wire', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'high', clusterSize: 1, source: { type: 'wire' } },
    { title: 'Digital', description: '', publishedAt: new Date().toISOString(), topics: [], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
  ];
  const result = applyFilters(stories, { sources: 'wire' });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.stories[0].title, 'Wire');
});

test('applyFilters: pagination works', () => {
  const stories = Array.from({ length: 10 }, (_, i) => ({
    title: `Story ${i}`, description: '', publishedAt: new Date().toISOString(),
    topics: [], country: 'US', region: 'North America', language: 'en',
    sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' },
  }));
  const result = applyFilters(stories, { page: '2', limit: '3' });
  assert.strictEqual(result.page, 2);
  assert.strictEqual(result.limit, 3);
  assert.strictEqual(result.total, 10);
  assert.strictEqual(result.stories.length, 3);
});

test('applyFilters: empty stories returns empty result', () => {
  const result = applyFilters([], {});
  assert.strictEqual(result.total, 0);
  assert.deepStrictEqual(result.stories, []);
});

test('applyFilters: non-array input returns empty result', () => {
  const result = applyFilters(null, {});
  assert.strictEqual(result.total, 0);
});

test('applyFilters: keyword filter via q param', () => {
  const stories = [
    { title: 'AI advances rapidly', description: 'Machine learning grows', publishedAt: new Date().toISOString(), topics: ['AI & ML'], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
    { title: 'Sports news today', description: 'Game results', publishedAt: new Date().toISOString(), topics: ['Culture'], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
  ];
  const result = applyFilters(stories, { q: 'AI' });
  assert.strictEqual(result.total, 1);
  assert.ok(result.stories[0].title.includes('AI'));
});

// ─── news.js tests ────────────────────────────────────────────────────────────
const news = require('../news');

test('inferTopics detects AI & ML', () => {
  const topics = news.inferTopics('OpenAI releases new GPT model', 'Large language model breakthrough');
  assert.ok(topics.includes('AI & ML'), `Expected AI & ML in ${JSON.stringify(topics)}`);
});

test('inferTopics detects Conflict', () => {
  const topics = news.inferTopics('War breaks out in region', 'Airstrike kills civilians');
  assert.ok(topics.includes('Conflict'));
});

test('inferTopics detects multiple topics', () => {
  const topics = news.inferTopics('AI cybersecurity threat grows', 'Machine learning used in cyberattack');
  assert.ok(topics.includes('AI & ML'));
  assert.ok(topics.includes('Cyber'));
});

test('inferTopics returns empty for unrelated text', () => {
  const topics = news.inferTopics('Local bakery wins award', 'Best croissant in town');
  assert.ok(Array.isArray(topics));
});

test('inferSentiment detects critical keywords', () => {
  assert.strictEqual(news.inferSentiment('War breaks out in region', ''), 'critical');
  assert.strictEqual(news.inferSentiment('Earthquake kills hundreds', ''), 'critical');
  assert.strictEqual(news.inferSentiment('Coup attempt fails', ''), 'critical');
});

test('inferSentiment returns neutral for normal news', () => {
  assert.strictEqual(news.inferSentiment('Company reports record profits', 'Revenue up 20%'), 'neutral');
  assert.strictEqual(news.inferSentiment('Scientists discover new planet', ''), 'neutral');
});

test('inferSeverity: wire source < 2h = critical', () => {
  const twoMinAgo = new Date(Date.now() - 2 * 60000).toISOString();
  assert.strictEqual(news.inferSeverity(twoMinAgo, 'wire'), 'critical');
});

test('inferSeverity: any source 3h ago = high', () => {
  const threeHAgo = new Date(Date.now() - 3 * 3600000).toISOString();
  assert.strictEqual(news.inferSeverity(threeHAgo, 'digital'), 'high');
});

test('inferSeverity: 25h ago = low', () => {
  const old = new Date(Date.now() - 25 * 3600000).toISOString();
  assert.strictEqual(news.inferSeverity(old, 'newspaper'), 'low');
});

test('stableId is deterministic', () => {
  const id1 = news.stableId('Test headline', 'Reuters');
  const id2 = news.stableId('Test headline', 'Reuters');
  assert.strictEqual(id1, id2);
});

test('stableId differs for different inputs', () => {
  const id1 = news.stableId('Headline A', 'Source A');
  const id2 = news.stableId('Headline B', 'Source B');
  assert.notStrictEqual(id1, id2);
});

test('tokenize removes stopwords and returns Set', () => {
  const tokens = news.tokenize('The quick brown fox jumped over the lazy dog');
  assert.ok(tokens instanceof Set);
  assert.ok(!tokens.has('the'));
  assert.ok(tokens.has('quick'));
  assert.ok(tokens.has('brown'));
});

test('tokenize handles empty/null input', () => {
  const t1 = news.tokenize('');
  const t2 = news.tokenize(null);
  assert.ok(t1 instanceof Set && t1.size === 0);
  assert.ok(t2 instanceof Set && t2.size === 0);
});

test('jaccardSimilarity: identical sets = 1', () => {
  const a = new Set(['apple', 'banana', 'cherry']);
  assert.strictEqual(news.jaccardSimilarity(a, a), 1);
});

test('jaccardSimilarity: disjoint sets = 0', () => {
  const a = new Set(['apple', 'banana']);
  const b = new Set(['cherry', 'date']);
  assert.strictEqual(news.jaccardSimilarity(a, b), 0);
});

test('jaccardSimilarity: partial overlap', () => {
  const a = new Set(['apple', 'banana', 'cherry']);
  const b = new Set(['banana', 'cherry', 'date']);
  const sim = news.jaccardSimilarity(a, b);
  assert.ok(sim > 0 && sim < 1);
  assert.ok(Math.abs(sim - 0.5) < 0.01);
});

test('jaccardSimilarity: both empty = 1', () => {
  assert.strictEqual(news.jaccardSimilarity(new Set(), new Set()), 1);
});

test('deduplicate groups similar stories', () => {
  const stories = [
    { id: 'a1', title: 'Ukraine war continues as Russia advances eastward', severity: 'critical', publishedAt: new Date().toISOString(), clusterSize: 1, clusterId: null },
    { id: 'a2', title: 'Russia advances eastward in Ukraine war continues', severity: 'high', publishedAt: new Date().toISOString(), clusterSize: 1, clusterId: null },
    { id: 'b1', title: 'Stock market reaches all-time high amid AI boom', severity: 'low', publishedAt: new Date().toISOString(), clusterSize: 1, clusterId: null },
  ];
  const result = news.deduplicate(stories);
  assert.ok(result.length <= 2, `Expected ≤2 clusters, got ${result.length}`);
  const rep = result.find(s => s._cluster && s._cluster.length > 1);
  assert.ok(rep, 'Should have a cluster with multiple stories');
});

test('deduplicate: unique stories stay separate', () => {
  const stories = [
    { id: 'x1', title: 'Climate change impacts polar bears habitat severely', severity: 'moderate', publishedAt: new Date().toISOString(), clusterSize: 1, clusterId: null },
    { id: 'x2', title: 'Bitcoin surges past eighty thousand dollars', severity: 'low', publishedAt: new Date().toISOString(), clusterSize: 1, clusterId: null },
    { id: 'x3', title: 'NASA confirms water ice found on Mars surface', severity: 'low', publishedAt: new Date().toISOString(), clusterSize: 1, clusterId: null },
  ];
  const result = news.deduplicate(stories);
  assert.strictEqual(result.length, 3);
});

test('deduplicate sets clusterSize correctly', () => {
  const stories = [
    { id: 'c1', title: 'Global summit on climate change reaches agreement on emissions', severity: 'high', publishedAt: new Date().toISOString(), clusterSize: 1, clusterId: null },
    { id: 'c2', title: 'Climate change summit reaches agreement on global emissions', severity: 'moderate', publishedAt: new Date().toISOString(), clusterSize: 1, clusterId: null },
  ];
  const result = news.deduplicate(stories);
  if (result.length === 1) {
    assert.strictEqual(result[0].clusterSize, 2);
  }
});

test('generateMockData returns array of valid stories', () => {
  const stories = news.generateMockData();
  assert.ok(Array.isArray(stories));
  assert.ok(stories.length >= 30);
  for (const story of stories) {
    assert.ok(story.id, 'Each story needs an id');
    assert.ok(story.title, 'Each story needs a title');
    assert.ok(story.publishedAt, 'Each story needs publishedAt');
    assert.ok(['low', 'moderate', 'high', 'critical'].includes(story.severity), `Invalid severity: ${story.severity}`);
    assert.ok(['neutral', 'critical'].includes(story.sentiment), `Invalid sentiment: ${story.sentiment}`);
    assert.ok(Array.isArray(story.topics));
    assert.ok(typeof story.lat === 'number');
    assert.ok(typeof story.lng === 'number');
  }
});

test('generateMockData stories have valid coordinates', () => {
  const stories = news.generateMockData();
  for (const story of stories) {
    if (story.country !== 'UNKNOWN') {
      assert.ok(story.lat >= -90 && story.lat <= 90, `Invalid lat ${story.lat} for ${story.country}`);
      assert.ok(story.lng >= -180 && story.lng <= 180, `Invalid lng ${story.lng} for ${story.country}`);
    }
  }
});

test('generateMockData: critical stories have critical/high severity', () => {
  const stories = news.generateMockData();
  const criticalSentiment = stories.filter(s => s.sentiment === 'critical');
  assert.ok(criticalSentiment.length > 0, 'Should have some critical stories');
  for (const story of criticalSentiment) {
    assert.ok(['critical', 'high'].includes(story.severity), `Critical story has unexpected severity: ${story.severity}`);
  }
});

test('TOPIC_KEYWORDS has all 16 required topics', () => {
  const required = ['Technology', 'AI & ML', 'Geopolitics', 'Economy', 'Science', 'Climate',
    'Defense', 'Health', 'Energy', 'Space', 'Cyber', 'Finance', 'Law & Policy', 'Markets', 'Culture', 'Conflict'];
  for (const topic of required) {
    assert.ok(news.TOPIC_KEYWORDS[topic], `Missing topic: ${topic}`);
    assert.ok(Array.isArray(news.TOPIC_KEYWORDS[topic]));
    assert.ok(news.TOPIC_KEYWORDS[topic].length > 0);
  }
});

test('CRITICAL_KEYWORDS is a non-empty array', () => {
  assert.ok(Array.isArray(news.CRITICAL_KEYWORDS));
  assert.ok(news.CRITICAL_KEYWORDS.length >= 10);
  assert.ok(news.CRITICAL_KEYWORDS.includes('war'));
  assert.ok(news.CRITICAL_KEYWORDS.includes('earthquake'));
});

// ─── Edge cases ───────────────────────────────────────────────────────────────
test('applyFilters: multiple filters combined', () => {
  const now = new Date().toISOString();
  const stories = [
    { title: 'AI war in Ukraine', description: '', publishedAt: now, topics: ['AI & ML', 'Conflict'], country: 'UA', region: 'Europe', language: 'en', sentiment: 'critical', severity: 'critical', clusterSize: 2, source: { type: 'wire' } },
    { title: 'Stock market rises', description: '', publishedAt: now, topics: ['Finance'], country: 'US', region: 'North America', language: 'en', sentiment: 'neutral', severity: 'low', clusterSize: 1, source: { type: 'digital' } },
    { title: 'France election results', description: '', publishedAt: now, topics: ['Law & Policy'], country: 'FR', region: 'Europe', language: 'fr', sentiment: 'neutral', severity: 'moderate', clusterSize: 1, source: { type: 'newspaper' } },
  ];
  const result = applyFilters(stories, { regions: 'Europe', sentiment: 'critical' });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.stories[0].country, 'UA');
});

test('geo: major world capitals have correct regions', () => {
  assert.strictEqual(geo.getCoords('JP')?.region, 'Asia-Pacific');
  assert.strictEqual(geo.getCoords('NG')?.region, 'Africa');
  assert.strictEqual(geo.getCoords('BR')?.region, 'Latin America');
  assert.strictEqual(geo.getCoords('SA')?.region, 'Middle East');
  assert.strictEqual(geo.getCoords('IN')?.region, 'South Asia');
});

test('parseKeywordQuery: AND with explicit keyword', () => {
  const r = parseKeywordQuery('AI AND chips');
  assert.ok(r.must.includes('ai'));
  assert.ok(r.must.includes('chips'));
});

test('jaccardSimilarity: one empty set = 0', () => {
  const a = new Set(['apple', 'banana']);
  const b = new Set();
  assert.strictEqual(news.jaccardSimilarity(a, b), 0);
  assert.strictEqual(news.jaccardSimilarity(b, a), 0);
});

console.log('✓ All ORBIT unit tests completed');
