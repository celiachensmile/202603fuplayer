const { getStore } = require('@netlify/blobs');

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 鎖定 30 分鐘

function getRateLimitStore() {
  const opts = { name: 'fuplayer-ratelimit', consistency: 'strong' };
  if (process.env.NETLIFY_SITE_ID) opts.siteID = process.env.NETLIFY_SITE_ID;
  if (process.env.NETLIFY_TOKEN) opts.token = process.env.NETLIFY_TOKEN;
  return getStore(opts);
}

function getClientIP(event) {
  const xff = event.headers['x-forwarded-for'];
  const raw = xff ? xff.split(',')[0].trim() : (event.headers['client-ip'] || 'unknown');
  // 只保留合法 IP 字元，防止 key injection
  return raw.replace(/[^a-zA-Z0-9.:_-]/g, '').slice(0, 64);
}

// 檢查是否被鎖定，回傳 { blocked: true, message } 或 { blocked: false }
async function checkRateLimit(event) {
  const ip = getClientIP(event);
  const store = getRateLimitStore();
  try {
    const data = await store.get(`rl:${ip}`, { type: 'json' });
    if (data && data.lockedUntil && Date.now() < data.lockedUntil) {
      const remaining = Math.ceil((data.lockedUntil - Date.now()) / 60000);
      return { blocked: true, message: `登入嘗試次數過多，請 ${remaining} 分鐘後再試。` };
    }
  } catch (_) { /* 無記錄，放行 */ }
  return { blocked: false };
}

// 記錄一次失敗，滿 5 次後鎖定 30 分鐘
async function recordFailedAttempt(event) {
  const ip = getClientIP(event);
  const store = getRateLimitStore();
  const key = `rl:${ip}`;
  try {
    const existing = await store.get(key, { type: 'json' }).catch(() => null);
    const data = existing || { count: 0 };
    data.count = (data.count || 0) + 1;
    if (data.count >= MAX_ATTEMPTS) {
      data.lockedUntil = Date.now() + LOCK_DURATION_MS;
    }
    await store.setJSON(key, data);
    console.log(`Rate limit: IP ${ip} 失敗第 ${data.count} 次`);
  } catch (e) {
    console.error('Rate limit write error:', e.message);
  }
}

// 登入成功後清除記錄
async function clearRateLimit(event) {
  const ip = getClientIP(event);
  const store = getRateLimitStore();
  try {
    await store.delete(`rl:${ip}`);
  } catch (_) { /* 忽略 */ }
}

module.exports = { checkRateLimit, recordFailedAttempt, clearRateLimit };
