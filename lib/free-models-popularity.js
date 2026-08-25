'use strict';

function shouldFetchRankingsDaily(apiKey) {
  return Boolean(apiKey && String(apiKey).trim());
}

function normalizeKey(value) {
  if (value == null) return '';
  return String(value).toLowerCase().replace(/:free$/, '');
}

function rankingKeysFor(model) {
  const keys = new Set();
  for (const raw of [model.id, model.canonical_slug]) {
    if (!raw) continue;
    const lower = String(raw).toLowerCase();
    keys.add(lower);
    keys.add(normalizeKey(lower));
    if (!lower.endsWith(':free')) keys.add(`${lower}:free`);
  }
  return keys;
}

function coerceTokens(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rankingsRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function pickLatestRankingsDay(payload) {
  const rows = rankingsRows(payload).filter(
    (row) => row && row.model_permaslug && row.model_permaslug !== 'other'
  );
  if (rows.length === 0) return { date: null, rows: [], asOf: payload?.meta?.as_of || null };

  let latestDate = null;
  for (const row of rows) {
    if (typeof row.date === 'string' && (!latestDate || row.date > latestDate)) {
      latestDate = row.date;
    }
  }

  const dayRows = (latestDate ? rows.filter((row) => row.date === latestDate) : rows).slice();
  dayRows.sort((a, b) => {
    const tokenDiff = coerceTokens(b.total_tokens) - coerceTokens(a.total_tokens);
    if (tokenDiff !== 0) return tokenDiff;
    return String(a.model_permaslug).localeCompare(String(b.model_permaslug));
  });

  return {
    date: latestDate,
    rows: dayRows,
    asOf: payload?.meta?.as_of || null,
  };
}

function matchRankingsDaily(model, dayRows) {
  const keys = rankingKeysFor(model);
  for (let i = 0; i < dayRows.length; i++) {
    const slug = String(dayRows[i].model_permaslug || '').toLowerCase();
    const normalized = normalizeKey(slug);
    if (keys.has(slug) || keys.has(normalized) || keys.has(`${normalized}:free`)) {
      return {
        rank: i + 1,
        tokens: coerceTokens(dayRows[i].total_tokens),
        source: 'rankings-daily',
      };
    }
  }
  return null;
}

function relativeRankFromTopWeekly(model, topWeeklyModels, freeIds) {
  if (!Array.isArray(topWeeklyModels) || !model?.id) return null;
  const freeSet = new Set(freeIds);
  let rank = 0;
  for (const entry of topWeeklyModels) {
    const id = entry?.id;
    if (!id || !freeSet.has(id)) continue;
    rank += 1;
    if (id === model.id) {
      return { rank, source: 'top-weekly' };
    }
  }
  return null;
}

function recordedMiss({ source, reason, asOf }) {
  return {
    rank: null,
    tokens: null,
    source,
    reason,
    asOf,
  };
}

function attachPopularity({
  models,
  rankingsDaily = null,
  topWeekly = null,
  asOf,
  hasApiKey = false,
} = {}) {
  const useDaily = shouldFetchRankingsDaily(hasApiKey);
  const daily = useDaily ? pickLatestRankingsDay(rankingsDaily) : { date: null, rows: [], asOf: null };
  const dailyRows = daily.rows;
  const dailyAsOf = daily.asOf || asOf;
  const weeklyModels = Array.isArray(topWeekly) ? topWeekly : [];
  const freeIds = models.map((m) => m.id);
  const hasDaily = dailyRows.length > 0;
  const hasWeekly = weeklyModels.length > 0;

  return models.map((model) => {
    if (hasDaily) {
      const hit = matchRankingsDaily(model, dailyRows);
      if (hit) {
        return {
          ...model,
          popularity: {
            rank: hit.rank,
            tokens: hit.tokens,
            source: hit.source,
            asOf: dailyAsOf,
          },
        };
      }
    }

    if (hasWeekly) {
      const hit = relativeRankFromTopWeekly(model, weeklyModels, freeIds);
      if (hit) {
        return {
          ...model,
          popularity: {
            rank: hit.rank,
            source: hit.source,
            asOf,
          },
        };
      }
    }

    const source = useDaily ? 'rankings-daily' : 'top-weekly';
    const reason = hasDaily || hasWeekly ? 'unmatched' : 'unavailable';
    return {
      ...model,
      popularity: recordedMiss({ source, reason, asOf }),
    };
  });
}

module.exports = {
  shouldFetchRankingsDaily,
  pickLatestRankingsDay,
  matchRankingsDaily,
  relativeRankFromTopWeekly,
  attachPopularity,
};
