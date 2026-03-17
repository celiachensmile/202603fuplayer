const { getStore } = require('@netlify/blobs');

const ADMIN_PW = process.env.ADMIN_PASSWORD || 'fuplayer2026';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
};

function getBlobStore() {
  const opts = { name: 'fuplayer-survey', consistency: 'strong' };
  if (process.env.NETLIFY_SITE_ID) opts.siteID = process.env.NETLIFY_SITE_ID;
  if (process.env.NETLIFY_TOKEN) opts.token = process.env.NETLIFY_TOKEN;
  return getStore(opts);
}

// 判斷是否為舊格式：有 q21（Email）但沒有 q22
function needsMigration(record) {
  return record.q21 !== undefined && record.q22 === undefined;
}

// 把舊欄位 q9–q21 往後移到 q10–q22，新 q9 設為 null
function migrateRecord(old) {
  return {
    ...old,
    q9:  null,          // 新題目，舊資料無答案
    q10: old.q9  ?? null,
    q11: old.q10 ?? null,
    q12: old.q11 ?? null,
    q13: old.q12 ?? null,
    q14: old.q13 ?? null,
    q15: old.q14 ?? null,
    q16: old.q15 ?? null,
    q17: old.q16 ?? null,
    q18: old.q17 ?? null,
    q19: old.q18 ?? null,
    q20: old.q19 ?? null,
    q21: old.q20 ?? null,
    q22: old.q21 ?? null,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const pw = event.headers['x-admin-password'] || (event.queryStringParameters || {}).pw;
  if (pw !== ADMIN_PW) {
    return { statusCode: 401, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '未授權' }) };
  }

  try {
    const store = getBlobStore();
    const { blobs } = await store.list({ prefix: 'response:' });

    let migrated = 0;
    let skipped = 0;

    for (const blob of blobs) {
      const record = await store.get(blob.key, { type: 'json' });
      if (!record) continue;

      if (needsMigration(record)) {
        const newRecord = migrateRecord(record);
        await store.setJSON(blob.key, newRecord);
        migrated++;
      } else {
        skipped++;
      }
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        message: `遷移完成：已更新 ${migrated} 筆，跳過 ${skipped} 筆（已是新格式）`,
        migrated,
        skipped
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
