const { getStore } = require('@netlify/blobs');

function getBlobStore() {
  const opts = { name: 'fuplayer-survey', consistency: 'strong' };
  if (process.env.BLOBS_SITE_ID) opts.siteID = process.env.BLOBS_SITE_ID;
  if (process.env.BLOBS_TOKEN) opts.token = process.env.BLOBS_TOKEN;
  return getStore(opts);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function htmlPage(title, emoji, heading, body, color) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Noto Sans TC',sans-serif;background:#f5f7f2;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border-radius:20px;padding:48px 40px;max-width:480px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.08)}
  .emoji{font-size:56px;margin-bottom:20px}
  h1{font-size:22px;font-weight:700;color:${color};margin-bottom:16px;line-height:1.4}
  p{font-size:15px;color:#555;line-height:1.8;margin-bottom:12px}
  .badge{display:inline-block;background:#fff8e6;border:1px solid #f5c842;border-radius:8px;padding:10px 20px;font-size:13px;color:#8a6800;margin:16px 0}
  .note{font-size:13px;color:#999;margin-top:20px}
</style>
</head>
<body>
<div class="card">
  <div class="emoji">${emoji}</div>
  <h1>${heading}</h1>
  ${body}
</div>
</body>
</html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const id = (event.queryStringParameters || {}).id;

  if (!id) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'text/html;charset=utf-8' },
      body: htmlPage('錯誤', '❌', '連結無效', '<p>此預約連結缺少必要的識別碼，請透過問卷填寫完成頁面或信件中的按鈕重新嘗試。</p>', '#c0392b'),
    };
  }

  try {
    const store = getBlobStore();
    const record = await store.get(`response:${id}`, { type: 'json' });

    if (!record) {
      return {
        statusCode: 404,
        headers: { ...CORS, 'Content-Type': 'text/html;charset=utf-8' },
        body: htmlPage('找不到紀錄', '🔍', '找不到您的問卷紀錄', '<p>可能連結已過期或資料不存在，請聯絡我們取得協助。</p>', '#7f8c8d'),
      };
    }

    if (record.reserved) {
      // 已預約 → 強化心理
      const name = record.q21 ? `${record.q21}` : '您';
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'text/html;charset=utf-8' },
        body: htmlPage(
          '預約確認',
          '🎯',
          `${name}，您已在預約名單中！`,
          `<p>我們已收到您的超早鳥預約，正式開課通知將優先發送給您。</p>
           <div class="badge">🔥 超早鳥優惠 NT$16,800｜限額 20 位</div>
           <p>課程預計 5 月下旬開課，報名連結公布時您將第一個收到通知。</p>
           <p class="note">無需重複操作，您的席位已保留。</p>`,
          '#1a7a4a'
        ),
      };
    }

    // 尚未預約 → 更新紀錄
    record.reserved = true;
    record.reserved_at = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    await store.setJSON(`response:${id}`, record);

    const name = record.q21 ? `${record.q21}` : '您';
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'text/html;charset=utf-8' },
      body: htmlPage(
        '預約成功',
        '🎉',
        `${name}，超早鳥預約成功！`,
        `<p>我們已將您加入優先通知名單，正式開課時您將第一個收到報名連結與超早鳥專屬優惠。</p>
         <div class="badge">🔥 超早鳥優惠 NT$16,800｜限額 20 位</div>
         <p>課程預計 5 月下旬開課，名額有限，屆時請盡快完成報名。</p>
         <p class="note">此頁面可安全關閉，您的預約已記錄完成。</p>`,
        '#1a7a4a'
      ),
    };
  } catch (e) {
    console.error('Reserve error:', e);
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'text/html;charset=utf-8' },
      body: htmlPage('伺服器錯誤', '⚠️', '發生錯誤', `<p>請稍後再試。（${e.message}）</p>`, '#c0392b'),
    };
  }
};
