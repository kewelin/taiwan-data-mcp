// 台灣公開資料來源：薄客戶端，呼叫各站既有 JSON API，資料留在來源站。
// 每個工具回傳都夾帶 source 與 link（署名 + 導流）。

const UA = 'taiwan-data-mcp (+https://github.com/kewelin/taiwan-data-mcp)';

export async function fetchJson(url, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctrl.signal });
    const text = await r.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON (e.g. SSR HTML fallback) */ }
    return { ok: r.ok, status: r.status, body, raw: text };
  } catch (e) {
    // 網路 / TLS / 逾時錯誤：回結構化失敗，讓工具優雅降級而非拋例外
    return { ok: false, status: 0, body: null, raw: '', netError: e?.cause?.code || e?.name || String(e) };
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
  const { ok, status, body } = await fetchJson(`https://inc.com.tw/api/company/${tin}`, { timeout: 20000 });
  if (status === 404) return { error: `查無此統一編號 ${tin}` };
  if (!ok || !body) return { error: '查詢失敗（inc.com.tw）', unified_business_no: tin };
  const { source: _drop, ...rest } = body;
  return { ...rest, profile_url: `https://inc.com.tw/c/${tin}`,
    source: '台灣公司登記網 inc.com.tw' };
}

export async function personCompanies(name) {
  const q = String(name || '').trim();
  if (q.length < 2) return { error: '人名至少 2 個字' };
  const { ok, body } = await fetchJson(`https://inc.com.tw/api/suggest?q=${encodeURIComponent(q)}`);
  if (!ok || !Array.isArray(body)) return { error: '查詢失敗（inc.com.tw）', query: q };
  const people = body
    .filter((x) => x.t === 'p')
    .map((x) => ({ person: x.n, company_count: x.c, example_companies: x.eg || [],
      profile_url: `https://inc.com.tw/p/${encodeURIComponent(x.n)}` }));
  if (!people.length) return { query: q, count: 0, note: '查無此人擔任負責人／董監事的公司（或人名不完整）', people: [],
    source: '台灣公司登記網 inc.com.tw' };
  return { query: q, count: people.length, people,
    note: '以姓名比對，可能含同名同姓，僅供參考',
    source: '台灣公司登記網 inc.com.tw' };
}

// 風險查核：用統編或公司名（簡稱會自動解析成正主，如「台積電」→台積電本尊）。
// 走 inc.com.tw/api/card：比 /api/company flags 更完整（含解散/金管裁罰/司法/國際制裁），上市櫃並附即時股價。
export async function companyRisk(idOrName) {
  const raw = String(idOrName || '').trim();
  if (!raw) return { error: '請提供統一編號或公司名稱' };
  const tin = raw.replace(/\D/g, '');
  const url = /^\d{8}$/.test(tin)
    ? `https://inc.com.tw/api/card/${tin}`
    : `https://inc.com.tw/api/card?name=${encodeURIComponent(raw)}`;
  const { ok, status, body } = await fetchJson(url, { timeout: 20000 });
  if (status === 404) return { error: `查無公司：${raw}` };
  if (!ok || !body || body.error) return { error: '查詢失敗（inc.com.tw）', query: raw };
  const f = body.flags || {};
  const redFlags = [];
  if (f.dissolved) redFlags.push(`登記狀態：${body.status}`);
  if (f.reject) redFlags.push('政府採購拒絕往來');
  if (f.sanction) redFlags.push(`命中國際制裁名單 ${f.sanction} 筆（OFAC/UN 等）`);
  if (f.fsc) redFlags.push(`金管會重大裁罰 ${f.fsc} 件`);
  if (f.judicial) redFlags.push(`司法案件 ${f.judicial} 筆（以名稱比對，含一般民事/被列名，未必為違法，僅供參考）`);
  if (f.labor) redFlags.push(`勞動法令裁罰 ${f.labor} 筆`);
  if (f.env) redFlags.push(`環保裁罰 ${f.env} 筆`);
  // 重大紅旗（解散／拒絕往來／國際制裁／金管會重大裁罰）→ high。
  // 司法案件以名稱比對且噪訊高（大公司常被列為當事人），與勞動／環保同列 medium，不單獨拉到 high。
  const major = f.dissolved || f.reject || f.sanction || f.fsc;
  const level = major ? 'high' : (f.judicial || f.labor || f.env) ? 'medium' : 'low';
  return {
    unified_business_no: body.id,
    name: body.name,
    representative: body.rep || null,
    status: body.status,
    capital: body.capital ?? null,
    listing: body.listed || null,
    stock_price: body.price || null,
    risk_level: level,
    red_flags: redFlags,
    detail: {
      dissolved: !!f.dissolved,
      government_debarment: f.reject || 0,
      international_sanction: f.sanction || 0,
      fsc_major_penalty: f.fsc || 0,
      judicial_cases: f.judicial || 0,
      labor_penalties: f.labor || 0,
      environmental_penalties: f.env || 0,
    },
    note: '裁罰／名單以公司名稱比對，可能含同名同稱；僅供參考，以政府原始公告為準',
    profile_url: body.url || `https://inc.com.tw/c/${body.id}`,
    source: '台灣公司登記網 inc.com.tw',
  };
}

