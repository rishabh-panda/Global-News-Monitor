'use strict';

/**
 * Parse boolean keyword query into a structured filter object.
 * Supports: AND (implicit), OR, -exclude, "exact phrase"
 */
function parseKeywordQuery(query) {
  if (!query || typeof query !== 'string') {
    return { must: [], should: [], not: [], phrases: [] };
  }
  const result = { must: [], should: [], not: [], phrases: [] };
  let remaining = query.trim();

  // Extract quoted phrases
  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(query)) !== null) {
    result.phrases.push(match[1].toLowerCase());
  }
  remaining = remaining.replace(/"([^"]+)"/g, ' ').trim();

  const tokens = remaining.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.toUpperCase() === 'OR') {
      const prev = result.must.pop();
      const next = tokens[i + 1];
      if (prev) result.should.push(prev.toLowerCase());
      if (next && next.toUpperCase() !== 'OR' && !next.startsWith('-')) {
        result.should.push(next.toLowerCase());
        i++;
      }
    } else if (token.startsWith('-') && token.length > 1) {
      result.not.push(token.slice(1).toLowerCase());
    } else if (token.toUpperCase() !== 'AND') {
      result.must.push(token.toLowerCase());
    }
    i++;
  }
  return result;
}

function matchesKeywordQuery(story, parsedQuery) {
  const { must, should, not, phrases } = parsedQuery;
  if (!must.length && !should.length && !not.length && !phrases.length) return true;
  const text = ((story.title || '') + ' ' + (story.description || '')).toLowerCase();
  for (const term of must) { if (!text.includes(term)) return false; }
  for (const term of not) { if (text.includes(term)) return false; }
  for (const phrase of phrases) { if (!text.includes(phrase)) return false; }
  if (should.length > 0 && !should.some(t => text.includes(t))) return false;
  return true;
}

function relevanceScore(story, parsedQuery) {
  const title = (story.title || '').toLowerCase();
  let score = 0;
  const allTerms = [...parsedQuery.must, ...parsedQuery.should, ...parsedQuery.phrases];
  for (const term of allTerms) {
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const m = title.match(re);
    if (m) score += m.length;
  }
  return score;
}

const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, low: 1 };

/**
 * Apply all 9 filters to an array of stories and return paginated results.
 */
function applyFilters(stories, params) {
  if (!Array.isArray(stories)) return { stories: [], total: 0, page: 1, limit: 40 };

  let result = [...stories];

  // 1. Keyword
  if (params.q && params.q.trim()) {
    const parsed = parseKeywordQuery(params.q);
    result = result.filter(s => matchesKeywordQuery(s, parsed));
  }

  // 2. Topics (ANY match)
  if (params.topics) {
    const topicList = String(params.topics).split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (topicList.length > 0) {
      result = result.filter(s => Array.isArray(s.topics) && s.topics.some(t => topicList.includes(t.toLowerCase())));
    }
  }

  // 3. Countries
  if (params.countries) {
    const countryList = String(params.countries).split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    if (countryList.length > 0) {
      result = result.filter(s => countryList.includes((s.country || '').toUpperCase()));
    }
  }

  // 4. Regions
  if (params.regions) {
    const regionList = String(params.regions).split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
    if (regionList.length > 0) {
      result = result.filter(s => s.region && regionList.includes(s.region.toLowerCase()));
    }
  }

  // 5. Source type
  if (params.sources) {
    const sourceList = String(params.sources).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (sourceList.length > 0) {
      result = result.filter(s => s.source && sourceList.includes((s.source.type || '').toLowerCase()));
    }
  }

  // 6. Language
  if (params.languages) {
    const langList = String(params.languages).split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
    if (langList.length > 0) {
      result = result.filter(s => langList.includes((s.language || '').toLowerCase()));
    }
  }

  // 7. Recency
  if (params.from) {
    const fromDate = new Date(params.from);
    if (!isNaN(fromDate.getTime())) {
      result = result.filter(s => {
        const pub = new Date(s.publishedAt);
        return !isNaN(pub.getTime()) && pub >= fromDate;
      });
    }
  }

  // 8. Sentiment
  if (params.sentiment && params.sentiment !== 'all') {
    const sentiment = params.sentiment.toLowerCase();
    result = result.filter(s => s.sentiment === sentiment);
  }

  // 9. Min cluster size
  if (params.minSources && parseInt(params.minSources, 10) > 1) {
    const min = parseInt(params.minSources, 10);
    result = result.filter(s => (s.clusterSize || 1) >= min);
  }

  // Sort
  const sort = params.sort || 'recency';
  if (sort === 'severity') {
    result.sort((a, b) => {
      const rankDiff = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
      return rankDiff !== 0 ? rankDiff : new Date(b.publishedAt) - new Date(a.publishedAt);
    });
  } else if (sort === 'relevance' && params.q) {
    const parsed = parseKeywordQuery(params.q);
    result.sort((a, b) => {
      const sd = relevanceScore(b, parsed) - relevanceScore(a, parsed);
      return sd !== 0 ? sd : new Date(b.publishedAt) - new Date(a.publishedAt);
    });
  } else {
    result.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }

  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 40));
  const total = result.length;
  return { stories: result.slice((page - 1) * limit, page * limit), total, page, limit };
}

module.exports = { applyFilters, parseKeywordQuery, matchesKeywordQuery, relevanceScore };
