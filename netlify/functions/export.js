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

function buildCSV(rows) {
  const headers = ['#', '提交時間', 'Q1年齡', 'Q2職涯身份', 'Q3專業領域', 'Q4年資', 'Q5AI衝擊', 'Q6職涯心情', 'Q7擔憂', 'Q8已採取行動', 'Q9第二人生方向', 'Q10顧問興趣', 'Q11顧問障礙', 'Q12顧問方向', 'Q13每月時間', 'Q14希望協助', 'Q15學習形式', 'Q16定價', 'Q17報名決策', 'Q18對實踐營反應', 'Q19最吸引環節', 'Q20想法', 'Q21姓名', 'Q22Email'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.map(esc).join(',')];
  rows.forEach(r => lines.push([r.id, r.submitted_at, r.q1, r.q2, r.q3, r.q4, r.q5, r.q6, r.q7, r.q8, r.q9, r.q10, r.q11, r.q12, r.q13, r.q14, r.q15, r.q16, r.q17, r.q18, r.q19, r.q20, r.q21, r.q22].map(esc).join(',')));
  return '\uFEFF' + lines.join('\r\n');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const pw = event.headers['x-admin-password'] || (event.queryStringParameters || {}).pw;
  if (pw !== ADMIN_PW) {
    return { statusCode: 401, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '未授權' }) };
  }

  try {
    const rows = await getAllResponses();
    const csv = buildCSV(rows);
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': 'attachment;filename="fuplayer_survey.csv"'
      },
      body: csv
    };
  } catch (e) {
    return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