// 公司關係圖譜（天眼查式）：法人股東／轉投資子公司／最終母公司／集團規模／共同董監事人脈。
export async function companyRelations(id) {
  const tin = String(id || '').replace(/\D/g, '');
  if (tin.length !== 8) return { error: '統一編號必須是 8 位數字' };
  const { ok, status, body } = await fetchJson(`https://inc.com.tw/api/relations/${tin}`, { timeout: 20000 });
  if (status === 404) return { error: `查無此統一編號 ${tin}` };
  if (!ok || !body) return { error: '查詢失敗（inc.com.tw）', unified_business_no: tin };
  return body; // 已自帶 source / profile_url / note
}

// 公司名稱預查／撞名查重（創業命名、盡調辨識用）。
export async function companyNameCheck(name) {
  const q = String(name || '').trim();
  if (q.length < 2) return { error: '公司名稱至少 2 個字' };
  const { ok, body } = await fetchJson(`https://inc.com.tw/api/namecheck?name=${encodeURIComponent(q)}`);
  if (!ok || !body) return { error: '查詢失敗（inc.com.tw）', query: q };
  return { query: q, ...body, note: '名稱比對僅供命名參考；正式設立以經濟部名稱預查核准為準', source: '台灣公司登記網 inc.com.tw' };
}

// 官方即時查證：經濟部商工登記公示 OpenAPI 的「目前」登記狀態（比快取更即時）。
export async function companyVerify(id) {
  const tin = String(id || '').replace(/\D/g, '');
  if (tin.length !== 8) return { error: '統一編號必須是 8 位數字' };
  const { ok, body } = await fetchJson(`https://inc.com.tw/api/verify?id=${tin}`, { timeout: 15000 });
  if (!ok || !body) return { error: '查詢失敗（inc.com.tw）', unified_business_no: tin };
  if (!body.ok) return { unified_business_no: tin, verified: false, note: body.note || '官方查證暫時無回應', source: '經濟部商工登記公示資料' };
  return { unified_business_no: tin, verified: true, name: body.name, status: body.status, capital: body.capital,
    paid_in_capital: body.paid, representative: body.responsible, location: body.location, register_organization: body.regOrg,
    source: body.src || '經濟部商工登記公示資料' };
}

// 統一編號檢查碼驗證（純演算法，資料清理／表單檢核用）。
export async function validateTaxId(id) {
  const tin = String(id || '').replace(/\D/g, '');
  if (tin.length !== 8) return { input: String(id || ''), valid: false, reason: '統一編號必須是 8 位數字' };
  const { ok, body } = await fetchJson(`https://inc.com.tw/api/taxid?id=${tin}`, { timeout: 10000 });
  if (!ok || !body) return { input: tin, valid: false, reason: '查詢失敗（inc.com.tw）' };
  return body;
}

// 關係路徑：兩家公司／兩人之間透過共同負責人／董監事串接的最短關係鏈（天眼查式盡調）。
export async function findConnection(a, b) {
  const qa = String(a || '').trim(), qb = String(b || '').trim();
  if (!qa || !qb) return { error: '請提供 a 與 b（公司名／統編／人名）' };
  const { ok, body } = await fetchJson(`https://inc.com.tw/api/path?a=${encodeURIComponent(qa)}&b=${encodeURIComponent(qb)}`, { timeout: 25000 });
  if (!ok || !body) return { error: '查詢失敗（inc.com.tw）', a: qa, b: qb };
  return body; // 已自帶 from/to/path/note/source
}

// 批次盡職調查：多個公司一次回風險卡（最多 50）。徵信／法遵／供應商清查用。
export async function bulkDueDiligence(ids) {
  const list = (Array.isArray(ids) ? ids : String(ids || '').split(/[\s,，、;]+/)).map((s) => String(s || '').trim()).filter(Boolean);
  if (!list.length) return { error: '請提供 ids（公司統編或名稱陣列）' };
  const { ok, body } = await fetchJson(`https://inc.com.tw/api/bulk?ids=${encodeURIComponent(list.slice(0, 50).join(','))}`, { timeout: 30000 });
  if (!ok || !body) return { error: '查詢失敗（inc.com.tw）' };
  return { ...body, source: '台灣公司登記網 inc.com.tw' };
}

