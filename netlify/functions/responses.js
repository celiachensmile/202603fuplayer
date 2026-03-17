const { getStore } = require('@netlify/blobs');

const ADMIN_PW = process.env.ADMIN_PASSWORD || 'fuplayer2026';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
};

async function getAllResponses() {
  const store = getStore({ name: 'fuplayer-survey', consistency: 'strong' });
  const { blobs } = await store.list({ prefix: 'response:' });
  const all = await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })));
  return all.filter(Boolean).sort((a, b) => (a.submitted_at > b.submitted_at ? 1 : -1));
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
      body: JSON.stringify(rows.reverse())
    };
  } catch (e) {
    return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
