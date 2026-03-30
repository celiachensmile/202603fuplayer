const { getStore } = require('@netlify/blobs');
const { checkRateLimit, recordFailedAttempt, clearRateLimit } = require('./_rateLimit');

// 密碼必須設定在 Netlify 環境變數 ADMIN_PASSWORD，不在程式碼裡存放
const ADMIN_PW = process.env.ADMIN_PASSWORD;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
};

function getBlobStore() {
  const opts = { name: 'fuplayer-survey', consistency: 'strong' };
  if (process.env.NETLIFY_SITE_ID) opts.siteID = process.env.NETLIFY_SITE_ID;
  if (process.env.NETLIFY_TOKEN) opts.token = process.env.NETLIFY_TOKEN;
  return getStore(opts);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // ── 1. 檢查 rate limit（防暴力破解）──────────────────────────
  const rl = await checkRateLimit(event);
  if (rl.blocked) {
    return {
      statusCode: 429,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: rl.message }),
    };
  }

  // ── 2. 驗證密碼 ───────────────────────────────────────────────
  const pw = event.headers['x-admin-password'];
  if (!ADMIN_PW || pw !== ADMIN_PW) {
    await recordFailedAttempt(event);
    return {
      statusCode: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '未授權' }),
    };
  }

  // 登入成功，清除失敗記錄
  await clearRateLimit(event);

  const id = (event.queryStringParameters || {}).id;
  if (!id) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '缺少 id 參數' }),
    };
  }

  try {
    const store = getBlobStore();
    await store.delete(`response:${id}`);
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
