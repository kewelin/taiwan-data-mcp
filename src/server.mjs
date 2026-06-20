#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  scamCheck, companySearch, companyProfile, personCompanies, companyRisk,
  companyRelations, companyNameCheck, companyVerify, validateTaxId, findConnection, bulkDueDiligence, compareCompanies, companyRankings,
  realpriceSearch, realpriceLocate, realpriceArea, realpriceEstimate, realpriceRoad,
  drugSearch, drugInfo,
  tenderByCompany, tenderSearch,
  farmPrice,
} from './sources.mjs';

const TOOLS = [
  {
    name: 'taiwan_scam_check',
    description:
      '查詢某網址 / 網域是否被內政部警政署 165 反詐騙通報為詐騙或涉詐網站。輸入網址或網域（如 example.com 或完整 URL）。回傳風險等級、通報情形與來源連結。資料來源：fraud.tw（165 開放資料）。',
    inputSchema: {
      type: 'object',
      properties: { domain: { type: 'string', description: '要查詢的網址或網域，例如 example.com、https://www.example.com' } },
      required: ['domain'],
    },
    run: (a) => scamCheck(a.domain),
  },
  {
    name: 'taiwan_company_search',
    description:
      '用公司名稱（或關鍵字）搜尋台灣公司，回傳符合的公司清單與其統一編號、負責人。要拿到完整資料請接著用 taiwan_company_profile 查統編。資料來源：inc.com.tw（經濟部公司登記）。',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: '公司名稱或關鍵字，例如「台積電」「鴻海精密」' } },
      required: ['name'],
    },
    run: (a) => companySearch(a.name),
  },
  {
    name: 'taiwan_company_profile',
    description:
      '用 8 位統一編號查台灣公司完整登記資料：名稱、負責人、資本額、實收資本、設立日期、登記地址、營業項目、狀態、上市櫃與進出口資格等。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: { unified_business_no: { type: 'string', description: '8 位統一編號，例如 22099131' } },
      required: ['unified_business_no'],
    },
    run: (a) => companyProfile(a.unified_business_no),
  },
  {
    name: 'taiwan_person_companies',
    description:
      '用人名查他擔任「負責人／董監事」的台灣公司，回傳關聯公司數與範例公司（公司關係／查老闆人脈用）。以姓名比對，可能含同名同姓。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: '人名，例如「郭台銘」' } },
      required: ['name'],
    },
    run: (a) => personCompanies(a.name),
  },
  {
    name: 'taiwan_company_risk',
    description:
      '公司風險查核（盡職調查紅旗）：用 8 位統編或公司名稱（簡稱如「台積電」自動解析成正主）查該公司有無解散、政府採購拒絕往來、國際制裁名單（OFAC/UN）、金管會重大裁罰、司法案件、勞動法令裁罰、環保裁罰，回傳風險等級、紅旗清單與負責人，上市櫃並附即時股價。資料來源：inc.com.tw（聚合政府公開資料）。',
    inputSchema: {
      type: 'object',
      properties: {
        unified_business_no: { type: 'string', description: '8 位統一編號（與 name 二擇一），例如 22099131' },
        name: { type: 'string', description: '公司名稱或簡稱（與統編二擇一），例如「台積電」「鴻海」' },
      },
    },
    run: (a) => companyRisk(a.unified_business_no || a.name),
  },
  {
    name: 'taiwan_company_relations',
    description:
      '公司關係圖譜（盡職調查／天眼查式）：用 8 位統編查該公司的法人股東（誰持有它）、轉投資子公司（它持有誰）、推估最終母公司、整個集團規模，以及共同董監事連到的其他公司（人脈）。查母子公司、集團版圖、關係人用。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: { unified_business_no: { type: 'string', description: '8 位統一編號，例如 04541302（鴻海）' } },
      required: ['unified_business_no'],
    },
    run: (a) => companyRelations(a.unified_business_no),
  },
  {
    name: 'taiwan_company_name_check',
    description:
      '公司名稱預查／撞名查重：給一個想取的公司名稱，回傳是否已有相同或近似的既有公司（含統編）。創業命名或盡調辨識用。回傳 core（特取名稱）、exact（完全相同）、similar（近似）。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: '想查的公司名稱，例如「台積電」「方圓科技」' } },
      required: ['name'],
    },
    run: (a) => companyNameCheck(a.name),
  },
  {
    name: 'taiwan_company_verify',
    description:
      '用 8 位統編向經濟部商工登記公示 OpenAPI 取「即時」官方登記狀態（名稱／狀態／資本／實收／負責人／所在地／登記機關）。比一般資料庫更即時，適合確認某公司目前是否仍存續、是否已解散撤銷。資料來源：經濟部商工登記公示資料。',
    inputSchema: {
      type: 'object',
      properties: { unified_business_no: { type: 'string', description: '8 位統一編號，例如 22099131' } },
      required: ['unified_business_no'],
    },
    run: (a) => companyVerify(a.unified_business_no),
  },
  {
    name: 'taiwan_validate_tax_id',
    description:
      '驗證台灣統一編號（8 碼）檢查碼是否正確（財政部統編邏輯，純演算法、不查資料庫）。資料清理、表單驗證、判斷一組號碼是否為有效統編格式用。回傳 valid 與說明。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: { unified_business_no: { type: 'string', description: '8 位統一編號，例如 22099131' } },
      required: ['unified_business_no'],
    },
    run: (a) => validateTaxId(a.unified_business_no),
  },
  {
    name: 'taiwan_find_connection',
    description:
      '查兩家公司／兩個人之間的最短關係鏈（天眼查式盡職調查）：透過共同負責人／董監事一層層串接，回傳中間的人與公司節點與相隔層數。用於「這兩家公司／這兩個人有沒有關係、怎麼牽上線」。a、b 可填公司名、8 位統編或人名。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'string', description: '起點：公司名／統編／人名，例如「鴻海精密工業」' },
        b: { type: 'string', description: '終點：公司名／統編／人名，例如「三創數位」' },
      },
      required: ['a', 'b'],
    },
    run: (a) => findConnection(a.a, a.b),
  },
  {
    name: 'taiwan_bulk_due_diligence',
    description:
      '批次盡職調查：一次傳多個台灣公司（統編或公司名，最多 50 個），各回一張風險卡（登記狀態／資本／負責人／上市櫃股價／拒往／金管／勞動／環境／司法／國際制裁旗標）。徵信、法遵、供應商清單批次查核用。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' }, description: '公司統編或名稱陣列，最多 50 個' } },
      required: ['ids'],
    },
    run: (a) => bulkDueDiligence(a.ids),
  },
  {
    name: 'taiwan_compare_companies',
    description:
      '並排比較 2–5 家台灣公司：回傳各家的負責人、資本額、成立年數、登記狀態、上市櫃、企業穩定度分數、政府標案得標數、拒絕往來／勞動／金管裁罰筆數，方便挑供應商或做對手分析。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' }, description: '2–5 個公司統編或名稱' } },
      required: ['ids'],
    },
    run: (a) => compareCompanies(a.ids),
  },
  {
    name: 'taiwan_company_rankings',
    description:
      '台灣公司排行：依登記資本額（預設）或成立新舊，列出最大／最新／最老的公司，可選行業關鍵字（子字串比對，如「半導體」「銀行」「餐飲」）與縣市（如「臺北市」）篩選。回答「某產業／某縣市資本額最大的公司是哪些」用。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: {
        by: { type: 'string', enum: ['capital', 'newest', 'oldest'], description: 'capital 資本額最大（預設）／newest 最新成立／oldest 最老字號' },
        industry: { type: 'string', description: '行業關鍵字（可選，子字串），例如「半導體」「銀行」' },
        county: { type: 'string', description: '縣市（可選），例如「臺北市」（用「臺」非「台」）' },
        limit: { type: 'number', description: '回傳幾筆（1-50，預設 20）' },
      },
    },
    run: (a) => companyRankings({ by: a.by, industry: a.industry, county: a.county, limit: a.limit }),
  },
  {
    name: 'taiwan_realprice_search',
    description:
      '搜尋台灣不動產實價登錄的地址 / 路段 / 行政區，回傳符合項目與成交筆數、連結。用來定位某地址或某區，再看其行情。資料來源：housetw.com（內政部實價登錄）。',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: '地址、路段或行政區關鍵字，例如「信義區」「忠孝東路」' } },
      required: ['query'],
    },
    run: (a) => realpriceSearch(a.query),
  },
  {
    name: 'taiwan_realprice_locate',
    description:
      '用經緯度 (lat,lng) 反查所在的台灣縣市與行政區，並回傳該區實價頁連結。適合「我現在在這個座標，附近房價如何」。資料來源：housetw.com。',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: '緯度，例如 25.034' },
        lng: { type: 'number', description: '經度，例如 121.5645' },
      },
      required: ['lat', 'lng'],
    },
    run: (a) => realpriceLocate(a.lat, a.lng),
  },
  {
    name: 'taiwan_realprice_area',
    description:
      '查某縣市 / 行政區的不動產成交行情統計：中位與平均單價（萬/坪）、成交筆數、平均屋齡、價格分位、熱門路段排行。資料來源：housetw.com（內政部實價登錄）。',
    inputSchema: {
      type: 'object',
      properties: {
        county: { type: 'string', description: '縣市，例如「臺北市」「新北市」（用「臺」非「台」）' },
        district: { type: 'string', description: '行政區（可選），例如「信義區」' },
      },
      required: ['county'],
    },
    run: (a) => realpriceArea(a.county, a.district),
  },
  {
    name: 'taiwan_realprice_estimate',
    description:
      '自動估價：輸入縣市+行政區（可加建物型態/屋齡/坪數），回傳可比案例的單價區間（萬/坪）與推估總價。資料來源：housetw.com（內政部實價登錄）。',
    inputSchema: {
      type: 'object',
      properties: {
        county: { type: 'string', description: '縣市，例如「臺北市」（用「臺」非「台」）' },
        district: { type: 'string', description: '行政區，例如「信義區」' },
        building_type: { type: 'string', description: '建物型態（可選），例如「住宅大樓」「公寓」「華廈」' },
        house_age: { type: 'number', description: '屋齡（可選，年）' },
        area_ping: { type: 'number', description: '坪數（可選），給了才會推估總價' },
      },
      required: ['county', 'district'],
    },
    run: (a) => realpriceEstimate(a.county, a.district, { type: a.building_type, age: a.house_age, ping: a.area_ping }),
  },
  {
    name: 'taiwan_realprice_road',
    description:
      '查某路段的不動產成交行情：單價統計（萬/坪）、成交筆數、屋齡與逐年價格走勢。資料來源：housetw.com（內政部實價登錄）。',
    inputSchema: {
      type: 'object',
      properties: {
        county: { type: 'string', description: '縣市，例如「臺北市」' },
        district: { type: 'string', description: '行政區，例如「信義區」' },
        road: { type: 'string', description: '路段，例如「松高路」「忠孝東路四段」' },
      },
      required: ['county', 'district', 'road'],
    },
    run: (a) => realpriceRoad(a.county, a.district, a.road),
  },
  {
    name: 'taiwan_drug_search',
    description:
      '搜尋台灣核准的藥品（用中文藥名關鍵字），回傳符合的藥品與其衛福部許可證字號。要看成分請接著用 taiwan_drug_info。資料來源：衛福部食藥署 · health-hub。',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: '藥品中文名關鍵字，例如「普拿疼」「斯斯」' } },
      required: ['name'],
    },
    run: (a) => drugSearch(a.name),
  },
  {
    name: 'taiwan_drug_info',
    description:
      '用藥品許可證字號查該藥詳情：主成分、適應症、用法、劑型、藥品類別／管制分級、健保價、是否被回收、供應短缺狀態。資料來源：衛福部食藥署 · health-hub。用藥請依醫師、藥師指示。',
    inputSchema: {
      type: 'object',
      properties: { license_no: { type: 'string', description: '藥品許可證字號，例如「衛署藥輸字第024600號」（可先用 taiwan_drug_search 取得）' } },
      required: ['license_no'],
    },
    run: (a) => drugInfo(a.license_no),
  },
  {
    name: 'taiwan_gov_tender_by_company',
    description:
      '查某公司／廠商參與投標或得標的政府採購案，回傳標案名稱、機關、公告類型、日期與相關廠商。可搭配公司查核做盡職調查（這家公司接過哪些政府標案）。資料來源：政府電子採購網開放資料（g0v PCC API）。',
    inputSchema: {
      type: 'object',
      properties: { company: { type: 'string', description: '公司／廠商名稱，例如「大同股份有限公司」' } },
      required: ['company'],
    },
    run: (a) => tenderByCompany(a.company),
  },
  {
    name: 'taiwan_gov_tender_search',
    description:
      '用標案名稱關鍵字搜尋政府採購案，回傳標案、機關、得標廠商與日期（可翻頁）。資料來源：政府電子採購網開放資料（g0v PCC API）。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '標案名稱關鍵字，例如「口罩」「資訊服務」' },
        page: { type: 'number', description: '頁碼（可選，預設 1）' },
      },
      required: ['keyword'],
    },
    run: (a) => tenderSearch(a.keyword, a.page),
  },
  {
    name: 'taiwan_farm_price',
    description:
      '查台灣農產品批發市場最新交易行情：某蔬果的平均、最高、最低批發價（元/公斤）與交易量。颱風季菜價查詢常用。涵蓋蔬果花卉，不含禽蛋肉品。資料來源：農業部 data.moa.gov.tw。',
    inputSchema: {
      type: 'object',
      properties: {
        crop: { type: 'string', description: '蔬果名稱，例如「高麗菜」「香蕉」「青蔥」「番茄」' },
        market: { type: 'string', description: '批發市場（可選，預設「台北一」），例如「台北一」「台北二」「台中」「三重」「高雄」' },
      },
      required: ['crop'],
    },
    run: (a) => farmPrice(a.crop, a.market),
  },
];

const server = new Server(
  { name: 'taiwan-data-mcp', version: '0.12.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) return { content: [{ type: 'text', text: `未知工具：${req.params.name}` }], isError: true };
  try {
    const result = await tool.run(req.params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: !!result?.error };
  } catch (e) {
    return { content: [{ type: 'text', text: `工具執行錯誤：${e?.message || e}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('taiwan-data-mcp running (stdio) — 23 tools: 防詐 / 公司登記·關係·盡調 / 實價登錄 / 藥品健康 / 政府標案 / 農產行情');
