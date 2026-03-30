const { getStore } = require('@netlify/blobs');
const { checkRateLimit, recordFailedAttempt, clearRateLimit } = require('./_rateLimit');

// 密碼必須設定在 Netlify 環境變數 ADMIN_PASSWORD，不在程式碼裡存放
const ADMIN_PW = process.env.ADMIN_PASSWORD;

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
  // 依 blob key 排序（key 包含 base-36 時間戳，可正確按時間排序）
  const sorted = [...blobs].sort((a, b) => a.key < b.key ? -1 : 1);
  const all = await Promise.all(sorted.map(b => store.get(b.key, { type: 'json' })));
  return all.filter(Boolean);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

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
  const pw = event.headers['x-admin-password'] || (event.queryStringParameters || {}).pw;
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

  try {
    const rows = await getAllResponses();
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(rows.reverse()),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
