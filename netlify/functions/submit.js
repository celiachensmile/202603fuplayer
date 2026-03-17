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

// ── 個人化內容生成 ────────────────────────────────────────────
function buildPersonalizedContent(d) {
  const q5 = d.q5 || '';   // AI 衝擊感受（數字字串 1-5）
  const q6 = d.q6 || '';   // 職涯心情
  const q9raw = d.q9 || '';
  const q9 = Array.isArray(q9raw) ? q9raw : (q9raw ? String(q9raw).split('|').map(s => s.trim()).filter(Boolean) : []);
  const q10 = parseInt(d.q10 || '0', 10); // 顧問興趣 0-5

  // ── 心情介紹段落 ──
  const moodMap = {
    '充滿鬥志，準備好迎接轉變': '您目前充滿鬥志，正準備好迎接職涯的新轉變——這種主動的心態，正是成功轉型最關鍵的起點。',
    '有點焦慮，但也感到興奮': '您感到既興奮又有些焦慮，這其實是大多數轉型期最真實的感受。焦慮代表您認真看待這件事，興奮則說明您的內心已嗅到機會。',
    '觀望中，還沒想清楚': '您目前仍在觀望與思考中，這份謹慎是智慧的展現。先看清楚方向，再決定步伐，本就比倉促行動來得穩健。',
    '有點迷惘，不知從哪裡開始': '感到迷惘其實是轉型前最常見的狀態——您並不孤單。迷惘往往意味著您已意識到「現況需要改變」，只是還缺少一條清晰的路徑。',
    '疲憊，需要休息和重新充電': '您目前感到疲憊，需要先充電。這份覺察很重要——只有先照顧好自己，才有能量去探索下一個精彩的職涯階段。',
  };
  const moodLine = moodMap[q6] || '謝謝您誠實分享目前的職涯狀態，這份自我覺察正是展開轉型的第一步。';

  // ── 方向建議 ──
  const directionAdvice = q9.length > 0
    ? `根據您的選擇，您對「${q9.join('、')}」最感興趣。這幾個方向在 AI 時代仍具備高度人際信任與知識槓桿的優勢，尤其適合擁有豐富職涯經驗的專業人士作為第二人生的主軸。`
    : '您填寫的第二人生方向顯示出多元的可能性，這是好事——代表您尚未被單一路徑所框限，保有更大的彈性空間去探索最適合自己的職涯組合。';

  // ── 顧問興趣建議 ──
  let interestAdvice = '';
  if (q10 >= 4) {
    interestAdvice = '您對「知識顧問」這條路的興趣相當高。以您累積的專業經驗為基礎，結合系統性的顧問方法，很有機會建立一個既有收入又有意義感的新職涯模式。';
  } else if (q10 >= 2) {
    interestAdvice = '您對顧問路線有一定興趣，但仍有些猶豫。這很正常——許多人在真正了解顧問的具體操作方式之後，才能判斷是否適合自己。';
  } else {
    interestAdvice = '您目前對顧問路線的興趣還在起步階段，或者您可能更傾向其他的第二人生方向。無論如何，了解更多選項對做出好的職涯決策都有幫助。';
  }

  // ── AI 衝擊補充 ──
  const aiLevel = parseInt(q5, 10);
  let aiNote = '';
  if (aiLevel >= 4) {
    aiNote = '您強烈感受到 AI 帶來的職涯衝擊，這份危機感反而是一種優勢——它驅動您提早佈局，而不是等到衝擊來臨時才被動應對。';
  } else if (aiLevel >= 2) {
    aiNote = 'AI 的影響已在您的工作中逐漸顯現。現在正是重新定位個人價值、強化「人類不可替代性」的最佳時機。';
  } else {
    aiNote = '您目前感受到的 AI 衝擊相對有限，但這個趨勢在未來幾年將持續加速。提早思考如何將 AI 轉為個人優勢，將讓您比同儕更具競爭力。';
  }

  return {
    mood_line: moodLine,
    direction_advice: directionAdvice,
    interest_advice: interestAdvice,
    ai_note: aiNote,
    career_directions: q9.join('、') || '尚未填寫',
    interest_level: String(q10),
    survey_id: '', // will be filled after ID is generated
  };
}

// ── ConvertKit 訂閱 ───────────────────────────────────────────
async function subscribeToConvertKit(record, personalContent) {
  const apiKey = process.env.CONVERTKIT_API_KEY;
  const formId = process.env.CONVERTKIT_FORM_ID;
  if (!apiKey || !formId) return; // 未設定則跳過

  const payload = {
    api_key: apiKey,
    email: record.q22,
    first_name: record.q21 || '',
    fields: {
      survey_id: record.id,
      mood_line: personalContent.mood_line,
      direction_advice: personalContent.direction_advice,
      interest_advice: personalContent.interest_advice,
      ai_note: personalContent.ai_note,
      career_directions: personalContent.career_directions,
      interest_level: personalContent.interest_level,
    },
  };

  console.log('ConvertKit: calling form', formId, 'for', record.q22);
  const ckRes = await fetch(`https://api.convertkit.com/v3/forms/${formId}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const ckBody = await ckRes.text();
  console.log('ConvertKit response:', ckRes.status, ckBody);
  if (!ckRes.ok) {
    throw new Error(`ConvertKit API error ${ckRes.status}: ${ckBody}`);
  }
}

// ── Handler ───────────────────────────────────────────────────
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
      q18: d.q18||null, q19: fmt(d.q19), q20: d.q20||null, q21: d.q21||null, q22: d.q22||null,
      reserved: false,
    };

    await store.setJSON(`response:${id}`, record);

    // ConvertKit：必須 await，Netlify Function 回傳後 Lambda 會立即終止
    if (record.q22) {
      const personalContent = buildPersonalizedContent(d);
      personalContent.survey_id = id;
      try {
        await subscribeToConvertKit(record, personalContent);
      } catch (err) {
        console.error('ConvertKit error:', err.message);
        // 不影響問卷送出結果
      }
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, id }),
    };
  } catch (e) {
    console.error('Submit error:', e);
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '伺服器錯誤: ' + e.message }),
    };
  }
};
