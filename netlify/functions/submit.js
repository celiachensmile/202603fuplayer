const { getStore } = require('@netlify/blobs');

function getBlobStore() {
  const opts = { name: 'fuplayer-survey', consistency: 'strong' };
  if (process.env.NETLIFY_SITE_ID) opts.siteID = process.env.NETLIFY_SITE_ID;
  if (process.env.NETLIFY_TOKEN) opts.token = process.env.NETLIFY_TOKEN;
  return getStore(opts);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const store = getBlobStore();
    const d = JSON.parse(event.body || '{}');

    const fmt = v => Array.isArray(v) ? v.join('|') : (v || null);
    const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const record = {
      id, submitted_at: now,
      q1: d.q1||null, q2: fmt(d.q2), q3: fmt(d.q3), q4: d.q4||null,
      q5: d.q5||null, q6: d.q6||null, q7: fmt(d.q7), q8: fmt(d.q8),
      q9: fmt(d.q9),
      q10: d.q10||null, q11: fmt(d.q11), q12: d.q12||null, q13: d.q13||null,
      q14: fmt(d.q14), q15: fmt(d.q15), q16: d.q16||null, q17: fmt(d.q17),
      q18: d.q18||null, q19: fmt(d.q19), q20: d.q20||null, q21: d.q21||null, q22: d.q22||null
    };

    await store.setJSON(`response:${id}`, record);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, id })
    };
  } catch (e) {
    console.error('Submit error:', e);
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '伺服器錯誤: ' + e.message })
    };
  }
};
