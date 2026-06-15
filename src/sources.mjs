// 台灣公開資料來源：薄客戶端，呼叫各站既有 JSON API，資料留在來源站。
// 每個工具回傳都夾帶 source 與 link（署名 + 導流）。

const UA = 'taiwan-data-mcp/0.1 (+https://github.com/kwlin/taiwan-data-mcp)';

export async function fetchJson(url, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctrl.signal });
    const text = await r.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON (e.g. SSR HTML fallback) */ }
    return { ok: r.ok, status: r.status, body, raw: text };
  } finally {
    clearTimeout(t);
  }
}

// ── 防詐 fraud.tw ───────────────────────────────────────────────
export function normalizeDomain(input) {
  let s = String(input || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  return s;
}

export async function scamCheck(input) {
  const domain = normalizeDomain(input);
  if (!domain || !domain.includes('.')) return { error: '請提供有效網址或網域，例如 example.com' };
  const { ok, body } = await fetchJson(`https://fraud.tw/api/check?d=${encodeURIComponent(domain)}`);
  if (!ok || !body) return { error: `查詢失敗（fraud.tw）`, domain };
  return body; // 已自帶 source / detail
}

// ── 公司登記 inc.com.tw ─────────────────────────────────────────
export async function companySearch(name) {
  const q = String(name || '').trim();
  if (q.length < 2) return { error: '公司名稱至少 2 個字' };
  const { ok, body } = await fetchJson(`https://inc.com.tw/api/suggest?q=${encodeURIComponent(q)}`);
  if (!ok || !Array.isArray(body)) return { error: '查詢失敗（inc.com.tw）', query: q };
  const companies = body
    .filter((x) => x.t === 'co')
    .map((x) => ({ unified_business_no: x.id, name: x.n, representative: x.r || null, alias: x.a || null,
      profile_url: `https://inc.com.tw/c/${x.id}` }));
  return { query: q, count: companies.length, companies,
    source: '台灣公司登記網 inc.com.tw' };
}

export async function companyProfile(id) {
  const tin = String(id || '').replace(/\D/g, '');
  if (tin.length !== 8) return { error: '統一編號必須是 8 位數字' };
  const { ok, status, body } = await fetchJson(`https://inc.com.tw/api/company/${tin}`);
  if (status === 404) return { error: `查無此統一編號 ${tin}` };
  if (!ok || !body) return { error: '查詢失敗（inc.com.tw）', unified_business_no: tin };
  const { source: _drop, ...rest } = body;
  return { ...rest, profile_url: `https://inc.com.tw/c/${tin}`,
    source: '台灣公司登記網 inc.com.tw' };
}

// ── 實價登錄 housetw.com ───────────────────────────────────────
export async function realpriceSearch(q) {
  const query = String(q || '').trim();
  if (query.length < 2) return { error: '搜尋關鍵字至少 2 個字（地址 / 路段 / 行政區）' };
  const { ok, body } = await fetchJson(`https://housetw.com/api/search.json?q=${encodeURIComponent(query)}`);
  if (!ok || !body || !Array.isArray(body.items)) return { error: '查詢失敗（housetw.com）', query };
  return {
    query,
    items: body.items.map((it) => ({ ...it, link: it.href ? `https://housetw.com${it.href}` : undefined })),
    source: '內政部不動產交易實價登錄 · 實價雷達 housetw.com',
  };
}

export async function realpriceLocate(lat, lng) {
  const la = Number(lat), ln = Number(lng);
  if (!isFinite(la) || !isFinite(ln)) return { error: '請提供有效的 lat / lng 經緯度' };
  const { ok, body } = await fetchJson(`https://housetw.com/api/near.json?lat=${la}&lng=${ln}`);
  if (!ok || !body || body.error) return { error: '此座標查無對應行政區（housetw.com）', lat: la, lng: ln };
  return { lat: la, lng: ln, county: body.county, district: body.district,
    radar_available: !!body.radar,
    link: body.url ? `https://housetw.com${body.url}` : undefined,
    source: '內政部不動產交易實價登錄 · 實價雷達 housetw.com' };
}

export async function realpriceArea(county, district) {
  const c = String(county || '').trim();
  if (!c) return { error: '請提供縣市 county（可加行政區 district）' };
  const qs = `county=${encodeURIComponent(c)}` + (district ? `&district=${encodeURIComponent(String(district).trim())}` : '');
  const { ok, body, status } = await fetchJson(`https://housetw.com/api/area.json?${qs}`);
  // area.json 端點尚未部署時優雅降級為搜尋連結
  if (status === 404 || !body) {
    const fallback = await realpriceSearch(`${c}${district || ''}`);
    return { degraded: true, note: 'area.json 端點尚未上線，改回傳搜尋結果連結', ...fallback };
  }
  if (!ok) return { error: '查詢失敗（housetw.com）', county: c };
  return body;
}
