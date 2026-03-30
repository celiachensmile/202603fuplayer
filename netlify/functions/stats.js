const { getStore } = require('@netlify/blobs');

const ADMIN_PW = process.env.ADMIN_PASSWORD || 'fuplayer2026';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
};

function getBlobStore() {
  const opts = { name: 'fuplayer-survey', consistency: 'strong' };
  if (process.env.BLOBS_SITE_ID) opts.siteID = process.env.BLOBS_SITE_ID;
  if (process.env.BLOBS_TOKEN) opts.token = process.env.BLOBS_TOKEN;
  return getStore(opts);
}

async function getAllResponses() {
  const store = getBlobStore();
  const { blobs } = await store.list({ prefix: 'response:' });
  const all = await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })));
  return all.filter(Boolean).sort((a, b) => (a.submitted_at > b.submitted_at ? 1 : -1));
}

function calcStats(rows) {
  const total = rows.length;
  if (total === 0) return { total: 0 };

  const countSingle = (field) => {
    const map = {};
    rows.forEach(r => { const v = r[field]; if (v) map[v] = (map[v] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count, pct: Math.round(count / total * 100) }));
  };

  const countMulti = (field) => {
    const map = {};
    rows.forEach(r => {
      const v = r[field]; if (!v) return;
      v.split('|').forEach(item => { item = item.trim(); if (item) map[item] = (map[item] || 0) + 1; });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count, pct: Math.round(count / total * 100) }));
  };

  const avgScale = (field) => {
    const vals = rows.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  };

  const topVal = (field) => { const a = countSingle(field); return a.length ? a[0].label : '—'; };

  const crossSingle = (fa, fb) => {
    const r = {};
    rows.forEach(row => {
      const a = row[fa], b = row[fb];
      if (!a || !b) return;
      if (!r[a]) r[a] = {};
      r[a][b] = (r[a][b] || 0) + 1;
    });
    return r;
  };

  const crossMultiA = (fa, fb) => {
    const r = {};
    rows.forEach(row => {
      const a = row[fa], b = row[fb];
      if (!a || !b) return;
      a.split('|').forEach(item => {
        item = item.trim();
        if (!item) return;
        if (!r[item]) r[item] = {};
        r[item][b] = (r[item][b] || 0) + 1;
      });
    });
    return r;
  };

  const interestedCount = rows.filter(r => {
    const v = r.q18 || '';
    return v.includes('非常有興趣') || v.includes('有興趣，但還需要');
  }).length;

  return {
    total,
    summaryCards: {
      topAge: topVal('q1'),
      avgAiImpact: avgScale('q5'),
      avgInterest: avgScale('q10'),
      interestedPct: Math.round(interestedCount / total * 100),
      topPrice: topVal('q16')
    },
    charts: {
      q1: countSingle('q1'), q4: countSingle('q4'), q9: countMulti('q9'), q5: countSingle('q5'),
      q6: countSingle('q6'), q7: countMulti('q7'), q8: countMulti('q8'),
      q10: countSingle('q10'), q11: countMulti('q11'), q13: countSingle('q13'),
      q14: countMulti('q14'), q15: countMulti('q15'), q16: countSingle('q16'),
      q17: countMulti('q17'), q18: countSingle('q18'), q19: countMulti('q19')
    },
    crossAnalysis: {
      ageInterest: crossSingle('q1', 'q10'),
      ageConcern: crossMultiA('q1', 'q7'),
      rolePrice: crossMultiA('q2', 'q16'),
      aiInterest: crossSingle('q5', 'q10'),
      moodObstacle: crossMultiA('q6', 'q11')
    }
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const pw = event.headers['x-admin-password'] || (event.queryStringParameters || {}).pw;
  if (pw !== ADMIN_PW) {
    return { statusCode: 401, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '未授權' }) };
  }

  try {
    const rows = await getAllResponses();
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(calcStats(rows))
    };
  } catch (e) {
    return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