// 並排比較 2–5 家公司：穩定度／標案／裁罰。
export async function compareCompanies(ids) {
  const list = (Array.isArray(ids) ? ids : String(ids || '').split(/[\s,，、;]+/)).map((s) => String(s || '').trim()).filter(Boolean);
  if (list.length < 1) return { error: '請提供 ids（2–5 個公司統編或名稱）' };
  const { ok, body } = await fetchJson(`https://inc.com.tw/api/compare?ids=${encodeURIComponent(list.slice(0, 5).join(','))}`, { timeout: 30000 });
  if (!ok || !body) return { error: '查詢失敗（inc.com.tw）' };
  return { ...body, source: '台灣公司登記網 inc.com.tw' };
}

// ── 農產批發行情 MOA（農業部農產品交易行情）──────────────────────
function _rocToAd(s) {
  const m = String(s || '').match(/^(\d{2,3})\.(\d{2})\.(\d{2})$/);
  return m ? `${Number(m[1]) + 1911}-${m[2]}-${m[3]}` : s || null;
}

// 常見俗名 → 農業部資料作物名（資料用正式名，民眾用俗名）
const CROP_ALIAS = { 高麗菜: '甘藍', 蕃茄: '番茄', 西紅柿: '番茄', 小蕃茄: '小番茄', 聖女番茄: '小番茄' };

export async function farmPrice(crop, market) {
  let c = String(crop || '').trim();
  if (!c) return { error: '請提供農產品名稱，例如「高麗菜」「香蕉」「青蔥」' };
  if (CROP_ALIAS[c]) c = CROP_ALIAS[c];
  const mkt = String(market || '台北一').trim();
  const { ok, body } = await fetchJson(
    `https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx?Market=${encodeURIComponent(mkt)}`,
    { timeout: 20000 }
  );
  if (!ok || !Array.isArray(body)) return { error: '查詢失敗（農業部農產行情）', crop: c, market: mkt };
  const matched = body
    .filter((r) => String(r['作物名稱'] || '').includes(c))
    .map((r) => ({
      crop: r['作物名稱'],
      date: _rocToAd(r['交易日期']),
      market: r['市場名稱'],
      avg_price_ntd_kg: r['平均價'],
      high_ntd_kg: r['上價'],
      low_ntd_kg: r['下價'],
      volume_kg: r['交易量'],
    }));
  if (!matched.length) {
    return { crop: c, market: mkt, count: 0,
      note: `${mkt}市場最新交易日查無「${c}」，可換關鍵字或市場（如 台北一／台北二／台中／三重／高雄）`,
      source: '農業部農產品批發市場交易行情 data.moa.gov.tw' };
  }
  return {
    crop: c,
    market: mkt,
    count: matched.length,
    items: matched.slice(0, 30),
    note: '價格單位：元/公斤；交易量：公斤；為該市場最新交易日資料',
    source: '農業部農產品批發市場交易行情 data.moa.gov.tw',
  };
}

// ── 政府標案 PCC（g0v 政府採購開放資料）─────────────────────────
const PCC_BASE = 'https://pcc-api.openfun.app';

function _fmtTenderDate(d) {
  const s = String(d || '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s || null;
}
function _mapTender(r) {
  const b = r.brief || {};
  const names = b.companies?.names || [];
  return {
    date: _fmtTenderDate(r.date),
    title: b.title || null,
    type: b.type || null,
    agency: r.unit_name || null,
    companies: names,
    tender_url: r.url ? `https://pcc.g0v.ronny.tw${r.url}` : null,
  };
}

export async function tenderByCompany(name) {
  const q = String(name || '').trim();
  if (q.length < 2) return { error: '公司名稱至少 2 個字' };
  const { ok, body } = await fetchJson(`${PCC_BASE}/api/searchbycompanyname?query=${encodeURIComponent(q)}`, { timeout: 20000 });
  if (!ok || !body || !Array.isArray(body.records)) return { error: '查詢失敗（政府採購開放資料）', query: q };
  return {
    query: q,
    total: body.total_records ?? body.records.length,
    showing: Math.min(body.records.length, 25),
    tenders: body.records.slice(0, 25).map(_mapTender),
    note: '含該廠商參與投標或得標的採購案；以廠商名比對',
    source: '政府電子採購網（公共工程委員會）開放資料 · 透過 g0v PCC API',
  };
}

export async function tenderSearch(keyword, page = 1) {
  const q = String(keyword || '').trim();
  if (q.length < 2) return { error: '搜尋關鍵字至少 2 個字' };
  const p = Math.max(1, Number(page) || 1);
  const { ok, body } = await fetchJson(`${PCC_BASE}/api/searchbytitle?query=${encodeURIComponent(q)}&page=${p}`, { timeout: 20000 });
  if (!ok || !body || !Array.isArray(body.records)) return { error: '查詢失敗（政府採購開放資料）', query: q };
  return {
    query: q,
    page: p,
    total: body.total_records ?? null,
    total_pages: body.total_pages ?? null,
    showing: Math.min(body.records.length, 25),
    tenders: body.records.slice(0, 25).map(_mapTender),
    source: '政府電子採購網（公共工程委員會）開放資料 · 透過 g0v PCC API',
  };
}

// ── 藥品／健康 health-hub ───────────────────────────────────────
const HEALTH_BASE = 'https://health-hub-epx.pages.dev';

export async function drugSearch(name) {
  const q = String(name || '').trim();
  if (q.length < 1) return { error: '請提供藥品名稱關鍵字' };
  const { ok, body } = await fetchJson(`${HEALTH_BASE}/api/suggest?q=${encodeURIComponent(q)}`);
  if (!ok || !Array.isArray(body)) return { error: '查詢失敗（health-hub）', query: q };
  const drugs = body.map((d) => {
    let lic = '';
    try { lic = decodeURIComponent((d.href || '').replace(/^\/drug\//, '')); } catch { lic = (d.href || '').replace(/^\/drug\//, ''); }
    return { name: d.name, license_no: lic, detail: d.href ? `${HEALTH_BASE}${d.href}` : undefined };
  });
  return { query: q, count: drugs.length, drugs,
    source: '衛福部食藥署藥品許可證 · 健康查詢 health-hub' };
}

export async function drugInfo(licenseNo) {
  const lic = String(licenseNo || '').trim();
  if (!lic) return { error: '請提供藥品許可證字號（license_no），可先用 taiwan_drug_search 取得' };
  // 優先用完整端點（含適應症/健保價/回收/短缺）；未部署時自動退回成分端點
  const full = await fetchJson(`${HEALTH_BASE}/api/drug.json?lic=${encodeURIComponent(lic)}`);
  if (full.ok && full.body && full.body.name) return full.body;
  if (full.status === 404 && full.body && full.body.error) return full.body; // 確實查無此藥

  const { ok, body } = await fetchJson(`${HEALTH_BASE}/api/drug-ingredients?lic=${encodeURIComponent(lic)}`);
  if (!ok || !body) return { error: '查詢失敗（health-hub）', license_no: lic };
  if (!body.name) return { error: `查無此許可證字號 ${lic}`, license_no: lic };
  return {
    license_no: lic,
    name: body.name,
    active_ingredients: body.ingredients || [],
    detail: `${HEALTH_BASE}/drug/${encodeURIComponent(lic)}`,
    note: '藥品資訊僅供參考，用藥請依醫師、藥師指示',
    source: '衛福部食藥署藥品許可證 · 健康查詢 health-hub',
  };
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

export async function realpriceEstimate(county, district, { type, age, ping } = {}) {
  const c = String(county || '').trim(), d = String(district || '').trim();
  if (!c || !d) return { error: '請提供縣市 county 與行政區 district' };
  const qp = new URLSearchParams({ county: c, district: d });
  if (type) qp.set('type', String(type).trim());
  if (age != null && age !== '') qp.set('age', String(age));
  if (ping != null && ping !== '') qp.set('ping', String(ping));
  const { ok, body, status } = await fetchJson(`https://housetw.com/api/estimate.json?${qp}`);
  if (status === 404 || !body) return { error: '估價端點暫不可用（housetw.com）', county: c, district: d };
  if (!ok) return { error: '查詢失敗（housetw.com）', county: c, district: d };
  return body;
}

export async function realpriceRoad(county, district, road) {
  const c = String(county || '').trim(), d = String(district || '').trim(), r = String(road || '').trim();
  if (!c || !d || !r) return { error: '請提供縣市 county、行政區 district、路段 road' };
  const qp = new URLSearchParams({ county: c, district: d, road: r });
  const { ok, body, status } = await fetchJson(`https://housetw.com/api/road.json?${qp}`);
  if (status === 404 || !body) return { error: '路段端點暫不可用（housetw.com）', road: r };
  if (!ok) return { error: '查詢失敗（housetw.com）', road: r };
  return body;
}

export async function realpriceRent(county, district) {
  const c = String(county || '').trim();
  if (!c) return { error: '請提供縣市 county（可加行政區 district）' };
  const qp = new URLSearchParams({ county: c });
  if (district) qp.set('district', String(district).trim());
  const { ok, body, status } = await fetchJson(`https://housetw.com/api/rent.json?${qp}`);
  if (status === 404 || status === 302 || !body) return { error: '租金端點暫不可用（housetw.com，待部署）', county: c };
  if (!ok) return { error: '查詢失敗（housetw.com）', county: c };
  return body;
}
